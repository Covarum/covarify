"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { transcriptNeedsExplicitReview } from "@/lib/conversation/transcript-review";

type SpeechResult = { isFinal: boolean; 0: { transcript: string; confidence: number } };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognizer = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort?(): void;
};
type SpeechRecognizerConstructor = new () => SpeechRecognizer;

const recognitionConstructor = () => {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as unknown as { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
};
const subscribeToBrowserCapability = () => () => undefined;

export type VoiceTranscriptMeta = { confidence: number | null; reviewRequired: boolean };

export function useBrowserSpeech({ appendTranscript, stopSpeaking }: { appendTranscript: (transcript: string, meta: VoiceTranscriptMeta) => void; stopSpeaking: () => void }) {
  const supported = useSyncExternalStore(subscribeToBrowserCapability, () => Boolean(recognitionConstructor()), () => false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Microphone off. You can type at any time.");
  const recognitionRef = useRef<SpeechRecognizer | null>(null);

  useEffect(() => {
    const Recognition = recognitionConstructor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result.isFinal) continue;
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        const confidence = Number.isFinite(result[0].confidence) ? result[0].confidence : null;
        const reviewRequired = transcriptNeedsExplicitReview(transcript, confidence);
        appendTranscript(transcript, { confidence, reviewRequired });
        setStatus(reviewRequired ? "Transcript added. Review and correct it before sending." : "Transcript added. Review it, then send when ready.");
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      setStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone access was denied. Your draft is unchanged; keep typing." : "Voice recognition stopped without changing your conversation. Keep typing or try again.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => { recognition.abort?.(); recognitionRef.current = null; };
  }, [appendTranscript]);

  const start = useCallback(() => {
    stopSpeaking();
    const recognition = recognitionRef.current;
    if (!recognition) { setStatus("Voice recognition is unavailable in this browser. Keep typing."); return; }
    try { recognition.start(); setListening(true); setStatus("Listening. Select Stop microphone when you are finished."); }
    catch { setStatus("Voice recognition could not start. Your draft is unchanged; keep typing."); }
  }, [stopSpeaking]);
  const stop = useCallback(() => { recognitionRef.current?.stop(); setListening(false); setStatus("Microphone stopped. Review the transcript before sending."); }, []);

  return { supported, listening, status, start, stop };
}
