/** A write result that selected the affected rows (`.update(...).select(...)` or `.delete().select(...)`). */
export interface AffectedRowsResult<T> {
  data: T[] | null;
  error: unknown;
}

const NO_ROWS_MESSAGE = "You don't have permission to make this change.";

/**
 * Await a write that selects its affected rows and return them.
 * A database error is rethrown unchanged. Under RLS a refused UPDATE or DELETE matches 0 rows
 * without an error, so an empty result throws `Error(message)` as a permission error.
 */
export async function requireAffectedRows<T>(
  write: PromiseLike<AffectedRowsResult<T>>,
  message = NO_ROWS_MESSAGE,
): Promise<T[]> {
  const { data, error } = await write;
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(message);
  return data;
}
