import { useEffect, useRef } from "react";

/** Reconcile missed updates after returning to the app or recovering connectivity. */
export function useResumeRefresh(refresh: () => void | Promise<void>) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible") void latest.current();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
}
