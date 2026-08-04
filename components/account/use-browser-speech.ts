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
export type VoiceTranscriptOutcome = "added" | "replaced" | "held";

export function useBrowserSpeech({ onFinalTranscript, stopSpeaking }: { onFinalTranscript: (transcript: string, meta: VoiceTranscriptMeta) => VoiceTranscriptOutcome; stopSpeaking: () => void }) {
  const supported = useSyncExternalStore(subscribeToBrowserCapability, () => Boolean(recognitionConstructor()), () => false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Microphone off. You can type at any time.");
  const recognitionRef = useRef<SpeechRecognizer | null>(null);
  const finalTranscriptReceivedRef = useRef(false);
  const recognitionFailedRef = useRef(false);

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
        setStatus(outcome === "replaced" ? "Final transcript replaced the prior unsubmitted voice attempt." : outcome === "held" ? "Final transcript added and held for review." : "Final transcript added to the Message draft.");
      }
    };
    recognition.onerror = (event) => {
      recognitionFailedRef.current = true;
      setListening(false);
      setStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone access was denied. No final transcript was added; your draft is unchanged." : finalTranscriptReceivedRef.current ? "Recognition failed after a final transcript was added. Review the Message draft before sending." : "Voice recognition failed before a final transcript was added. Your draft is unchanged.");
    };
    recognition.onend = () => { setListening(false); if (!finalTranscriptReceivedRef.current && !recognitionFailedRef.current) setStatus("Recognition ended without a final transcript. Your draft is unchanged."); };
    recognitionRef.current = recognition;
    return () => { recognition.abort?.(); recognitionRef.current = null; };
  }, [onFinalTranscript]);

  const start = useCallback(() => {
    stopSpeaking();
    const recognition = recognitionRef.current;
    if (!recognition) { setStatus("Voice recognition is unavailable in this browser. Keep typing."); return; }
    try { finalTranscriptReceivedRef.current = false; recognitionFailedRef.current = false; recognition.start(); setListening(true); setStatus("Listening. Select Stop microphone when you are finished."); }
    catch { setStatus("Voice recognition could not start. Your draft is unchanged; keep typing."); }
  }, [stopSpeaking]);
  const stop = useCallback(() => { recognitionRef.current?.stop(); setListening(false); setStatus("Microphone stopped. Review the transcript before sending."); }, []);

  return { supported, listening, status, start, stop };
}
