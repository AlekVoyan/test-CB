import {
  ArrowsClockwiseIcon,
  BrainIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  FilePdfIcon,
  FilesIcon,
  GaugeIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  QuestionIcon,
  QuotesIcon,
  ScalesIcon,
  SpeakerHighIcon,
  StopIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from "react";
import sampleV1Url from "../../fixtures/manual-v1.pdf?url";
import sampleV2Url from "../../fixtures/manual-v2.pdf?url";
import { spokenAnswer, UNVERIFIED_ANSWER } from "../core/answerer";
import { config, DEFAULT_LANGUAGE, LANGUAGES, type Language } from "../core/config";
import { appendTurn, documentSetKey } from "../core/conversation";
import { llmCostUsd } from "../core/cost";
import { ingestPdf, type IngestStage } from "../core/ingest";
import { IngestError } from "../core/limits";
import { relatedEvidence, selectEvidence } from "../core/retriever";
import type { AnswerResult, AnswerStatus, Citation, EvidenceUnit, IndexedDocument, Turn } from "../core/types";
import { verifyCitations } from "../core/validator";
import { askServer, fetchServerInfo, type ServerInfo } from "./api";
import { pdfjs } from "./pdfjs";
import { speakAnswer, stopSpeaking } from "./tts";
import { speechRecognitionSupported, startRecognition } from "./voice";

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
  language: Language;
  status?: AnswerStatus;
  basis?: AnswerResult["basis"];
  /** "Think harder" actually applied by the model. */
  deep: boolean;
  answer?: string;
  /** Validator findings on rejected attempts: why a question needed a second call. */
  retryReasons: string[];
  sttMs?: number;
  retrievalMs: number;
  evidence: { mode: string; units: number; estimatedTokens: number };
  requestMs: number;
  llmMs: number[];
  validationMs: number;
  submitToFirstAudioMs?: number;
  speechEndToFirstAudioMs?: number;
  tts: { provider: string | null; voice: string | null; note?: string };
  inputTokens: number;
  outputTokens: number;
  attempts: number;
  costUsd: number;
  clientCheck: string;
}

interface AnswerView {
  id: number;
  question: string;
  language: Language;
  result: AnswerResult;
  /** Lines shown with a not-found answer: the model's related lines, or the retriever's closest when it chose none. */
  nearby: { kind: NearbyKind; lines: Citation[] };
  clientErrors: string[];
}

type NearbyKind = "related" | "closest";
type ProofKind = "evidence" | NearbyKind;
const PROOF_PREFIX: Record<ProofKind, string> = { evidence: "", related: "Related, not the answer · ", closest: "Closest · " };
const PROOF_NAME: Record<ProofKind, string> = { evidence: "Quote", related: "Related line, not the answer", closest: "Closest passage" };
const PROOF_AREA: Record<ProofKind, string> = { evidence: "Evidence", related: "Related lines, not the answer", closest: "Closest passages" };

