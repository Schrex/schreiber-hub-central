import { supabase } from "@/integrations/supabase/client";

export type CurrentPosition = {
  user_id: string;
  position_id: string;
  title: string;
  pay_rate: number;
  effective_date: string;
  is_salaried: boolean;
};

/**
 * Fetch each user's *currently effective* position assignment from employee_positions.
 * "Current" = effective_date <= today AND (end_date IS NULL OR end_date >= today).
 * If a user has multiple overlapping rows, the most recent effective_date wins.
 */
export async function fetchCurrentPositions(
  userIds: string[],
): Promise<Map<string, CurrentPosition>> {
  const map = new Map<string, CurrentPosition>();
  if (userIds.length === 0) return map;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("employee_positions")
    .select("user_id, position_id, pay_rate, effective_date, end_date, is_salaried, position:positions(title)")
    .in("user_id", userIds)
    .lte("effective_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("effective_date", { ascending: false });
  if (error || !data) return map;
  for (const row of data) {
    if (map.has(row.user_id)) continue; // first row wins (most recent)
    map.set(row.user_id, {
      user_id: row.user_id,
      position_id: row.position_id,
      title: row.position?.title ?? "Position",
      pay_rate: Number(row.pay_rate ?? 0),
      effective_date: row.effective_date,
      is_salaried: !!row.is_salaried,
    });
  }
  return map;
}
