import {
  ArrowUpRightIcon,
  ArrowsClockwiseIcon,
  BrainIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  FilePdfIcon,
  FilesIcon,
  FileTextIcon,
  GaugeIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  QuestionIcon,
  ScalesIcon,
  SpeakerHighIcon,
  StopIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from "react";
import sampleV1Url from "../../fixtures/manual-v1.pdf?url";
import sampleV2Url from "../../fixtures/manual-v2.pdf?url";
import { spokenAnswer, unverifiedAnswer } from "../core/answerer";
import { askedBack, clarifiedQuestion, whichModel, whichModelQuestion } from "../core/clarify";
import { assumptionPrefix } from "../core/slips";
import { config, DEFAULT_LANGUAGE, LANGUAGES, type Language } from "../core/config";
import { appendTurn, documentSetKey } from "../core/conversation";
import { llmCostUsd, ttsCostUsd } from "../core/cost";
import { ingestPdf, type IngestStage } from "../core/ingest";
import { IngestError } from "../core/limits";
import { heardClarification, lexiconOf, misheardWords } from "../core/heard";
import { groupPassages, type Passage } from "../core/passages";
import { askAbout, closestLabel, documentTopics, topicsFrom } from "../core/topics";
import { relatedEvidence, selectEvidence } from "../core/retriever";
import type { AnswerResult, AnswerStatus, Citation, EvidenceUnit, IndexedDocument, Rect, Turn } from "../core/types";
import { verifyCitations } from "../core/validator";
import { askServer, fetchServerInfo, type ServerInfo } from "./api";
import { PageViewer } from "./PageViewer";
import { pdfjs } from "./pdfjs";
import { deviceVoiceState, loadDeviceVoice, onDeviceVoice, type DeviceVoiceState } from "./deviceVoice";
import { primeAudio, speakAnswer, stopSpeaking, type SpeakInfo, type SpeechTicket, type VoiceMode } from "./tts";
import { speechRecognitionSupported, startRecognition } from "./voice";

type DocStage = "reading" | IngestStage | "ready" | "error";
interface DocEntry {
  key: string;
  filename: string;
  stage: DocStage;
  doc?: IndexedDocument;
  /** The PDF itself, kept in the tab to render a cited page. */
  bytes?: Uint8Array;
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
  tts: {
    provider: string | null;
    voice: string | null;
    model?: string;
    /** WebGPU or WebAssembly, for the on-device voice. */
    backend?: string;
    /** Until the first audio data (first byte, or first sentence synthesized), and the voice service's own share of it. */
    firstByteMs?: number;
    upstreamMs?: number;
    /** On-device voice: synthesis of the first piece itself. */
    synthMs?: number;
    /** Why the hosted voice did not speak and the browser voice did. */
    fallback?: string;
    /** Why nothing was spoken. */
    note?: string;
    chars?: number;
    costUsd?: number;
  };
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
  /** Things the document does talk about, offered when it does not answer the question. */
  topics: string[];
  clientErrors: string[];
  /** The server's ticket to have the answer spoken by the hosted voice; Replay uses it too. */
  speech?: SpeechTicket;
}

type NearbyKind = "related" | "closest";
type ProofKind = "evidence" | NearbyKind;
const PROOF_PREFIX: Record<ProofKind, string> = { evidence: "", related: "Related, not the answer · ", closest: "Closest · " };
const PROOF_NAME: Record<ProofKind, string> = { evidence: "Quote", related: "Related line, not the answer", closest: "Closest passage" };
const PROOF_AREA: Record<ProofKind, string> = { evidence: "Evidence", related: "Related lines, not the answer", closest: "Closest passages" };

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
const statusMeta = (r: AnswerResult) => (r.status === "answered" && r.basis === "inferred" ? INFERRED_META : STATUS_META[r.status]);

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

const VOICE_KEY = "voice";
function readStoredVoice(): VoiceMode {
  try {
    const value = localStorage.getItem(VOICE_KEY);
    return value === "browser" || value === "elevenlabs" || value === "device" ? value : "elevenlabs";
  } catch {
    return "elevenlabs";
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

/** What the Measurements panel and the JSON record about the voice that spoke. */
function voiceMetrics(info: SpeakInfo, text: string): QuestionMetrics["tts"] {
  return {
    provider: info.provider,
    voice: info.voice,
    model: info.model,
    firstByteMs: info.firstByteMs,
    upstreamMs: info.upstreamMs,
    synthMs: info.synthMs,
    fallback: info.fallback,
    chars: text.length,
    backend: info.backend,
    costUsd: info.provider === "ElevenLabs" && info.model ? ttsCostUsd(info.model, text.length) : 0,
  };
}

function voiceLabel(m: QuestionMetrics): string {
  const { provider, voice, fallback, note } = m.tts;
  if (!provider) return note ?? "—";
  const who = [provider === "Browser speech" ? "Browser" : provider, voice ?? "default voice", m.tts.backend, LANGUAGES[m.language].label].filter(Boolean).join(" · ");
  return fallback ? `${who} (instead: ${fallback})` : who;
}

// The colour belongs to the plane, not to the folder: the front plane carries the full tone and each plane behind it
// is one step deeper, so bringing a folder forward brightens it and darkens the one it replaces. A step is a quarter
// of the way to the deep tone for the answer lime (0.086 of oklab lightness) and about the same for the quote sheets;
// the row holds four planes, and the deepest of them still carries its text at 5.6:1.
const plane = (front: string, deep: string, step: number, depth: number) =>
  depth <= 0 ? front : `color-mix(in oklab, ${front} ${Math.max(0, 100 - Math.min(depth, 4) * step)}%, ${deep})`;
const answerShade = (depth: number) => plane("var(--lime)", "#6d7a34", 25, depth);
const sheetShade = (depth: number, tone: "sage" | "dark") =>
  tone === "sage" ? plane("var(--sage)", "#3d5836", 18, depth) : plane("var(--surface-2)", "#0f100e", 30, depth);

const passageLabel = (p: Passage, withFile: boolean) => `${withFile ? `${p.filename} · ` : ""}p.${p.page} · ${p.title}`;

/** A sheet's line ids, compact: "s55–s61" for a run, otherwise the first few. */
function idRange(ids: string[]): string {
  const nums = ids.map((id) => Number(id.split(":s").pop()));
  if (!nums.length || nums.some(Number.isNaN)) return ids.join(", ");
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max - min + 1 === nums.length) return nums.length === 1 ? `s${min}` : `s${min}–s${max}`;
  const shown = nums.slice(0, 3).map((n) => `s${n}`).join(", ");
  return nums.length > 3 ? `${shown} +${nums.length - 3}` : shown;
}

/** Where a stack of sheets comes from: "4 passages · page 1 · 26 lines". */
function stackSummary(passages: Passage[]): string {
  const files = new Set(passages.map((p) => p.documentId)).size;
  const pages = [...new Set(passages.map((p) => p.page))].sort((a, b) => a - b);
  const pageCount = new Set(passages.map((p) => `${p.documentId}#${p.page}`)).size;
  const where = files > 1 ? `${pageCount} pages in ${files} files` : pages.length === 1 ? `page ${pages[0]}` : `pages ${pages.join(", ")}`;
  const lines = passages.reduce((n, p) => n + p.cited.length, 0);
  return `${passages.length} ${passages.length === 1 ? "passage" : "passages"} · ${where} · ${lines} ${lines === 1 ? "line" : "lines"}`;
}

type Tone = "lime" | "coral" | "teal" | "sage" | "dark";

function Tile(props: {
  tone: Tone;
  area: string;
  tab?: ReactNode;
  labelledBy?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
  /** The front of a folder stack: a layer that takes the colour of a folder brought forward. */
  flood?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`tile tone-${props.tone}${props.tab ? " has-tab" : ""}${props.className ? ` ${props.className}` : ""}`}
      style={{ gridArea: props.area, ...props.style }}
      aria-labelledby={props.labelledBy}
      aria-label={props.label}
    >
      {/* The surface and its tab, which carry the tile's shadow between them; the content sits on top of both. */}
      <div className="tile-skin">
        {props.tab && (
          <div className="tile-tab">
            <span className="tile-tab-label">{props.tab}</span>
          </div>
        )}
      </div>
      {props.flood && (
        <span className="tile-flood" aria-hidden>
          <i />
        </span>
      )}
      <div className="tile-body">{props.children}</div>
    </section>
  );
}

interface StackFolder {
  key: string;
  /** Tab content, the same in front and behind: an icon and a short label. */
  tab: ReactNode;
  /** Full label, the tab's tooltip. */
  title: string;
  /** Accessible name of the tab that brings the folder forward. */
  aria: string;
  /** Tab text colour on a dark folder. */
  fg?: string;
}

/** Each filed folder shows this much of its edge above the one in front of it… */
const FOLD_RISE = 3;
/** …and is this much narrower on each side. */
const FOLD_INSET = 8;

/**
 * Folders filed in a fixed order, each tab in its own place in one row. Bringing a folder forward moves it in depth
 * only: nothing moves sideways, and the plane it arrives on is lighter, so it brightens from under its tab across the
 * front. Filed folders are narrower and show a sliver of edge above the one in front; every tab starts on the front
 * tab's top line.
 * The wheel over the tabs scrolls the row without changing the open folder; scrolled past, its tab holds at that edge.
 */
function FolderStack(props: {
  label: string;
  folders: StackFolder[];
  /** The tone of a plane: 0 is the front one. Every folder takes the colour of the plane it stands on. */
  shade: (depth: number) => string;
  front: number;
  /** Absent while the stack is busy: the tabs stay in view but do nothing. */
  onOpen?: (index: number) => void;
  prevLabel: string;
  nextLabel: string;
  extra?: ReactNode;
  /** The front folder: a Tile with `flood` whose tab repeats folders[front].tab. */
  children: ReactNode;
}) {
  const { folders, front, onOpen } = props;
  const n = folders.length;
  const stackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = stackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 800));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tabs side by side: two on a phone, up to four on a desktop.
  const lanes = n < 2 ? 1 : Math.min(n, width < 420 ? 2 : width < 560 ? 3 : 4);
  const maxFirst = Math.max(0, n - lanes);
  // Another folder in front (or another row width) brings its tab into view, moving the row no further than needed.
  const view = `${folders[front]?.key}|${lanes}`;
  const [seen, setSeen] = useState(view);
  if (seen !== view) {
    setSeen(view);
    setOffset((o) => Math.min(Math.max(o, front - lanes + 1, 0), Math.min(front, maxFirst)));
  }
  const first = Math.min(offset, maxFirst);
  const inRow = front >= first && front < first + lanes;
  const frontSlot = inRow ? front - first : front < first ? 0 : lanes - 1;
  let rank = 0;
  const layout = folders.map((f, i) => {
    const slot = i === front ? frontSlot : i - first;
    const shown = i === front || (slot >= 0 && slot < lanes && (inRow || slot !== frontSlot));
    // Depth follows the order of the row, so the nearest filed folder is the next one along.
    const depth = i === front ? 0 : shown ? ++rank : lanes;
    return { f, i, slot: Math.min(Math.max(slot, 0), lanes - 1), shown, depth };
  });

  const laned = lanes > 1;
  const firstRef = useRef(first);
  firstRef.current = first;
  const maxRef = useRef(maxFirst);
  maxRef.current = maxFirst;
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    let accumulated = 0;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      const next = firstRef.current + (delta > 0 ? 1 : -1);
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
  }, [laned]);

  // The front tile is one element whatever folder it shows, so its moves are played here rather than by CSS.
  const committed = useRef({ key: undefined as string | undefined, slot: -1, lanes: 0, left: 0, width: 0, depths: new Map<string, number>() });
  const running = useRef<Animation[]>([]);
  useLayoutEffect(() => {
    const was = committed.current;
    const now = folders[front];
    const moved = was.key !== now?.key || was.slot !== frontSlot || was.lanes !== lanes;
    committed.current = { ...was, key: now?.key, slot: frontSlot, lanes, depths: new Map(layout.map((l) => [l.f.key, l.depth])) };
    if (!moved) return;
    const tile = stackRef.current?.querySelector<HTMLElement>(":scope > .tile");
    const skin = tile?.querySelector<HTMLElement>(":scope > .tile-skin");
    const tab = skin?.querySelector<HTMLElement>(":scope > .tile-tab");
    if (!tile || !skin || !tab) return;
    // Stop what an earlier move left playing; its handlers go first, so they cannot undo this move's colour.
    for (const a of running.current) {
      a.onfinish = null;
      a.oncancel = null;
      a.cancel();
    }
    running.current = [];
    skin.style.removeProperty("--skin-bg");
    const left = tab.offsetLeft;
    const tabWidth = tab.offsetWidth;
    committed.current.left = left;
    committed.current.width = tabWidth;
    if (!was.key || !now || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timing: KeyframeAnimationOptions = { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };
    const el = (target: Element, frames: Keyframe[], fill: FillMode = "none") => {
      const a = target.animate(frames, { ...timing, fill });
      running.current.push(a);
      return a;
    };
    const play = (target: Element, frames: Keyframe[]) => el(target, frames);
    if (was.key === now.key) {
      // The row scrolled: the open folder's tab travels with it.
      if (was.width) play(tab, [{ left: `${was.left}px`, width: `${was.width}px` }, { left: `${left}px`, width: `${tabWidth}px` }]);
      return;
    }
    // Another folder in front: it arrives from the plane it stood on, and the front plane's lighter tone spreads from
    // under its tab — a disc scaled out from there.
    // (A clip-path circle would be simpler, but Chrome's compositor misplaces a px centre while it runs.)
    const depth = Math.min(was.depths.get(now.key) ?? 0, lanes);
    const wave = tile.querySelector<HTMLElement>(":scope > .tile-flood > i");
    if (wave && depth > 0) {
      const x = left + tabWidth / 2;
      const reach = Math.ceil(Math.hypot(Math.max(x, tile.offsetWidth - x), tile.offsetHeight));
      Object.assign(wave.style, { left: `${x - reach}px`, top: `${-reach}px`, width: `${2 * reach}px`, height: `${2 * reach}px` });
      skin.style.setProperty("--skin-bg", props.shade(depth));
      // Held at the end, then dropped in the same frame as the old colour, so the tile never flashes back.
      const wash = el(wave, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(1)", opacity: 1 }], "forwards");
      const settle = () => {
        skin.style.removeProperty("--skin-bg");
        wash.effect = null;
      };
      wash.onfinish = settle;
    }
    // …and a filed one grows its tab down to the front edge (in the first place, out to the left edge as well).
    if (!depth) return;
    if (tab.firstElementChild) play(tab.firstElementChild, [{ transform: `translateY(${(-depth * FOLD_RISE) / 2}px)` }, { transform: "none" }]);
    if (frontSlot === 0) {
      const inset = depth * FOLD_INSET;
      play(tab, [{ left: `${inset}px`, width: `${tabWidth - inset}px` }, { left: "0px", width: `${tabWidth}px` }]);
    }
  });

  const paged = n > lanes;
  return (
    <div className="stack-wrap">
      {(paged || props.extra) && (
        <div className="stack-head">
          {paged && (
            <>
              <span className="mono">
                {front + 1} of {n}
              </span>
              <button type="button" className="icon-btn" onClick={() => onOpen?.(front - 1)} disabled={!onOpen || front === 0} aria-label={props.prevLabel}>
                <CaretLeftIcon weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onOpen?.(front + 1)}
                disabled={!onOpen || front >= n - 1}
                aria-label={props.nextLabel}
              >
                <CaretRightIcon weight="bold" aria-hidden />
              </button>
            </>
          )}
          {props.extra}
        </div>
      )}
      <div
        className="stack"
        ref={stackRef}
        data-laned={laned ? "" : undefined}
        data-front-first={laned && frontSlot === 0 ? "" : undefined}
        style={
          {
            "--lanes": lanes,
            "--front-lane": frontSlot,
            // the row ends where the deepest filed folder's top edge starts to round
            "--row-end": `${Math.max(28, FOLD_INSET * (lanes - 1) + 22)}px`,
          } as CSSProperties
        }
      >
        {laned && (
          <div className="stack-strip" ref={stripRef} role="group" aria-label={props.label}>
            {layout.map(({ f, i, slot, shown, depth }) => {
              const inFront = i === front;
              const inert = inFront || !shown;
              return (
                <div
                  key={f.key}
                  className="fold"
                  data-front={inFront ? "" : undefined}
                  data-hidden={shown ? undefined : ""}
                  data-first={slot === 0 ? "" : undefined}
                  style={
                    {
                      "--slot": slot,
                      "--depth": depth,
                      "--sx": 1 - (2 * FOLD_INSET * depth) / Math.max(width, 1),
                      "--bg": props.shade(depth),
                      "--fg": f.fg,
                    } as CSSProperties
                  }
                >
                  <span className="fold-body" aria-hidden />
                  <button
                    type="button"
                    className="fold-tab"
                    tabIndex={inert ? -1 : undefined}
                    aria-hidden={inert ? true : undefined}
                    disabled={!onOpen}
                    title={f.title}
                    aria-label={f.aria}
                    onClick={() => onOpen?.(i)}
                  >
                    <span className="fold-label">{f.tab}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {props.children}
      </div>
    </div>
  );
}

/** One sheet: a paragraph of the source, its cited lines in focus, the rest quieter, the lines around it dissolving. */
function PassageFolder(props: {
  passage: Passage;
  kind: ProofKind;
  withFile: boolean;
  onOpen?: (from: HTMLElement) => void;
  /** In front of a stack: the sheet's own colour; the stack's head names the kind instead of the tab. */
  stacked?: { bg: string };
}) {
  const { passage: p } = props;
  return (
    <Tile
      tone={props.kind === "evidence" ? "sage" : "dark"}
      area="auto"
      className={`proof-item${props.kind === "related" ? " is-related" : ""}`}
      label={`${PROOF_NAME[props.kind]}, ${p.filename}, page ${p.page}: ${p.title}`}
      style={props.stacked ? ({ "--tile-bg": props.stacked.bg } as CSSProperties) : undefined}
      flood={Boolean(props.stacked)}
      tab={
        <>
          <FileTextIcon weight="bold" aria-hidden />
          <span className="tab-text">
            {props.stacked ? "" : PROOF_PREFIX[props.kind]}
            {passageLabel(p, props.withFile)}
          </span>
        </>
      }
    >
      <div className="passage">
        {p.before && (
          <p className="passage-edge is-before" aria-hidden>
            {p.before}
          </p>
        )}
        {p.lines.map((l, i) =>
          l === null ? (
            <p key={`gap-${i}`} className="passage-gap" aria-hidden>
              ···
            </p>
          ) : (
            <p key={l.id} className={`passage-line${l.cited ? " is-cited" : ""}`}>
              {l.cited ? <mark>{l.text}</mark> : l.text}
            </p>
          ),
        )}
        {p.after && (
          <p className="passage-edge is-after" aria-hidden>
            {p.after}
          </p>
        )}
      </div>
      <div className="passage-foot">
        <span className="mono">{idRange(p.cited)}</span>
        <span>
          {p.cited.length} of {p.total} {p.total === 1 ? "line" : "lines"} quoted
        </span>
        {props.onOpen && (
          <button type="button" className="btn-ghost passage-open" onClick={(e) => props.onOpen?.(e.currentTarget)}>
            Open in page <ArrowUpRightIcon weight="bold" aria-hidden />
          </button>
        )}
      </div>
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

const VOICES: { mode: VoiceMode; label: string }[] = [
  { mode: "browser", label: "Built-in" },
  { mode: "elevenlabs", label: "ElevenLabs" },
  { mode: "device", label: "On device" },
];

function VoiceSwitch(props: { value: VoiceMode; onChange: (mode: VoiceMode) => void; elevenAvailable: boolean }) {
  const index = VOICES.findIndex((v) => v.mode === props.value);
  return (
    <div className="lang voice-switch" role="group" aria-labelledby="voice-pick-label">
      <span className="lang-indicator" style={{ "--i": index } as CSSProperties} aria-hidden />
      {VOICES.map((v) => {
        const off = v.mode === "elevenlabs" && !props.elevenAvailable;
        return (
          <button
            key={v.mode}
            type="button"
            aria-pressed={props.value === v.mode}
            disabled={off}
            title={off ? "This server has no ElevenLabs key" : undefined}
            onClick={() => props.onChange(v.mode)}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/** What the chosen voice costs and where it runs, or how far its download is. */
function voiceHint(mode: VoiceMode, device: DeviceVoiceState, server: ServerInfo | null): string {
  if (mode === "browser") return "Your system's voice · starts at once, free · sounds different on every computer";
  if (mode === "elevenlabs") {
    if (server && !server.voice) return "Not set up on this server · the built-in voice speaks";
    return `${server?.voice ? `${server.voice.name} · ` : ""}neural voice in the cloud · ~0.3 s, about $0.005 an answer`;
  }
  const mb = Math.round(config.deviceVoice.downloadBytes / 1e6);
  switch (device.status) {
    case "idle":
      return `Supertonic 3 in this browser · free · ${mb} MB download, once`;
    case "loading":
      return `Downloading the voice model · ${Math.min(99, Math.floor((100 * device.loaded) / device.total))}% of ${mb} MB · the built-in voice speaks meanwhile`;
    case "ready":
      return device.backend === "WebGPU"
        ? "Supertonic 3 · runs on this device (WebGPU) · free, the audio is made here"
        : "Supertonic 3 · runs on this device without WebGPU, so slowly: several seconds an answer";
    case "failed":
      return `Could not load: ${device.message} · the built-in voice speaks`;
  }
}

export function App() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [history, setHistory] = useState<Turn[]>([]);
  const [language, setLanguage] = useState<Language>(readStoredLanguage);
  const [deep, setDeep] = useState(readStoredDeep);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(readStoredVoice);
  const [device, setDevice] = useState<DeviceVoiceState>(deviceVoiceState);
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
  const [viewer, setViewer] = useState<{
    bytes: Uint8Array;
    filename: string;
    page: number;
    cited: Rect[];
    passage: Rect[];
    opener: HTMLElement | null;
  } | null>(null);

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
  // ElevenLabs needs the server's key; without it the built-in voice speaks.
  const elevenAvailable = serverInfo === null || Boolean(serverInfo.voice);
  const speakMode: VoiceMode = voiceMode === "elevenlabs" && !elevenAvailable ? "browser" : voiceMode;

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
      localStorage.setItem(DEEP_KEY, deep ? "1" : "0");
      localStorage.setItem(VOICE_KEY, voiceMode);
    } catch {
      // storage blocked: the choice lasts for this tab only
    }
  }, [language, deep, voiceMode]);

  // Choosing the on-device voice starts its download; after the first time it loads from the browser's cache.
  useEffect(() => onDeviceVoice(setDevice), []);
  useEffect(() => {
    if (voiceMode === "device") loadDeviceVoice();
  }, [voiceMode]);

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
        update({ stage: "ready", doc, bytes, ingestMs });
        docsRef.current = docsRef.current.concat({ key, filename: file.name, stage: "ready", doc, bytes, ingestMs });
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

  /** Opens the cited page with this passage in focus and its cited lines framed; focus returns to `from` on close. */
  function openPassage(p: Passage, from: HTMLElement) {
    const entry = docsRef.current.find((d) => d.doc?.documentId === p.documentId);
    if (!entry?.doc || !entry.bytes) return;
    const { boxes, units } = entry.doc;
    setViewer({
      bytes: entry.bytes,
      filename: entry.filename,
      page: p.page,
      cited: p.cited.flatMap((id) => boxes[id] ?? []),
      passage: units.filter((u) => u.page === p.page && u.paragraph === p.paragraph).flatMap((u) => boxes[u.id] ?? []),
      // The button itself, not document.activeElement: Safari does not focus a button on click.
      opener: from,
    });
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
    // Recognition mishears words. One of the documents' own words fits what was heard: take it, and say so in the
    // answer. More than one fits: there is nothing to ask the model yet, so ask the listener which word they meant —
    // no call, no cost, and no answer to a question nobody asked.
    const units = ready.flatMap((d) => d.units);
    const heard = misheardWords(question, lexiconOf(units));
    const unsettled = heard.find((h) => h.candidates.length > 1);
    const fix = !unsettled && heard.length === 1 && heard[0]!.candidates.length === 1 ? heard[0]! : null;
    const heardAs = fix ? question.replace(new RegExp(fix.word, "iu"), fix.candidates[0]!) : question;
    // Which model, settled here too. A short reply to a clarifying question ("Model B.") is sent as the question it
    // answers; a question that names no model, where the closest lines differ by model, is asked back without a call.
    const joined = unsettled ? null : clarifiedQuestion(heardAs, turns);
    const asked = joined ?? heardAs;
    const selection = selectEvidence(ready, asked, { history: turns });
    const models = unsettled || joined ? [] : whichModel(asked, turns, units);
    const retrievalMs = performance.now() - submitAt;

    const requestAt = performance.now();
    let result: AnswerResult;
    let speech: SpeechTicket | undefined;
    if (unsettled) {
      result = heardClarification(lang, unsettled, thinkHarder);
    } else if (models.length) {
      result = askedBack(whichModelQuestion(lang, models), thinkHarder, asked);
    } else {
      try {
        ({ speech, ...result } = await askServer({ question: asked, history: turns, evidence: selection.units, language: lang, deep: thinkHarder }));
      } catch (e) {
        setPending(null);
        setPhase("idle");
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
      // The model usually names the assumption itself; when it does not, the lexicon's word is named here instead.
      if (fix && !result.assumed)
        result = { ...result, assumed: fix.candidates[0]!, answer: `${assumptionPrefix(lang, fix.candidates[0]!)} ${result.answer}` };
    }
    const requestMs = performance.now() - requestAt;

    // Defense in depth: re-check every quote (cited or related) against the page text held in this browser.
    const clientErrors = verifyCitations([...result.citations, ...result.related], ready);
    if (clientErrors.length)
      result = { ...result, status: "not_found", basis: "stated", answer: unverifiedAnswer(lang), reason: "", assumed: "", citations: [], related: [] };
    const nearby: AnswerView["nearby"] =
      result.status !== "not_found"
        ? { kind: "closest", lines: [] }
        : result.related.length
          ? { kind: "related", lines: result.related }
          : { kind: "closest", lines: relatedEvidence(selection).map(toCitation) };
    // The suggestions read further down the ranked list than the two lines shown as proof: a heading or a first
    // sentence makes a better thing to offer than the line that merely scored highest.
    const closest = result.status === "not_found" ? topicsFrom([...result.related, ...relatedEvidence(selection, 8).map(toCitation)]) : [];
    // The model's own offer — the documents' word for what was asked about — leads the suggestions when it made one.
    const topics = result.didYouMean ? [result.didYouMean, ...closest.filter((t) => !t.includes(result.didYouMean))].slice(0, 3) : closest;

    const id = Date.now();
    setPending(null);
    setAnswers((list) => [{ id, question, language: lang, result, nearby, topics, clientErrors, speech }, ...list].slice(0, HISTORY_LIMIT));
    setViewIndex(0);
    setProofFront(0);
    setProofExpanded(false);
    setHistory((h) =>
      appendTurn(h, {
        question: asked,
        resolvedQuery: result.resolvedQuery || asked,
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
        costUsd: result.timings.llmMs.length ? llmCostUsd(result.usage) : 0,
        clientCheck: clientErrors.length ? `failed: ${clientErrors.join("; ")}` : "every quote found on its page",
      },
      ...l,
    ]);

    setPhase("speaking");
    const spoken = spokenAnswer(result);
    const patch = (change: Partial<QuestionMetrics>) => setLog((l) => l.map((m) => (m.id === id ? { ...m, ...change } : m)));
    speakAnswer(
      spoken,
      lang,
      {
        onStart: (info) => {
          // First audio: when the first sound is due at the audio output, not when the request left.
          const t = performance.now() + (info.audibleInMs ?? 0);
          patch({
            submitToFirstAudioMs: t - submitAt,
            speechEndToFirstAudioMs: voiceTimes?.speechEndAt ? t - voiceTimes.speechEndAt : undefined,
            tts: voiceMetrics(info, spoken),
          });
        },
        onEnd: () => {
          setPhase((p) => (p === "speaking" ? "idle" : p));
          // A spoken clarification question: listen for the reply right away.
          if (result.status === "needs_clarification" && source === "voice") startListening();
        },
        onSilent: (reason) => patch({ tts: { provider: null, voice: null, note: reason } }),
      },
      { mode: speakMode, ticket: speech },
    );
  }

  function toggleMic() {
    // The answer is spoken seconds later; this tap is what lets the page play sound then.
    primeAudio();
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
    primeAudio();
    setInterim(typed);
    void ask(typed, "text");
    setTyped("");
  }

  function askExample(q: string) {
    primeAudio();
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
    primeAudio();
    setPhase("speaking");
    speakAnswer(spokenAnswer(answer.result), answer.language, { onEnd: () => setPhase((p) => (p === "speaking" ? "idle" : p)) }, { mode: speakMode, ticket: answer.speech });
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
  const viewingEarlier = viewIndex > 0;

  // Answer history, newest first. A question being answered is filed in front at once, and the rest age a shade.
  const pendingTab = (
    <>
      <span className="dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="tab-text">Finding the answer</span>
    </>
  );
  const answerTab = (a: AnswerView) => (
    <>
      {statusMeta(a.result).icon}
      <span className="tab-text" lang={a.language}>
        {a.question}
      </span>
    </>
  );
  const answerFolders: StackFolder[] = [
    ...(pending ? [{ key: "pending", tab: pendingTab, title: pending, aria: `Finding the answer: ${pending}` }] : []),
    ...answers.map((a, i) => ({
      key: String(a.id),
      tab: answerTab(a),
      title: a.question,
      aria: `${i === 0 ? "Latest answer" : "Earlier answer"}: ${a.question}`,
    })),
  ];

  // Before the first question: the sample manual has questions written for it; any other document is read for what it
  // talks about (core/topics.ts). Both are only suggestions — the microphone and the text field take anything.
  const sampleLoaded = readyDocs.length > 0 && readyDocs.every((d) => d.filename.startsWith("manual-v"));
  const openings = {
    sample: sampleLoaded,
    questions: sampleLoaded
      ? EXAMPLES[language]
      : documentTopics(readyDocs.flatMap((d) => d.units)).map((topic) => askAbout(language, topic)),
  };

  // Evidence for the answer in front, one sheet per source paragraph. A not-found answer shows nearby lines, never as proof.
  const proofs = answer?.result.citations ?? [];
  const proofKind: ProofKind = proofs.length ? "evidence" : (answer?.nearby.kind ?? "closest");
  const passages = answer ? groupPassages(proofs.length ? proofs : answer.nearby.lines, readyDocs) : [];
  const proofTone: "sage" | "dark" = proofKind === "evidence" ? "sage" : "dark";
  const multiDoc = new Set(passages.map((p) => p.documentId)).size > 1;
  const frontIndex = Math.min(proofFront, Math.max(0, passages.length - 1));
  const proofFolders: StackFolder[] = passages.map((p) => ({
    key: p.key,
    tab: (
      <>
        <FileTextIcon weight="bold" aria-hidden />
        <span className="tab-text">{passageLabel(p, multiDoc)}</span>
      </>
    ),
    title: passageLabel(p, true),
    aria: `Show ${passageLabel(p, true)}`,
    fg: proofKind === "evidence" ? undefined : proofKind === "related" ? "var(--teal)" : "var(--text-2)",
  }));
  const opener = (p: Passage) =>
    docs.some((d) => d.doc?.documentId === p.documentId && d.bytes) ? (from: HTMLElement) => openPassage(p, from) : undefined;

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

          <div className="voice-pick">
            <span id="voice-pick-label" className="think-label">
              <SpeakerHighIcon weight="bold" aria-hidden /> Voice
            </span>
            <VoiceSwitch value={voiceMode} onChange={setVoiceMode} elevenAvailable={elevenAvailable} />
            {voiceMode === "device" && device.status === "loading" && (
              <span
                className="progress"
                role="progressbar"
                aria-label="Voice model download"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor((100 * device.loaded) / device.total)}
              >
                <span style={{ "--p": Math.min(1, device.loaded / device.total) } as CSSProperties} />
              </span>
            )}
            <span className="think-sub">{voiceHint(voiceMode, device, serverInfo)}</span>
          </div>

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
          <FolderStack
            label="Answers"
            folders={answerFolders}
            shade={answerShade}
            front={pending ? 0 : viewIndex}
            onOpen={pending ? undefined : openAnswer}
            prevLabel="Newer answer"
            nextLabel="Older answer"
          >
            <Tile
              tone="lime"
              area="auto"
              label="Answer"
              className="tile-answer"
              flood
              tab={pending ? pendingTab : answer ? answerTab(answer) : <>No question yet</>}
            >
              <div aria-live="polite">
                {pending ? (
                  <div className="answer-pending">
                    <p className="asked">“{pending}”</p>
                    <p className="answer-text is-muted">{thinkHarder ? "Thinking it through…" : "Reading the document…"}</p>
                  </div>
                ) : answer ? (
                  <div className="answer-result" key={answer.id}>
                    <p className="asked">
                      <span className="asked-status">
                        {statusMeta(answer.result).icon}
                        {statusMeta(answer.result).label}
                      </span>
                      <span lang={answer.language}>“{answer.question}”</span>
                    </p>
                    <p className="answer-text" lang={answer.language}>
                      {answer.result.answer}
                    </p>
                    {answer.result.basis === "inferred" && answer.result.reason && (
                      <p className="why" lang={answer.language}>
                        <span className="why-label">Why</span>
                        <span>{answer.result.reason}</span>
                      </p>
                    )}
                    {/* Nothing answered the question, but something came close: the document's own words, to ask next. */}
                    {answer.result.status === "not_found" && answer.topics.length > 0 && (
                      <div className="nearby">
                        <p className="nearby-label" lang={answer.language}>
                          {closestLabel(answer.language)}
                        </p>
                        <div className="chips">
                          {answer.topics.map((topic) => (
                            <button
                              key={topic}
                              type="button"
                              className="chip"
                              lang={answer.language}
                              disabled={phase === "thinking" || viewingEarlier}
                              onClick={() => {
                                primeAudio();
                                void ask(askAbout(answer.language, topic), "text");
                              }}
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>
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
                    <p className="answer-text">{readyDocs.length ? "Ask about the document." : "Load a manual, then ask."}</p>
                    <p className="asked">{openings.sample ? "Try one of these with the sample manual:" : "This document talks about:"}</p>
                    <div className="chips">
                      {openings.questions.map((q) => (
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

        {/* Proof: one sheet per source paragraph, filed as a stack */}
        {answer && passages.length > 0 && (
          <section className="stack-area proof-area" style={{ gridArea: "proof" }} aria-label={PROOF_AREA[proofKind]} key={answer.id}>
            {proofExpanded ? (
              <>
                <div className="stack-head">
                  <span className="stack-summary">{stackSummary(passages)}</span>
                  <button type="button" className="link-btn" onClick={() => setProofExpanded(false)}>
                    Collapse
                  </button>
                </div>
                <div className="proof">
                  {passages.map((p) => (
                    <PassageFolder key={p.key} passage={p} kind={proofKind} withFile={multiDoc} onOpen={opener(p)} />
                  ))}
                </div>
              </>
            ) : (
              <FolderStack
                label="Passages"
                folders={proofFolders}
                shade={(depth) => sheetShade(depth, proofTone)}
                front={frontIndex}
                onOpen={setProofFront}
                prevLabel="Previous passage"
                nextLabel="Next passage"
                extra={
                  <>
                    <span className="stack-summary">
                      {PROOF_PREFIX[proofKind]}
                      {stackSummary(passages)}
                    </span>
                    {passages.length > 1 && (
                      <button type="button" className="link-btn" onClick={() => setProofExpanded(true)}>
                        Read all {passages.length}
                      </button>
                    )}
                  </>
                }
              >
                <PassageFolder
                  key={passages[frontIndex]!.key}
                  passage={passages[frontIndex]!}
                  kind={proofKind}
                  withFile={multiDoc}
                  onOpen={opener(passages[frontIndex]!)}
                  stacked={{ bg: sheetShade(0, proofTone) }}
                />
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
                  <dd>{voiceLabel(last)}</dd>
                </div>
                {last.tts.firstByteMs !== undefined && (
                  <div>
                    <dt>Voice ready · cost</dt>
                    <dd className="mono">
                      {fmtMs(last.tts.firstByteMs)}
                      {last.tts.synthMs !== undefined && ` (synthesis ${fmtMs(last.tts.synthMs)})`} · {fmtUsd(last.tts.costUsd ?? Number.NaN)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Quote check</dt>
                  <dd>{last.clientCheck}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="footnote">First audio: when the first sound of the answer is due at the audio output (ElevenLabs or on-device voice) or the browser starts speaking (built-in voice), not at the speaker.</p>
        </Tile>
      </div>

      {viewer && <PageViewer {...viewer} onClose={() => setViewer(null)} />}
    </main>
  );
}