interface PageGroup {
  key: string;
  filename: string;
  page: number;
  lines: Citation[];
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

/** Answers kept in the folder stack behind the current one. */
const HISTORY_LIMIT = 8;

const STAGE_LABEL: Record<DocStage, string> = {
  reading: "Uploading",
  extracting: "Extracting text",
  indexing: "Indexing",
  ready: "Ready",
  error: "Not loaded",
};
const STAGE_PROGRESS: Record<DocStage, number> = { reading: 0.2, extracting: 0.55, indexing: 0.85, ready: 1, error: 1 };

const STATUS_META: Record<AnswerStatus, { label: string; icon: ReactNode }> = {
  answered: { label: "Answered", icon: <CheckCircleIcon weight="bold" aria-hidden /> },
  not_found: { label: "Not in the document", icon: <MagnifyingGlassIcon weight="bold" aria-hidden /> },
  needs_clarification: { label: "Needs clarification", icon: <QuestionIcon weight="bold" aria-hidden /> },
  conflict: { label: "Documents disagree", icon: <ScalesIcon weight="bold" aria-hidden /> },
};
// An answer that follows from a rule or range rather than from a line that says it.
const INFERRED_META = { label: "Inferred from the document", icon: <LightbulbIcon weight="bold" aria-hidden /> };

// Suggested questions for the synthetic sample manual, in each answer language.
const EXAMPLES: Record<Language, string[]> = {
  en: ["What is the maximum for Model A?", "How do I set up Model B?", "What is the battery life of Model A?"],
  ru: ["Какая максимальная нагрузка у модели A?", "Как настроить модель B?", "Сколько работает модель A от батареи?"],
  uk: ["Яке максимальне навантаження моделі A?", "Як налаштувати модель B?", "Скільки коштує модель A?"],
};

const LANGUAGE_KEY = "answer-language";
function readStoredLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return value === "en" || value === "ru" || value === "uk" ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

const DEEP_KEY = "think-harder";
function readStoredDeep(): boolean {
  try {
    return localStorage.getItem(DEEP_KEY) === "1";
  } catch {
    return false;
  }
}

const toCitation = (u: EvidenceUnit): Citation => ({
  documentId: u.documentId,
  filename: u.filename,
  page: u.page,
  sentenceId: u.id,
  quote: u.text,
});
const fmtMs = (x?: number) => (x === undefined ? "—" : x < 1000 ? `${Math.round(x)} ms` : `${(x / 1000).toFixed(2)} s`);
const fmtUsd = (x: number) => (Number.isFinite(x) ? `$${x.toFixed(5)}` : "no price set");

// Older answers are deeper shades of the answer lime; proof folders deepen the sage.
const answerShade = (age: number) =>
  age <= 0 ? "var(--lime)" : `color-mix(in oklab, var(--lime) ${100 - Math.min(age, 5) * 8}%, #6d7a34)`;
const backShade = (depth: number, tone: "sage" | "dark") =>
  tone === "sage"
    ? `color-mix(in oklab, var(--sage) ${100 - (depth + 1) * 9}%, #3d5836)`
    : `color-mix(in oklab, var(--surface-2) ${100 - (depth + 1) * 14}%, #0f100e)`;

/** Quotes are filed per page: one folder holds every cited line of that page. */
function groupByPage(citations: Citation[]): PageGroup[] {
  const groups = new Map<string, PageGroup>();
  for (const c of citations) {
    const key = `${c.documentId}#${c.page}`;
    const group = groups.get(key) ?? { key, filename: c.filename, page: c.page, lines: [] };
    group.lines.push(c);
    groups.set(key, group);
  }
  return [...groups.values()];
}
const pageLabel = (g: PageGroup, withFile: boolean) =>
  `${withFile ? `${g.filename} · ` : ""}Page ${g.page}${g.lines.length > 1 ? ` · ${g.lines.length} lines` : ""}`;

type Tone = "lime" | "coral" | "teal" | "sage" | "dark";

function Tile(props: {
  tone: Tone;
  area: string;
  tab?: ReactNode;
  labelledBy?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section
      className={`tile tone-${props.tone}${props.tab ? " has-tab" : ""}${props.className ? ` ${props.className}` : ""}`}
      style={{ gridArea: props.area, ...props.style }}
      aria-labelledby={props.labelledBy}
      aria-label={props.label}
    >
      {props.tab && <div className="tile-tab">{props.tab}</div>}
      <div className="tile-body">{props.children}</div>
    </section>
  );
}

interface BackFolder {
  key: string;
  hint: string;
  aria: string;
  bg: string;
  onOpen: () => void;
}

/**
 * One folder in front, the rest filed behind it with their tabs peeking above.
 * The wheel pages through the filed folders only over the tab strip, and only while there is somewhere to go.
 */
function FolderStack(props: { label: string; backs: BackFolder[]; resetKey: string | number; extra?: ReactNode; children: ReactNode }) {
  const { backs } = props;
  const stackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(3);
  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, backs.length - capacity);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const maxRef = useRef(maxOffset);
  maxRef.current = maxOffset;

  useEffect(() => setOffset(0), [props.resetKey]);
  useEffect(() => {
    if (offset > maxOffset) setOffset(maxOffset);
  }, [offset, maxOffset]);

