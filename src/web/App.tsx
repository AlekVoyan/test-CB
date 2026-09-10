import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { UNVERIFIED_ANSWER } from "../core/answerer";
import { config } from "../core/config";
import { appendTurn, documentSetKey } from "../core/conversation";
import { llmCostUsd } from "../core/cost";
import { ingestPdf, type IngestStage } from "../core/ingest";
import { IngestError } from "../core/limits";
import { relatedEvidence, selectEvidence } from "../core/retriever";
import type { AnswerResult, AnswerStatus, Citation, EvidenceUnit, IndexedDocument, Turn } from "../core/types";
import { verifyCitations } from "../core/validator";
import { askServer } from "./api";
import { pdfjs } from "./pdfjs";
import { speak, speechRecognitionSupported, startRecognition, stopSpeaking } from "./voice";

type DocStage = "reading" | IngestStage | "ready" | "error";
interface DocEntry {
  key: string;
  filename: string;
  stage: DocStage;
  doc?: IndexedDocument;
  ingestMs?: number;
  error?: string;
}

interface QuestionMetrics {
  id: number;
  at: string;
  question: string;
  source: "voice" | "text";
  status?: AnswerStatus;
  sttMs?: number;
  retrievalMs: number;
  evidence: { mode: string; units: number; estimatedTokens: number };
  requestMs: number;
  llmMs: number[];
  validationMs: number;
  submitToFirstAudioMs?: number;
  speechEndToFirstAudioMs?: number;
  voice?: string | null;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
  costUsd: number;
  clientCheck: string;
}

