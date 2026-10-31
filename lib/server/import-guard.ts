/** Limits and error mapping shared by the CSV and card-paste importers. Not in a "use server" file: those may only export async functions. */
export const MAX_CHARS = 1_000_000;
export const MAX_ROWS = 5000;

/** Messages starting 檔案 / 一次 are ours to show; anything else becomes a generic failure. */
export function failure(e: unknown): { ok: false; error: string } {
  if (e instanceof Error && e.message === "UNAUTHENTICATED") return { ok: false, error: "請先登入" };
  if (e instanceof Error && (e.message.startsWith("檔案") || e.message.startsWith("一次"))) return { ok: false, error: e.message };
  return { ok: false, error: "處理失敗，請稍後再試" };
}
