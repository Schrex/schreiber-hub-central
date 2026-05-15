/**
 * Format a US phone number as (XXX) XXX-XXXX.
 * Falls back to original input if it doesn't have 10 digits (or 11 starting with 1).
 */
export function formatPhone(input?: string | null): string {
  if (!input) return "";
  const digits = String(input).replace(/\D/g, "");
  let ten = digits;
  if (digits.length === 11 && digits.startsWith("1")) ten = digits.slice(1);
  if (ten.length === 10) {
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  return String(input);
}
