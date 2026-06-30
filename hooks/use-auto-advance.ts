"use client";

import { useEffect } from "react";

export function useAutoAdvance(enabled: boolean, delayMs: number, onAdvance: () => void) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setTimeout(onAdvance, delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, enabled, onAdvance]);
}
