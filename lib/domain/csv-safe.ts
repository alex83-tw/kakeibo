const DANGEROUS = /^[=+\-@\t\r]/;

/** Spreadsheets run a cell that starts with = + - @ as a formula; a leading ' makes it plain text. */
export const formulaGuard = (s: string): string => (DANGEROUS.test(s) ? `'${s}` : s);

/** Undoes formulaGuard on a re-imported file, and only that: a ' in front of an ordinary character is the user's own. */
export const unguard = (s: string): string => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

/** Drops control characters (keeps tab and line breaks out too: a pasted merchant is one line). */
export const stripControl = (s: string): string => s.replace(/[\u0000-\u001f\u007f]/g, "");
