import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Track progress for an async operation. Shows an indeterminate state if the
 * operation is still running after `delayMs` (default 1000ms) and no real
 * percent has been reported. Use for any operation that may exceed ~1 second.
 *
 * Render a <Progress value={progress.value} /> when progress.show is true.
 * Pass value={undefined} for indeterminate; pass a number 0-100 for determinate.
 */
export const useDelayedProgress = (delayMs = 1000) => {
  const [running, setRunning] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [showIndeterminate, setShowIndeterminate] = useState(false);
  const timerRef = useRef<number | null>(null);

  const start = useCallback(() => {
    setRunning(true);
    setPercent(null);
    setShowIndeterminate(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowIndeterminate(true), delayMs);
  }, [delayMs]);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setPercent(null);
    setShowIndeterminate(false);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const show = running && (showIndeterminate || percent !== null);
  // value: number for determinate, undefined for indeterminate
  const value = percent ?? undefined;

  return { running, show, value, setPercent, start, stop };
};
