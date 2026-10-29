import { Missing } from "@/components/paper/Missing";

/** 不在任何路由底下的網址：沒有導覽，自己撐一張紙。 */
export default function RootNotFound() {
  return (
    <div className="solo">
      <main className="pane">
        <Missing />
      </main>
    </div>
  );
}
