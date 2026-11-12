/** Query-string transforms for DTOs (`@Transform(toBool)` etc.). */

/** "true"/"1" → true, "false"/"0" → false, anything else stays as-is (→ 400). */
export const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === '1' || value === true
    ? true
    : value === 'false' || value === '0' || value === false
      ? false
      : value;

/** "M, L ,XL" → ["M","L","XL"] (also accepts repeated ?sizes=M&sizes=L). */
export const toList = ({ value }: { value: unknown }): string[] | undefined => {
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 30) : undefined;
};
