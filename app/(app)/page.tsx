import { Head } from "@/components/paper/Head";
import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { TotalLine } from "@/components/paper/TotalLine";
import { currentMonth, dayOfMonth, toKanji, twToday, WEEKDAY_JP, weekdayIndex } from "@/lib/time";

// 暫時的骨架：Task 12 會換成真正的「今日」。
export default function TodayPage() {
  const today = twToday();
  const { month } = currentMonth();
  return (
    <>
      <Run label={`${toKanji(month)}月　今日`} />
      <div className="rows">
        <Head
          month={month}
          title={
            <>
              {toKanji(dayOfMonth(today))}日<span className="wd">{WEEKDAY_JP[weekdayIndex(today)]}曜</span>
            </>
          }
        />
        <TotalLine label="今日支出合計" amount={0} />
        <Hint>資料尚未接上。</Hint>
      </div>
    </>
  );
}
