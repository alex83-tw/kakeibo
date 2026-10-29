"use client";

import "./globals.css";

/** 連 root layout 都壞了：自帶 html／body，字型變數不在，走 CSS 的 fallback 字體。 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error);
  return (
    <html lang="zh-Hant">
      <body>
        <div className="solo">
          <main className="pane">
            <div role="alert">
              <div className="run">
                <b>家計簿</b>
                <span>讀取失敗</span>
              </div>
              <div className="head">
                <h1>讀不到資料</h1>
              </div>
              <button type="button" className="btn" onClick={retry}>
                再試一次
              </button>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
