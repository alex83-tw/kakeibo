/**
 * Fold full-width Latin letters and digits (Ｂｕｒｇｅｒ, １２) to ASCII for display only.
 * Not NFKC: that would also turn the full-width ，。 in zh-TW notes into ASCII punctuation. Stored notes are never rewritten.
 */
export function foldWidth(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** Hide the "(Imported)" tag the CSV import left on notes, for display only: `sameEntry` dedupes on the stored notes. */
export function stripImported(s: string): string {
  return s.replace(/\s*[(（]Imported[)）]\s*$/, "");
}

/** "/a/b" from catch-all params. Params arrive decoded, so a segment like "//evil.com" must be re-encoded or the link leaves the origin. */
export function pathOf(segments: string[] | undefined): string {
  return `/${(segments ?? []).map(encodeURIComponent).join("/")}`;
}
