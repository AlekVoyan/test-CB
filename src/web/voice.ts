// Speech recognition (STT) with the Web Speech API. Speech output lives in tts.ts.

interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onspeechend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => RecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, (new () => RecognitionLike) | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const speechRecognitionSupported = (): boolean => recognitionCtor() !== undefined;

const ERROR_MESSAGES: Record<string, string> = {
  "no-speech": "I didn't hear anything. Tap the microphone and try again.",
  "not-allowed": "Microphone access is blocked. Allow it in the browser settings, or type your question.",
  "service-not-allowed": "Speech recognition is not available in this browser. Type your question instead.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs a network connection.",
  "language-not-supported": "This browser can't recognise speech in the selected language. Type your question instead.",
};

export interface RecognizerHandlers {
  lang: string;
  onInterim(text: string): void;
  onSpeechEnd(): void;
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

/** Starts one recognition session. Returns a stop handle, or null if unsupported. */
export function startRecognition(h: RecognizerHandlers): { stop(): void } | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = h.lang;
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let delivered = false;

  r.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]!;
      const text = result[0].transcript;
      if (result.isFinal && !delivered) {
        delivered = true;
        h.onFinal(text.trim());
        r.stop();
      } else if (!result.isFinal) {
        interim += text;
      }
    }
    if (interim && !delivered) h.onInterim(interim);
  };
  r.onspeechend = () => h.onSpeechEnd();
  r.onerror = (event) => {
    if (event.error === "aborted") return;
    h.onError(ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}`);
  };
  r.onend = () => h.onEnd();
  r.start();
  return { stop: () => r.stop() };
}
