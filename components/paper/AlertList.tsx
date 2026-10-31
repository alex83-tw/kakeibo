import { AlertRow } from "@/components/paper/AlertRow";
import { Hint } from "@/components/paper/Hint";
import type { Alert } from "@/lib/domain/alerts";

// 「需處理」只留給真的出事的（超支、對帳有差）；預估與接近預算只是提醒，歸「待確認」。
// 每一種各有自己的籤，一眼分得出是預算、分類、重複、金額還是漏記，不全寫成「待確認」。
const QUESTION_LABEL: Partial<Record<Alert["kind"], string>> = {
  "budget-projected": "預估超支",
  "budget-warning": "接近預算",
  uncategorized: "待分類",
  duplicate: "疑似重複",
  abnormal: "金額異常",
  "missing-recurring": "漏記",
};

export function AlertList({ alerts, monthCloseDue = false, month }: { alerts: Alert[]; monthCloseDue?: boolean; month?: number }) {
  return (
    <>
      {alerts.length > 0 ? (
        alerts.map((a) => (
          <AlertRow
            key={a.kind + a.text}
            tone={a.kind in QUESTION_LABEL ? "question" : "action"}
            label={QUESTION_LABEL[a.kind]}
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
      ) : monthCloseDue ? null : (
        <Hint>目前沒有需要處理的事。</Hint>
      )}
      {monthCloseDue ? (
        <AlertRow tone="question" label="月結" href="/close" actionLabel="去月結">
          <strong>{month ? `${month} 月` : "本月"}</strong> 快結束了，把帳戶對一對、剩下的預算帶到下個月
        </AlertRow>
      ) : null}
    </>
  );
}
