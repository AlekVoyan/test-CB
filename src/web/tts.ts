// Text-to-speech behind one interface, so a hosted neural voice can be added without touching the app.
import { LANGUAGES, type Language } from "../core/config";

export interface SpeakEvents {
  /** First-audible proxy: the utterance started (not the physical speaker onset). */
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeakHandle {
  provider: string;
  voice: string | null;
}

export interface TtsProvider {
  readonly name: string;
  /** Whether this provider can speak the language in this browser right now. */
  supports(language: Language): boolean;
  speak(text: string, language: Language, events: SpeakEvents): SpeakHandle;
  stop(): void;
}

const hasSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;
const normalizeLang = (lang: string) => lang.replace("_", "-").toLowerCase();

function voicesFor(language: Language): SpeechSynthesisVoice[] {
  const prefix = LANGUAGES[language].locale.slice(0, 2).toLowerCase();
  return window.speechSynthesis.getVoices().filter((v) => normalizeLang(v.lang).startsWith(prefix));
}

function pickVoice(language: Language): SpeechSynthesisVoice | null {
  const locale = LANGUAGES[language].locale.toLowerCase();
  const candidates = voicesFor(language);
  // Local voices start faster than network voices; prefer the exact locale.
  return (
    candidates.find((v) => v.localService && normalizeLang(v.lang) === locale) ??
    candidates.find((v) => v.localService) ??
    candidates[0] ??
    null
  );
}

// Chrome loads the voice list asynchronously; ask early so the first answer finds it.
if (hasSynthesis()) window.speechSynthesis.getVoices();

const BROWSER = "Browser speech";

export const browserSpeech: TtsProvider = {
  name: BROWSER,
  supports(language) {
    if (!hasSynthesis()) return false;
    // An empty list means "not loaded yet", not "no voices": let the browser try.
    return window.speechSynthesis.getVoices().length === 0 || voicesFor(language).length > 0;
  },
  speak(text, language, events) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGES[language].locale;
    const voice = pickVoice(language);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => events.onStart?.();
    utterance.onend = () => events.onEnd?.();
    utterance.onerror = () => events.onEnd?.();
    window.speechSynthesis.speak(utterance);
    return { provider: BROWSER, voice: voice?.name ?? null };
  },
  stop() {
    if (hasSynthesis()) window.speechSynthesis.cancel();
  },
};

/** Preference order. A hosted provider would go in front of the browser one; the browser stays the fallback. */
const PROVIDERS: TtsProvider[] = [browserSpeech];

export type SpeakOutcome = SpeakHandle | { provider: null; voice: null; reason: string };

/** Speaks with the first provider that supports the language. Never throws: without a voice the answer stays text-only. */
export function speakAnswer(text: string, language: Language, events: SpeakEvents): SpeakOutcome {
  for (const provider of PROVIDERS) {
    if (!provider.supports(language)) continue;
    try {
      return provider.speak(text, language, events);
    } catch {
      // try the next provider
    }
  }
  events.onEnd?.();
  return { provider: null, voice: null, reason: `No ${LANGUAGES[language].name} voice in this browser` };
}

export function stopSpeaking(): void {
  for (const provider of PROVIDERS) provider.stop();
}
