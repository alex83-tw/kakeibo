import { subLabel } from "@/lib/domain/categories";
import type { MainInventory } from "@/lib/domain/inventory";
import { formatAmount } from "@/lib/money";

/** 目前有哪些科目：主分類一行（筆數、本月有無預算），點開看用過的子科目。唯讀；要改名或合併用下面的表單。 */
export function CategoryList({ title, mains, budgeted }: { title: string; mains: MainInventory[]; budgeted?: Set<string> }) {
  return (
    <>
      <h2 className="sec">{title}</h2>
      <div className="cl">
        {mains.map((m) => {
          const used = m.subs.filter((s) => s.count > 0);
          return (
            <details key={m.main}>
              <summary>
                <span>{m.main}</span>
                <span className="note">
                  {formatAmount(m.count)} 筆{budgeted ? (budgeted.has(m.main) ? "・有預算" : "・未設預算") : ""}
                </span>
              </summary>
              {used.length === 0 ? (
                <p className="note">近 12 個月沒有帳目</p>
              ) : (
                <ul>
                  {used.map((s) => (
                    <li key={s.sub}>
                      <span>{subLabel(s.sub)}</span>
                      <span className="note">{formatAmount(s.count)} 筆</span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          );
        })}
      </div>
    </>
  );
}
