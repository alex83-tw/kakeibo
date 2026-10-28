import { Hint } from "@/components/paper/Hint";
import { Run } from "@/components/paper/Run";
import { sendLoginLink } from "./actions";

const MESSAGES: Record<string, string> = {
  email: "Email 格式不正確。",
  send: "寄不出登入連結。請確認這個 Email 已註冊，稍後再試。",
  link: "連結已失效，請重新寄一封。",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <div className="page">
      <main className="sheet">
        <Run label="家計簿　登入" />
        <div className="rows">
          {sent ? (
            <Hint>已寄出登入連結。請到信箱點連結，回到這裡就會登入。</Hint>
          ) : (
            <form action={sendLoginLink}>
              <label className="r" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" autoComplete="email" required className="r" />
              {error ? (
                <p className="r hint" role="alert">
                  {MESSAGES[error] ?? "登入失敗。"}
                </p>
              ) : null}
              <button type="submit" className="btn">
                寄登入連結
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
