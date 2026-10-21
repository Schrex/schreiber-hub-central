/** Queue acceptance is not provider delivery. Suppression is not queue acceptance. */
export function notificationResult(data: unknown, error: unknown): 'queued' | 'failed' {
  if (error || !data || typeof data !== 'object') return 'failed';
  const result = data as { success?: boolean; queued?: boolean };
  return result.success === true && result.queued === true ? 'queued' : 'failed';
}
