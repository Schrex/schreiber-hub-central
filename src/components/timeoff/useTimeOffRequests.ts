import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useResumeRefresh } from "@/hooks/useResumeRefresh";
import type { TimeOffRequest } from "@/lib/timeOff";
import { fetchTimeOffRequests } from "./timeOffApi";

/** Loads the viewer's visible requests on mount and again on resume (focus/online/visible). */
export function useTimeOffRequests() {
  const [items, setItems] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { items: rows, error } = await fetchTimeOffRequests();
    if (error) toast.error(error.message);
    setItems(rows);
    setLoading(false);
  }, []);

  useResumeRefresh(reload);
  useEffect(() => { reload(); }, [reload]);

  return { items, loading, reload };
}