  // How many tabs fit beside the front folder's own tab.
  useEffect(() => {
    const el = stackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 800;
      setCapacity(width < 420 ? 1 : width < 560 ? 2 : 3);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasBacks = backs.length > 0;
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    let accumulated = 0;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      const next = offsetRef.current + (delta > 0 ? 1 : -1);
      if (next < 0 || next > maxRef.current) {
        accumulated = 0;
        return; // nothing further this way: let the page scroll
      }
      e.preventDefault();
      accumulated += delta;
      if (Math.abs(accumulated) >= 60) {
        accumulated = 0;
        setOffset(next);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hasBacks]);

  const peek = Math.min(capacity, backs.length);
  const paged = backs.length > capacity;
  return (
    <div className="stack-wrap">
      {(paged || props.extra) && (
        <div className="stack-head">
          {paged && (
            <>
              <span className="mono">
                {offset + 1}
                {capacity > 1 && `–${Math.min(offset + capacity, backs.length)}`} of {backs.length}
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOffset((o) => Math.max(0, o - 1))}
                disabled={offset === 0}
                aria-label={`Newer ${props.label.toLowerCase()}`}
              >
                <CaretLeftIcon weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOffset((o) => Math.min(maxOffset, o + 1))}
                disabled={offset >= maxOffset}
                aria-label={`Older ${props.label.toLowerCase()}`}
              >
                <CaretRightIcon weight="bold" aria-hidden />
              </button>
            </>
          )}
          {props.extra}
        </div>
      )}
      <div className="stack" ref={stackRef} style={{ "--peek": peek } as CSSProperties}>
        {hasBacks && (
          <div className="stack-strip" ref={stripRef} role="group" aria-label={props.label}>
            {backs.map((b, i) => {
              const slot = i - offset + 1;
              const hidden = slot < 1 || slot > capacity;
              return (
                <button
                  key={b.key}
                  type="button"
                  className="stack-back"
                  data-hidden={hidden ? "" : undefined}
                  tabIndex={hidden ? -1 : undefined}
                  aria-hidden={hidden ? true : undefined}
                  title={b.hint}
                  aria-label={b.aria}
                  onClick={b.onOpen}
                  style={{ "--slot": Math.max(0, Math.min(slot, capacity + 1)), "--bg": b.bg } as CSSProperties}
                >
                  <span className="stack-back-tab">
                    <span>{b.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {props.children}
      </div>
    </div>
  );
}

function ProofFolder(props: { group: PageGroup; kind: ProofKind; withFile: boolean }) {
  const { group } = props;
  return (
    <Tile
      tone={props.kind === "evidence" ? "sage" : "dark"}
      area="auto"
      className={`proof-item${props.kind === "related" ? " is-related" : ""}`}
      label={`${PROOF_NAME[props.kind]}, ${group.filename}, page ${group.page}`}
      tab={
        <>
          <QuotesIcon weight="fill" aria-hidden />
          {PROOF_PREFIX[props.kind]}
          {pageLabel(group, props.withFile)}
        </>
      }
    >
      <div className="quote-lines">
        {group.lines.map((c) => (
          <blockquote key={c.sentenceId}>{c.quote}</blockquote>
        ))}
      </div>
      <p className="proof-source">
        {group.filename} · <span className="mono">{group.lines.map((l) => l.sentenceId).join(", ")}</span>
      </p>
    </Tile>
  );
}

function LanguageSwitch(props: { value: Language; onChange: (l: Language) => void; disabled: boolean }) {
  const order: Language[] = ["en", "ru", "uk"];
  const index = order.indexOf(props.value);
  return (
    <div className="lang" role="group" aria-label="Answer language">
      <span className="lang-indicator" style={{ "--i": index } as CSSProperties} aria-hidden />
      {order.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={props.value === l}
          aria-label={LANGUAGES[l].nativeName}
          title={LANGUAGES[l].nativeName}
          disabled={props.disabled}
          onClick={() => props.onChange(l)}
        >
          {LANGUAGES[l].label}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [history, setHistory] = useState<Turn[]>([]);
  const [language, setLanguage] = useState<Language>(readStoredLanguage);
  const [deep, setDeep] = useState(readStoredDeep);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerView[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [proofFront, setProofFront] = useState(0);
  const [proofExpanded, setProofExpanded] = useState(false);
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
  const loadedPages = readyDocs.reduce((sum, d) => sum + d.pageCount, 0);
  const answer = answers[viewIndex] ?? null;
  const deepAvailable = serverInfo?.deep === true;
  const thinkHarder = deep && deepAvailable;

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
      localStorage.setItem(DEEP_KEY, deep ? "1" : "0");
    } catch {
      // storage blocked: the choice lasts for this tab only
    }
  }, [language, deep]);

  useEffect(() => {
    void fetchServerInfo().then(setServerInfo);
  }, []);

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

  async function addSample(url: string, filename: string) {
    try {
      const blob = await (await fetch(url)).blob();
      await addFiles([new File([blob], filename, { type: "application/pdf" })]);
    } catch {
      setError("Could not load the sample manual.");
    }
  }

  function removeDoc(key: string) {
    setDocs((ds) => ds.filter((d) => d.key !== key));
  }

  /** Bring an earlier answer to the front. View only: follow-ups keep using the latest conversation. */
  function openAnswer(index: number) {
    stopSpeaking();
    setPhase((p) => (p === "speaking" ? "idle" : p));
    setViewIndex(index);
    setProofFront(0);
    setProofExpanded(false);
  }

  async function ask(raw: string, source: "voice" | "text", voiceTimes?: { speechEndAt?: number; sttFinalAt?: number }) {
    const question = raw.trim();
    if (!question) return;
    const ready = docsRef.current.flatMap((d) => (d.stage === "ready" && d.doc ? [d.doc] : []));
    if (!ready.length) {
      setError("Upload a PDF first — or load a sample manual.");
      return;
    }
    const lang = language;
    stopSpeaking();
    setError(null);
    setNotice(null);
    setPending(question);
    setPhase("thinking");

    const submitAt = performance.now();
    const turns = historyRef.current;
    const selection = selectEvidence(ready, question, { history: turns });
    const retrievalMs = performance.now() - submitAt;

    const requestAt = performance.now();
    let result: AnswerResult;
    try {
      result = await askServer({ question, history: turns, evidence: selection.units, language: lang, deep: thinkHarder });
    } catch (e) {
      setPending(null);
      setPhase("idle");
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    const requestMs = performance.now() - requestAt;

    // Defense in depth: re-check every quote (cited or related) against the page text held in this browser.
    const clientErrors = verifyCitations([...result.citations, ...result.related], ready);
    if (clientErrors.length)
      result = { ...result, status: "not_found", basis: "stated", answer: UNVERIFIED_ANSWER, reason: "", assumed: "", citations: [], related: [] };
    const nearby: AnswerView["nearby"] =
      result.status !== "not_found"
        ? { kind: "closest", lines: [] }
        : result.related.length
          ? { kind: "related", lines: result.related }
          : { kind: "closest", lines: relatedEvidence(selection).map(toCitation) };

    const id = Date.now();
    setPending(null);
    setAnswers((list) => [{ id, question, language: lang, result, nearby, clientErrors }, ...list].slice(0, HISTORY_LIMIT));
    setViewIndex(0);
    setProofFront(0);
    setProofExpanded(false);
    setHistory((h) =>
      appendTurn(h, {
        question,
        resolvedQuery: result.resolvedQuery,
        status: result.status,
        answer: result.answer,
        activeEntities: result.activeEntities,
      }),
    );
    setLog((l) => [
      {
        id,
        at: new Date().toISOString(),
        question,
        source,
        language: lang,
        status: result.status,
        basis: result.basis,
        deep: result.deep.applied,
        answer: result.answer,
        retryReasons: result.validation.retryReasons,
        sttMs: voiceTimes?.speechEndAt && voiceTimes.sttFinalAt ? voiceTimes.sttFinalAt - voiceTimes.speechEndAt : undefined,
        retrievalMs,
        evidence: { mode: selection.mode, units: selection.units.length, estimatedTokens: selection.estimatedTokens },
        requestMs,
        llmMs: result.timings.llmMs,
        validationMs: result.timings.validationMs,
        tts: { provider: null, voice: null },
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        attempts: result.validation.attempts,
        costUsd: llmCostUsd(result.usage),
        clientCheck: clientErrors.length ? `failed: ${clientErrors.join("; ")}` : "every quote found on its page",
      },
      ...l,
    ]);

    setPhase("speaking");
    const outcome = speakAnswer(spokenAnswer(result), lang, {
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
      onEnd: () => {
        setPhase((p) => (p === "speaking" ? "idle" : p));
        // A spoken clarification question: listen for the reply right away.
        if (result.status === "needs_clarification" && source === "voice") startListening();
      },
    });
    setLog((l) =>
      l.map((m) =>
        m.id === id
          ? { ...m, tts: "reason" in outcome ? { provider: null, voice: null, note: outcome.reason } : { provider: outcome.provider, voice: outcome.voice } }
          : m,
      ),
    );
  }

  function toggleMic() {
    if (phase === "listening") {
      recognizer.current?.stop();
      return;
    }
    startListening();
  }

  function startListening() {
    stopSpeaking();
    setError(null);
    setInterim("");
    let speechEndAt: number | undefined;
    let lastInterimAt: number | undefined;
    recognizer.current = startRecognition({
      lang: LANGUAGES[language].locale,
      onInterim: (text) => {
        lastInterimAt = performance.now();
        setInterim(text);
      },
      onSpeechEnd: () => {
        speechEndAt ??= performance.now(); // speech_end
      },
      onFinal: (text) => {
        const sttFinalAt = performance.now(); // stt_final = submit
        setInterim(text);
        // Chrome often fires speechend only after the final result; the last interim result then marks the end of speech.
        const endOfSpeech = speechEndAt ?? lastInterimAt ?? sttFinalAt;
        void ask(text, "voice", { speechEndAt: endOfSpeech, sttFinalAt });
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

  function askExample(q: string) {
    setInterim(q);
    void ask(q, "text");
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

  function replay() {
    if (!answer) return;
    setPhase("speaking");
    speakAnswer(spokenAnswer(answer.result), answer.language, { onEnd: () => setPhase((p) => (p === "speaking" ? "idle" : p)) });
  }

  async function copyMetrics() {
    const payload = {
      ingestion: docs.filter((d) => d.doc).map((d) => ({ file: d.filename, pages: d.doc!.pageCount, totalMs: d.ingestMs, ...d.doc!.timings })),
      questions: log,
      userAgent: navigator.userAgent,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("The browser blocked clipboard access.");
    }
  }

  const micLabel =
    phase === "listening" ? "Listening… tap to stop" : phase === "thinking" ? "Finding the answer" : phase === "speaking" ? "Speaking" : "Tap and ask";
  const last = log[0];
  const status = answer
    ? answer.result.status === "answered" && answer.result.basis === "inferred"
      ? INFERRED_META
      : STATUS_META[answer.result.status]
    : null;
  const viewingEarlier = viewIndex > 0;

  // Answer history: every answer except the one in front, newest first.
  const answerBacks: BackFolder[] = answers.flatMap((a, i) =>
    i === viewIndex
      ? []
      : [
          {
            key: String(a.id),
            hint: a.question,
            aria: `${i === 0 ? "Latest answer" : "Earlier answer"}: ${a.question}`,
            bg: answerShade(i),
            onOpen: () => openAnswer(i),
          },
        ],
  );

  // Evidence for the answer in front, filed per page. A not-found answer shows nearby lines instead, never as proof.
  const proofs = answer?.result.citations ?? [];
  const proofKind: ProofKind = proofs.length ? "evidence" : (answer?.nearby.kind ?? "closest");
  const groups = groupByPage(proofs.length ? proofs : (answer?.nearby.lines ?? []));
  const proofTone: "sage" | "dark" = proofKind === "evidence" ? "sage" : "dark";
  const multiDoc = new Set(groups.map((g) => g.filename)).size > 1;
  const frontGroupIndex = Math.min(proofFront, Math.max(0, groups.length - 1));
  const proofBacks: BackFolder[] = groups
    .map((g, i) => ({ g, i }))
    .filter(({ i }) => i !== frontGroupIndex)
    .map(({ g, i }, depth) => ({
      key: g.key,
      hint: pageLabel(g, multiDoc),
      aria: `Show ${pageLabel(g, true)}`,
      bg: backShade(depth, proofTone),
      onOpen: () => setProofFront(i),
    }));

  // Latency breakdown of the last question, in the order it happened.
  const segments = last
    ? [
        { key: "stt", label: "Speech → text", ms: last.sttMs },
        { key: "retrieval", label: "Retrieval", ms: last.retrievalMs },
        { key: "model", label: "Model + validation", ms: last.requestMs },
        {
          key: "speech",
          label: "Start of speech",
          ms: last.submitToFirstAudioMs !== undefined ? Math.max(0, last.submitToFirstAudioMs - last.retrievalMs - last.requestMs) : undefined,
        },
      ].filter((s): s is { key: string; label: string; ms: number } => s.ms !== undefined)
    : [];
  const segmentTotal = segments.reduce((sum, s) => sum + s.ms, 0) || 1;

  return (
    <main className="page">
      <header className="masthead">
        <h1>Ask your documents</h1>
        <p>Upload a manual, ask out loud, and hear a short answer — with the exact line and page it came from.</p>
      </header>

      <div className="bento">
        {/* Voice */}
        <Tile tone="coral" area="voice" labelledBy="voice-title" className="tile-voice enter" style={{ "--i": 0 } as CSSProperties}>
          <div className="tile-head">
            <h2 id="voice-title">Ask aloud</h2>
            <LanguageSwitch value={language} onChange={setLanguage} disabled={phase === "listening" || phase === "thinking"} />
          </div>

          <div className="mic-stage">
            <button
              type="button"
              className="mic"
              data-state={phase}
              onClick={toggleMic}
              disabled={!voiceSupported || !readyDocs.length || busy || phase === "thinking"}
              aria-label={readyDocs.length ? micLabel : "Upload a PDF to start"}
            >
              {phase === "listening" ? <StopIcon weight="fill" aria-hidden /> : <MicrophoneIcon weight="fill" aria-hidden />}
            </button>
            <div className="mic-copy" aria-live="polite">
              <p className="mic-state">{readyDocs.length ? micLabel : "Add a document to start"}</p>
              <p className="mic-sub">
                {interim ? `“${interim}”` : `Answers in ${LANGUAGES[language].nativeName}. Quotes stay in the document's language.`}
              </p>
            </div>
          </div>

          {!voiceSupported && (
            <p className="inline-note" role="status">
              <WarningCircleIcon weight="bold" aria-hidden /> Voice input needs Chrome or Edge. Type your question below.
            </p>
          )}

          <label className="think">
            <button
              type="button"
              role="switch"
              className="switch"
              aria-checked={thinkHarder}
              aria-describedby="think-sub"
              onClick={() => setDeep((d) => !d)}
              disabled={!deepAvailable || phase === "thinking"}
            >
              <span className="switch-knob" aria-hidden />
            </button>
            <span className="think-copy">
              <span className="think-label">
                <BrainIcon weight="bold" aria-hidden /> Think harder
              </span>
              <span id="think-sub" className="think-sub">
                {deepAvailable
                  ? "Reasons before answering · slower"
                  : serverInfo
                    ? `Needs Claude · this server runs ${serverInfo.model.split("/").pop()}`
                    : "Needs Claude on the server"}
              </span>
            </span>
          </label>

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
              autoComplete="off"
            />
            <button type="submit" className="btn" disabled={!typed.trim() || !readyDocs.length || phase === "thinking"}>
              Ask
            </button>
          </form>
        </Tile>

        {/* Documents */}
        <Tile
          tone="teal"
          area="docs"
          labelledBy="docs-title"
          className="tile-docs enter"
          style={{ "--i": 1 } as CSSProperties}
          tab={
            <>
              <FilePdfIcon weight="bold" aria-hidden />
              {readyDocs.length} of {config.maxFiles} files · {loadedPages} of {config.maxTotalPages} pages
            </>
          }
        >
          <div className="tile-head">
            <div className="head-title">
              <span className="disc disc-sm">
                <FilesIcon weight="bold" aria-hidden />
              </span>
              <h2 id="docs-title">Documents</h2>
            </div>
            <p className="hint">Text-based PDFs</p>
          </div>

          <label
            className={`drop${dragging ? " is-dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => onPick(e)} />
            <span className="disc">
              <UploadSimpleIcon weight="bold" aria-hidden />
            </span>
            <span className="drop-copy">
              <strong>Drop PDFs here</strong> or choose files
            </span>
          </label>

          <div className="samples">
            <span>Synthetic sample manuals</span>
            <button type="button" className="btn-ghost" onClick={() => void addSample(sampleV1Url, "manual-v1.pdf")} disabled={busy}>
              Manual v1
            </button>
            <button type="button" className="btn-ghost" onClick={() => void addSample(sampleV2Url, "manual-v2.pdf")} disabled={busy}>
              Manual v2 · revised
            </button>
          </div>

          {docs.length > 0 && (
            <ul className="doc-list">
              {docs.map((d) => (
                <li key={d.key} className={`doc doc-${d.stage}`}>
                  <span className="disc disc-sm">
                    {d.stage === "error" ? <WarningCircleIcon weight="bold" aria-hidden /> : <FilePdfIcon weight="bold" aria-hidden />}
                  </span>
                  <div className="doc-main">
                    <span className="doc-name">{d.filename}</span>
                    {d.error ? (
                      <span className="doc-error">{d.error}</span>
                    ) : (
                      <>
                        <span className="doc-meta">
                          {STAGE_LABEL[d.stage]}
                          {d.doc && ` · ${d.doc.pageCount} pages`}
                          {d.ingestMs !== undefined && ` · ready in ${fmtMs(d.ingestMs)}`}
                        </span>
                        <span className="progress" aria-hidden>
                          <span style={{ "--p": STAGE_PROGRESS[d.stage] } as CSSProperties} />
                        </span>
                      </>
                    )}
                  </div>
                  <div className="doc-actions">
                    {d.stage === "ready" && (
                      <label className="icon-btn" title="Replace">
                        <ArrowsClockwiseIcon weight="bold" aria-hidden />
                        <span className="sr-only">Replace {d.filename}</span>
                        <input type="file" accept="application/pdf,.pdf" onChange={(e) => onPick(e, d.key)} />
                      </label>
                    )}
                    <button type="button" className="icon-btn" onClick={() => removeDoc(d.key)} title={d.stage === "error" ? "Dismiss" : "Remove"}>
                      <XIcon weight="bold" aria-hidden />
                      <span className="sr-only">
                        {d.stage === "error" ? "Dismiss" : "Remove"} {d.filename}
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        {/* Answer, with earlier answers filed behind it */}
        <div className="stack-area enter" style={{ gridArea: "answer", "--i": 2 } as CSSProperties}>
          <FolderStack label="Earlier answers" backs={answerBacks} resetKey={answers[0]?.id ?? 0}>
            <Tile
              tone="lime"
              area="auto"
              label="Answer"
              className="tile-answer"
              style={
                {
                  "--tile-bg": answerShade(viewIndex),
                  ...(viewIndex >= 2 ? { "--ink-2": "rgb(20 21 18 / 0.84)" } : {}),
                } as CSSProperties
              }
              tab={
                pending ? (
                  <>
                    <span className="dots" aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                    Finding the answer
                  </>
                ) : status ? (
                  <>
                    {status.icon}
                    {status.label}
                    {viewingEarlier && " · earlier"}
                  </>
                ) : (
                  <>No question yet</>
                )
              }
            >
              <div aria-live="polite">
                {pending ? (
                  <div className="answer-pending">
                    <p className="asked">“{pending}”</p>
                    <p className="answer-text is-muted">{thinkHarder ? "Thinking it through…" : "Reading the document…"}</p>
                  </div>
                ) : answer ? (
                  <div className="answer-result" key={answer.id}>
                    <p className="asked">You asked: “{answer.question}”</p>
                    <p className="answer-text" lang={answer.language}>
                      {answer.result.answer}
                    </p>
                    {answer.result.basis === "inferred" && answer.result.reason && (
                      <p className="why" lang={answer.language}>
                        <span className="why-label">Why</span>
                        <span>{answer.result.reason}</span>
                      </p>
                    )}
                    <div className="answer-actions">
                      <button type="button" className={`btn${phase === "speaking" ? " is-speaking" : ""}`} onClick={replay}>
                        {phase === "speaking" ? (
                          <span className="eq" aria-hidden>
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          <SpeakerHighIcon weight="bold" aria-hidden />
                        )}
                        {phase === "speaking" ? "Speaking" : "Replay"}
                      </button>
                      {answer.result.assumed && (
                        <span className="chip-static" lang={answer.language}>
                          Interpreted as “{answer.result.assumed}”
                        </span>
                      )}
                      {viewingEarlier ? (
                        <>
                          <button type="button" className="btn-ghost" onClick={() => openAnswer(0)}>
                            Back to latest
                          </button>
                          <span className="chip-static">Earlier answer · follow-ups use the latest</span>
                        </>
                      ) : (
                        readyDocs.length > 0 && (
                          <span className="chip-static">
                            Using {readyDocs.map((d) => d.filename).join(", ")}
                            {activeEntities.length > 0 && ` · ${activeEntities.join(", ")}`}
                          </span>
                        )
                      )}
                    </div>
                    {answer.clientErrors.length > 0 && (
                      <p className="inline-note">A quote could not be found on its page, so the answer was withheld.</p>
                    )}
                  </div>
                ) : (
                  <div className="answer-empty">
                    <p className="answer-text">{readyDocs.length ? "Ask about the manual." : "Load a manual, then ask."}</p>
                    <p className="asked">Try one of these with the sample manual:</p>
                    <div className="chips">
                      {EXAMPLES[language].map((q) => (
                        <button key={q} type="button" className="chip" onClick={() => askExample(q)} disabled={!readyDocs.length || phase === "thinking"} lang={language}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {notice && <p className="inline-note">{notice}</p>}
                {error && (
                  <p className="inline-note is-error" role="alert">
                    <WarningCircleIcon weight="bold" aria-hidden /> {error}
                  </p>
                )}
              </div>
            </Tile>
          </FolderStack>
        </div>

        {/* Proof: one folder per cited page */}
        {answer && groups.length > 0 && (
          <section className="stack-area proof-area" style={{ gridArea: "proof" }} aria-label={PROOF_AREA[proofKind]} key={answer.id}>
            {proofExpanded ? (
              <>
                <div className="stack-head">
                  <span>
                    {groups.length} {groups.length === 1 ? "page" : "pages"}
                  </span>
                  <button type="button" className="link-btn" onClick={() => setProofExpanded(false)}>
                    Collapse
                  </button>
                </div>
                <div className="proof">
                  {groups.map((g) => (
                    <ProofFolder key={g.key} group={g} kind={proofKind} withFile={multiDoc} />
                  ))}
                </div>
              </>
            ) : (
              <FolderStack
                label="More cited pages"
                backs={proofBacks}
                resetKey={answer.id}
                extra={
                  groups.length > 1 ? (
                    <button type="button" className="link-btn" onClick={() => setProofExpanded(true)}>
                      Show all {groups.length}
                    </button>
                  ) : undefined
                }
              >
                <ProofFolder key={groups[frontGroupIndex]!.key} group={groups[frontGroupIndex]!} kind={proofKind} withFile={multiDoc} />
              </FolderStack>
            )}
          </section>
        )}

        {/* Measurements */}
        <Tile tone="dark" area="metrics" labelledBy="metrics-title" className="tile-metrics enter" style={{ "--i": 3 } as CSSProperties}>
          <div className="tile-head">
            <div className="head-title">
              <span className="disc disc-sm">
                <GaugeIcon weight="bold" aria-hidden />
              </span>
              <h2 id="metrics-title">Measurements</h2>
            </div>
            <button type="button" className="icon-btn" onClick={() => void copyMetrics()} disabled={!docs.length} title="Copy measurements JSON">
              {copied ? <CheckIcon weight="bold" aria-hidden /> : <CopyIcon weight="bold" aria-hidden />}
              <span className="sr-only">{copied ? "Copied" : "Copy measurements JSON"}</span>
            </button>
          </div>

          {last ? (
            <>
              <div className="lat-bar" role="img" aria-label={segments.map((s) => `${s.label} ${fmtMs(s.ms)}`).join(", ")}>
                {segments.map((s) => (
                  <span key={s.key} className={`seg seg-${s.key}`} style={{ width: `${(s.ms / segmentTotal) * 100}%` }} />
                ))}
              </div>
              <ul className="lat-legend">
                {segments.map((s) => (
                  <li key={s.key}>
                    <i className={`swatch seg-${s.key}`} aria-hidden />
                    <span>{s.label}</span>
                    <span className="mono">{fmtMs(s.ms)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hint">Timings, tokens and cost appear after the first question.</p>
          )}

          <dl className="facts">
            {docs
              .filter((d) => d.doc)
              .map((d) => (
                <div key={d.key}>
                  <dt>Ingestion · {d.filename}</dt>
                  <dd className="mono">{fmtMs(d.ingestMs)}</dd>
                </div>
              ))}
            {last && (
              <>
                <div>
                  <dt>Question → first audio</dt>
                  <dd className="mono">{fmtMs(last.submitToFirstAudioMs)}</dd>
                </div>
                <div>
                  <dt>Model · attempts</dt>
                  <dd className="mono">
                    {last.llmMs.map((x) => fmtMs(x)).join(" + ")} · {last.attempts}
                  </dd>
                </div>
                <div>
                  <dt>Think harder</dt>
                  <dd>{last.deep ? "on" : "off"}</dd>
                </div>
                <div>
                  <dt>Tokens · cost</dt>
                  <dd className="mono">
                    {last.inputTokens}/{last.outputTokens} · {fmtUsd(last.costUsd)}
                  </dd>
                </div>
                <div>
                  <dt>Voice</dt>
                  <dd>{last.tts.provider ? `${last.tts.voice ?? "default"} · ${LANGUAGES[last.language].label}` : (last.tts.note ?? "—")}</dd>
                </div>
                <div>
                  <dt>Quote check</dt>
                  <dd>{last.clientCheck}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="footnote">First audio is measured at the start of speech synthesis, not at the speaker.</p>
        </Tile>
      </div>
    </main>
  );
}
