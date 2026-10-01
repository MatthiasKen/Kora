"use client";

// This fallback must work without the root layout, database, or UI providers.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en-NG">
      <head>
        <title>Kora · A little pause</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          :root { color-scheme: light dark; --page: #fafbfe; --card: #fff; --text: #151b2d; --muted: #5f6b82; --line: #e2e7f0; }
          @media(prefers-color-scheme: dark) { :root { --page: #0c101b; --card: #141a29; --text: #eef2ff; --muted: #a6b0c7; --line: #2a344a; } }
          * { box-sizing: border-box; }
          body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px; background: var(--page); color: var(--text); font: 16px/1.7 system-ui, sans-serif; }
          main { width: 100%; max-width: 470px; border: 1px solid var(--line); background: var(--card); border-radius: 24px; padding: 38px; }
          .wordmark { font-size: 36px; font-weight: 700; letter-spacing: -2px; margin: 0 0 36px; } .wordmark span { color: #3158ed; }
          h1 { font-size: 28px; line-height: 1.25; letter-spacing: -1px; margin: 0 0 14px; }
          p { color: var(--muted); margin: 0 0 26px; }
          button { background: #3158ed; color: #fff; border: 0; border-radius: 10px; font: inherit; font-weight: 600; padding: 13px 24px; cursor: pointer; }
          button:focus-visible { outline: 3px solid #849dff; outline-offset: 4px; }
        `}</style>
      </head>
      <body>
        <main>
          <div className="wordmark">
            kora<span>.</span>
          </div>
          <h1>The store couldn't load.</h1>
          <p>
            We're having trouble loading the store right now. Please try again
            in a moment.
          </p>
          <button onClick={retry}>Try again</button>
        </main>
      </body>
    </html>
  );
}
