import { AlertRow } from "@/components/paper/AlertRow";
import { Hint } from "@/components/paper/Hint";
import type { Alert } from "@/lib/domain/alerts";

const QUESTION = ["uncategorized", "duplicate", "abnormal", "missing-recurring"];

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <>
      {alerts.length > 0 ? (
        alerts.map((a) => (
          <AlertRow
            key={a.kind + a.text}
            tone={QUESTION.includes(a.kind) ? "question" : "action"}
            href={a.href}
            preset={a.preset}
            actionLabel={a.actionLabel ?? "查看"}
          >
            <strong>{a.subject}</strong> {a.body}
            {a.emphasis ? (
              <>
                {a.body ? " " : ""}
                <span className="bad">{a.emphasis}</span>
              </>
            ) : null}
          </AlertRow>
        ))
      ) : (
        <Hint>目前沒有需要處理的事。</Hint>
      )}
    </>
  );
}
