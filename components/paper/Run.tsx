/** 柱：頁面頂端的書眉，印刷帳簿的 running header。 */
export function Run({ label }: { label: string }) {
  return (
    <div className="run">
      <b>家計簿</b>
      <span>{label}</span>
    </div>
  );
}
