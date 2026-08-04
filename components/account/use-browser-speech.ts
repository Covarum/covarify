"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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

export type VoiceTranscriptMeta = { confidence: number | null };
export type VoiceTranscriptOutcome = "added" | "applied" | "no_op" | "replaced" | "held" | "held_merchant";

export function useBrowserSpeech({ onFinalTranscript, stopSpeaking }: { onFinalTranscript: (transcript: string, meta: VoiceTranscriptMeta) => VoiceTranscriptOutcome; stopSpeaking: () => void }) {
  const supported = useSyncExternalStore(subscribeToBrowserCapability, () => Boolean(recognitionConstructor()), () => false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Microphone off. You can type at any time.");
  const recognitionRef = useRef<SpeechRecognizer | null>(null);
  const finalTranscriptReceivedRef = useRef(false);
  const recognitionFailedRef = useRef(false);
  const suppressEndStatusRef = useRef(false);

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
        finalTranscriptReceivedRef.current = true;
        const outcome = onFinalTranscript(transcript, { confidence });
        setStatus(outcome === "applied" ? "Final transcript added, normalized, and recorded for this preview." : outcome === "no_op" ? "Final transcript matches the current amount; no change or undo history was added." : outcome === "replaced" ? "Final transcript replaced the prior unsubmitted voice attempt." : outcome === "held_merchant" ? "Final transcript added and held for review because the merchant could not be confirmed." : outcome === "held" ? "Final transcript added and held for review." : "Final transcript added to the Message draft.");
      }
    };
    recognition.onerror = (event) => {
      recognitionFailedRef.current = true;
      setListening(false);
      if (finalTranscriptReceivedRef.current) return;
      setStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone access was denied. No final transcript was added; your draft is unchanged." : "Voice recognition failed before a usable final transcript was added. Your draft is unchanged.");
    };
    recognition.onend = () => { setListening(false); if (suppressEndStatusRef.current) { suppressEndStatusRef.current = false; return; } if (!finalTranscriptReceivedRef.current && !recognitionFailedRef.current) setStatus("Recognition ended without a final transcript. Your draft is unchanged."); };
    recognitionRef.current = recognition;
    return () => { recognition.abort?.(); recognitionRef.current = null; };
  }, [onFinalTranscript]);

  const resetActiveTurn = useCallback(() => {
    suppressEndStatusRef.current = true;
    recognitionRef.current?.abort?.();
    finalTranscriptReceivedRef.current = false;
    recognitionFailedRef.current = false;
    setListening(false);
    setStatus("Microphone ready for a new turn. You can type at any time.");
  }, []);

  const start = useCallback(() => {
    stopSpeaking();
    const recognition = recognitionRef.current;
    if (!recognition) { setStatus("Voice recognition is unavailable in this browser. Keep typing."); return; }
    try { finalTranscriptReceivedRef.current = false; recognitionFailedRef.current = false; recognition.start(); setListening(true); setStatus("Listening. Select Stop microphone when you are finished."); }
    catch { setStatus("Voice recognition could not start. Your draft is unchanged; keep typing."); }
  }, [stopSpeaking]);
  const stop = useCallback(() => { recognitionRef.current?.stop(); setListening(false); setStatus("Microphone stopped. Review the transcript before sending."); }, []);

  return { supported, listening, status, start, stop, resetActiveTurn };
}
