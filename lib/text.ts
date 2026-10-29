/**
 * Fold full-width Latin letters and digits (Ｂｕｒｇｅｒ, １２) to ASCII for display only.
 * Not NFKC: that would also turn the full-width ，。 in zh-TW notes into ASCII punctuation. Stored notes are never rewritten.
 */
export function foldWidth(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
