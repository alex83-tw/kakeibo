import { csvTemplate } from "@/lib/domain/csv";

/** Static: no data behind it, so it needs no sign-in. */
export function GET() {
  return new Response(`\uFEFF${csvTemplate()}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kakeibo-template.csv"',
    },
  });
}
