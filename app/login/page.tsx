import { Run } from "@/components/paper/Run";
import { signIn } from "./actions";

const MESSAGES: Record<string, string> = {
  email: "Email 格式不正確。",
  password: "請輸入密碼。",
  credentials: "Email 或密碼不正確。",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="page">
      <main className="sheet">
        <Run label="家計簿　登入" />
        <div className="rows">
          <form action={signIn}>
            <label className="r" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required className="r" />
            <label className="r" htmlFor="password">
              密碼
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="r" />
            {error ? (
              <p className="r hint" role="alert">
                {MESSAGES[error] ?? "登入失敗。"}
              </p>
            ) : null}
            <button type="submit" className="btn">
              登入
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