interface AnswerView {
  question: string;
  result: AnswerResult;
  related: Citation[];
  clientErrors: string[];
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

const STAGE_LABEL: Record<DocStage, string> = {
  reading: "Uploading",
  extracting: "Extracting",
  indexing: "Indexing",
  ready: "Ready",
  error: "Not loaded",
};
const STATUS_LABEL: Record<AnswerStatus, string> = {
  answered: "Answered",
  not_found: "Not in document",
  needs_clarification: "Needs clarification",
  conflict: "Documents disagree",
};

const toCitation = (u: EvidenceUnit): Citation => ({
  documentId: u.documentId,
  filename: u.filename,
  page: u.page,
  sentenceId: u.id,
  quote: u.text,
});
const fmtMs = (x?: number) => (x === undefined ? "—" : `${Math.round(x)} ms`);

export function App() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [history, setHistory] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<AnswerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [log, setLog] = useState<QuestionMetrics[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const counter = useRef(0);
  const recognizer = useRef<{ stop(): void } | null>(null);
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const historyRef = useRef(history);
  historyRef.current = history;

  const readyDocs = docs.flatMap((d) => (d.stage === "ready" && d.doc ? [d.doc] : []));
  const busy = docs.some((d) => d.stage === "reading" || d.stage === "extracting" || d.stage === "indexing");
  const voiceSupported = speechRecognitionSupported();
  const activeEntities = history[history.length - 1]?.activeEntities ?? [];

  // Decision D4: a different document set starts a fresh conversation.
  const setKey = documentSetKey(readyDocs);
  const prevSetKey = useRef(setKey);
  useEffect(() => {
    if (prevSetKey.current === setKey) return;
    prevSetKey.current = setKey;
    if (historyRef.current.length) {
      setHistory([]);
      setNotice("Documents changed — conversation context reset.");
    }
  }, [setKey]);

  async function addFiles(files: File[], replacing?: string) {
    setError(null);
    setNotice(null);
    if (replacing) setDocs((ds) => ds.filter((d) => d.key !== replacing));
    for (const file of files) {
      const startedAt = performance.now(); // file_selected
      const n = ++counter.current;
      const key = `doc${n}`;
      const update = (patch: Partial<DocEntry>) => setDocs((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
      const existing = docsRef.current
        .filter((d) => d.key !== replacing && d.stage !== "error")
        .map((d) => ({ pageCount: d.doc?.pageCount ?? 0 }));
      setDocs((ds) => [...ds, { key, filename: file.name, stage: "reading" }]);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await ingestPdf({
          bytes,
          filename: file.name,
          documentId: key,
          docKey: `d${n}`,
          existing,
          pdfjs,
          onStage: (stage) => update({ stage }),
        });
        const ingestMs = performance.now() - startedAt; // Ready
        update({ stage: "ready", doc, ingestMs });
        docsRef.current = docsRef.current.concat({ key, filename: file.name, stage: "ready", doc, ingestMs });
      } catch (e) {
        update({ stage: "error", error: e instanceof IngestError ? e.message : `Could not load this file: ${String(e)}` });
      }
    }
  }

  function removeDoc(key: string) {
    setDocs((ds) => ds.filter((d) => d.key !== key));
  }

  async function ask(raw: string, source: "voice" | "text", voiceTimes?: { speechEndAt?: number; sttFinalAt?: number }) {
    const question = raw.trim();
    if (!question) return;
    const ready = docsRef.current.flatMap((d) => (d.stage === "ready" && d.doc ? [d.doc] : []));
    if (!ready.length) {
      setError("Upload a PDF first.");
      return;
    }
    stopSpeaking();
    setError(null);
    setNotice(null);
    setPhase("thinking");

    const submitAt = performance.now();
    const turns = historyRef.current;
    const selection = selectEvidence(ready, question, { history: turns });
    const retrievalMs = performance.now() - submitAt;

    const requestAt = performance.now();
    let result: AnswerResult;
    try {
      result = await askServer({ question, history: turns, evidence: selection.units });
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    const requestMs = performance.now() - requestAt;

    // Defense in depth: re-check every quote against the page text held in this browser.
    const clientErrors = verifyCitations(result.citations, ready);
    if (clientErrors.length) result = { ...result, status: "not_found", answer: UNVERIFIED_ANSWER, citations: [] };
    const related = result.status === "not_found" ? relatedEvidence(selection).map(toCitation) : [];

    setAnswer({ question, result, related, clientErrors });
    setHistory((h) =>
      appendTurn(h, {
        question,
        resolvedQuery: result.resolvedQuery,
        status: result.status,
        answer: result.answer,
        activeEntities: result.activeEntities,
      }),
    );

    const id = Date.now();
    setLog((l) => [
      {
        id,
        at: new Date().toISOString(),
        question,
        source,
        status: result.status,
        sttMs: voiceTimes?.speechEndAt && voiceTimes.sttFinalAt ? voiceTimes.sttFinalAt - voiceTimes.speechEndAt : undefined,
        retrievalMs,
        evidence: { mode: selection.mode, units: selection.units.length, estimatedTokens: selection.estimatedTokens },
        requestMs,
        llmMs: result.timings.llmMs,
        validationMs: result.timings.validationMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        attempts: result.validation.attempts,
        costUsd: llmCostUsd(result.usage),
        clientCheck: clientErrors.length ? `failed: ${clientErrors.join("; ")}` : "all quotes found on their pages",
      },
      ...l,
    ]);

    setPhase("speaking");
    const voice = speak(result.answer, {
      lang: config.speechLang,
      onStart: () => {
        const t = performance.now(); // tts_start
        setLog((l) =>
          l.map((m) =>
            m.id === id
              ? {
                  ...m,
                  submitToFirstAudioMs: t - submitAt,
                  speechEndToFirstAudioMs: voiceTimes?.speechEndAt ? t - voiceTimes.speechEndAt : undefined,
                }
              : m,
          ),
        );
      },
      onEnd: () => setPhase((p) => (p === "speaking" ? "idle" : p)),
    });
    setLog((l) => l.map((m) => (m.id === id ? { ...m, voice } : m)));
  }

  function toggleMic() {
    if (phase === "listening") {
      recognizer.current?.stop();
      return;
    }
    stopSpeaking();
    setError(null);
    setInterim("");
    let speechEndAt: number | undefined;
    recognizer.current = startRecognition({
      lang: config.speechLang,
      onInterim: setInterim,
      onSpeechEnd: () => {
        speechEndAt = performance.now(); // speech_end
      },
      onFinal: (text) => {
        const sttFinalAt = performance.now(); // stt_final = submit
        setInterim(text);
        void ask(text, "voice", { speechEndAt: speechEndAt ?? sttFinalAt, sttFinalAt });
      },
      onError: (message) => {
        setError(message);
        setPhase("idle");
      },
      onEnd: () => setPhase((p) => (p === "listening" ? "idle" : p)),
    });
    if (recognizer.current) setPhase("listening");
  }

  function onTyped(e: FormEvent) {
    e.preventDefault();
    setInterim(typed);
    void ask(typed, "text");
    setTyped("");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
  }

  function onPick(e: ChangeEvent<HTMLInputElement>, replacing?: string) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) void addFiles(replacing ? files.slice(0, 1) : files, replacing);
  }

  async function copyMetrics() {
    const payload = {
      ingestion: docs.filter((d) => d.doc).map((d) => ({ file: d.filename, pages: d.doc!.pageCount, totalMs: d.ingestMs, ...d.doc!.timings })),
      questions: log,
      userAgent: navigator.userAgent,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const micLabel =
    phase === "listening" ? "Listening… tap to stop" : phase === "thinking" ? "Finding the answer…" : phase === "speaking" ? "Speaking…" : "Tap and ask";
  const last = log[0];

  return (
    <main className="page">
      <header className="masthead">
        <h1>Ask your documents</h1>
        <p>Upload an equipment manual, ask a question out loud, and hear a short answer with the exact quote and page it came from.</p>
      </header>

      <section className="panel" aria-labelledby="docs-title">
        <h2 id="docs-title">1. Documents</h2>
        <label
          className={`dropzone${dragging ? " is-dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => onPick(e)} />
          <strong>Upload PDF</strong>
          <span>
            Drop files here or click to choose · up to {config.maxFiles} text-based PDFs, {config.maxTotalPages} pages in total
          </span>
        </label>

        {docs.length > 0 && (
          <ul className="doc-list">
            {docs.map((d) => (
              <li key={d.key} className={`doc doc-${d.stage}`}>
                <div className="doc-main">
                  <span className="doc-name">{d.filename}</span>
                  <span className="doc-meta">
                    <span className={`pill pill-${d.stage}`}>{STAGE_LABEL[d.stage]}</span>
                    {d.doc && <span>{d.doc.pageCount} pages</span>}
                    {d.ingestMs !== undefined && <span>ready in {Math.round(d.ingestMs)} ms</span>}
                  </span>
                  {d.error && <span className="doc-error">{d.error}</span>}
                </div>
                <div className="doc-actions">
                  {d.stage === "ready" && (
                    <label className="btn btn-quiet">
                      Replace
                      <input type="file" accept="application/pdf,.pdf" onChange={(e) => onPick(e, d.key)} />
                    </label>
                  )}
                  <button type="button" className="btn btn-quiet" onClick={() => removeDoc(d.key)}>
                    {d.stage === "error" ? "Dismiss" : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel ask" aria-labelledby="ask-title">
        <h2 id="ask-title">2. Ask</h2>
        {!voiceSupported && (
          <p className="banner" role="status">
            Voice input isn't supported in this browser — use Chrome or Edge, or type your question below.
          </p>
        )}
        <div className="mic-row">
          <button
            type="button"
            className={`mic mic-${phase}`}
            onClick={toggleMic}
            disabled={!voiceSupported || !readyDocs.length || busy || phase === "thinking"}
            aria-label={micLabel}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </button>
          <div className="mic-text" aria-live="polite">
            <span className="mic-state">{readyDocs.length ? micLabel : "Upload a PDF to start"}</span>
            {interim && <span className="transcript">“{interim}”</span>}
          </div>
        </div>

        {readyDocs.length > 0 && (
          <p className="context-chip">
            Using: {readyDocs.map((d) => d.filename).join(", ")}
            {activeEntities.length > 0 && <> · {activeEntities.join(", ")}</>}
          </p>
        )}

        <form className="typed" onSubmit={onTyped}>
          <label htmlFor="typed-q" className="sr-only">
            Type a question
          </label>
          <input
            id="typed-q"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={voiceSupported ? "…or type a question" : "Type a question"}
            disabled={!readyDocs.length || phase === "thinking"}
          />
          <button type="submit" className="btn" disabled={!typed.trim() || !readyDocs.length || phase === "thinking"}>
            Ask
          </button>
        </form>

        {notice && <p className="notice">{notice}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      {answer && (
        <section className="panel answer" aria-live="polite" aria-labelledby="answer-title">
          <h2 id="answer-title" className="sr-only">
            Answer
          </h2>
          <p className="asked">You asked: “{answer.question}”</p>
          <div className="answer-head">
            <span className={`status status-${answer.result.status}`}>{STATUS_LABEL[answer.result.status]}</span>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => speak(answer.result.answer, { lang: config.speechLang, onEnd: () => setPhase("idle") })}
            >
              ▶ Replay
            </button>
          </div>
          <p className="answer-text">{answer.result.answer}</p>

          {answer.result.citations.length > 0 && (
            <div className="evidence">
              {answer.result.citations.map((c) => (
                <figure key={c.sentenceId} className="quote">
                  <blockquote>{c.quote}</blockquote>
                  <figcaption>
                    {c.filename} · <strong>Page {c.page}</strong>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {answer.related.length > 0 && (
            <details className="related">
              <summary>Closest passages (not an answer)</summary>
              {answer.related.map((c) => (
                <figure key={c.sentenceId} className="quote quote-muted">
                  <blockquote>{c.quote}</blockquote>
                  <figcaption>
                    {c.filename} · Page {c.page}
                  </figcaption>
                </figure>
              ))}
            </details>
          )}
          {answer.clientErrors.length > 0 && <p className="error">A quote could not be found on its page, so the answer was withheld.</p>}
        </section>
      )}

      <details className="panel metrics">
        <summary>Measurements</summary>
        <div className="metrics-body">
          <table>
            <tbody>
              {docs
                .filter((d) => d.doc)
                .map((d) => (
                  <tr key={d.key}>
                    <th>Ingestion · {d.filename}</th>
                    <td>
                      {fmtMs(d.ingestMs)} (extract {fmtMs(d.doc!.timings.extractMs)}, index {fmtMs(d.doc!.timings.indexMs)})
                    </td>
                  </tr>
                ))}
              {last && (
                <>
                  <tr>
                    <th>Speech end → transcript (STT)</th>
                    <td>{fmtMs(last.sttMs)}</td>
                  </tr>
                  <tr>
                    <th>Retrieval</th>
                    <td>
                      {fmtMs(last.retrievalMs)} ({last.evidence.mode}, {last.evidence.units} lines)
                    </td>
                  </tr>
                  <tr>
                    <th>Server round trip</th>
                    <td>
                      {fmtMs(last.requestMs)} (LLM {last.llmMs.map((x) => fmtMs(x)).join(" + ")}, {last.attempts} attempt
                      {last.attempts > 1 ? "s" : ""})
                    </td>
                  </tr>
                  <tr>
                    <th>Submit → first audio (proxy: utterance start)</th>
                    <td>{fmtMs(last.submitToFirstAudioMs)}</td>
                  </tr>
                  <tr>
                    <th>Speech end → first audio</th>
                    <td>{fmtMs(last.speechEndToFirstAudioMs)}</td>
                  </tr>
                  <tr>
                    <th>Tokens · estimated LLM cost</th>
                    <td>
                      {last.inputTokens} in / {last.outputTokens} out · ${last.costUsd.toFixed(5)}
                    </td>
                  </tr>
                  <tr>
                    <th>Quote check in browser</th>
                    <td>{last.clientCheck}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <button type="button" className="btn btn-quiet" onClick={() => void copyMetrics()} disabled={!docs.length}>
            {copied ? "Copied" : "Copy measurements JSON"}
          </button>
        </div>
      </details>
    </main>
  );
}
