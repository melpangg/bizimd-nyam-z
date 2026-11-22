import type { Metadata } from "next";
import ClickEmojis from "./components/click-emojis";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elif & Emre | Bizim Dünyamız",
  description: "Elif ve Emre için küçük, özel bir dünya.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        <div className="corner-doodles" aria-hidden="true">
          <svg className="doodle doodle-top-left" viewBox="0 0 120 120" focusable="false">
            <g fill="#fff1f5" stroke="#e99bb2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="55" cy="36" rx="8" ry="13" />
              <ellipse cx="55" cy="36" rx="8" ry="13" transform="rotate(72 55 49)" />
              <ellipse cx="55" cy="36" rx="8" ry="13" transform="rotate(144 55 49)" />
              <ellipse cx="55" cy="36" rx="8" ry="13" transform="rotate(216 55 49)" />
              <ellipse cx="55" cy="36" rx="8" ry="13" transform="rotate(288 55 49)" />
              <circle cx="55" cy="49" r="5" fill="#ffe59a" />
              <path d="M55 56Q51 76 43 101M46 78Q32 69 29 78Q34 89 48 85M49 90Q62 78 69 84Q66 96 47 98" fill="none" />
              <path d="M83 25c-5-7-15 0 0 12 15-12 5-19 0-12Z" fill="#f3b2c5" />
              <path d="M21 45l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#8ED8F5" stroke="none" />
            </g>
          </svg>
          <svg className="doodle doodle-top-right" viewBox="0 0 120 120" focusable="false">
            <g stroke="#e995ab" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M60 38c-12-17-35-9-33 12 2 24 24 47 33 53 9-6 31-29 33-53 2-21-21-29-33-12Z" fill="#ffe4eb" />
              <path d="M59 40Q44 22 35 32q6 13 23 14M61 40q15-18 24-8-6 13-23 14" fill="#b9dfc2" stroke="#86bd98" />
              <path d="M47 54l2 2m20 1 2 2m-14 8 2 2m13 8 2 2m-25 2 2 2m10 11 2 2" fill="none" stroke="#d77d98" strokeWidth="3" />
              <path d="M20 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#8ED8F5" stroke="none" />
            </g>
          </svg>
          <svg className="doodle doodle-bottom-left" viewBox="0 0 120 120" focusable="false">
            <g stroke="#a9a0d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M58 48c-2-17-21-23-27-12-6 10 5 20 24 20-18 2-28 15-18 23 10 7 22-4 23-21 2 18 15 28 23 18 8-10-4-22-21-24 18-1 27-14 17-22-10-8-22 4-21 21Z" fill="#ece8ff" />
              <path d="M59 39v43m0-29q-12-15-20-10m20 19q13-15 21-10" fill="none" />
              <circle cx="59" cy="60" r="4" fill="#ffe59a" stroke="#d5b86b" />
              <path d="M35 88q-12 10-19 3m19-3q-7 14-17 13" fill="none" stroke="#8abb9a" />
              <path d="M91 33l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#f5bdd0" stroke="none" />
              <path d="M25 35q-7-13-15-3 0 8 15 10 15-2 15-10-8-10-15 3Zm0 7v14" fill="#8ED8F5" />
            </g>
          </svg>
          <svg className="doodle doodle-bottom-right" viewBox="0 0 120 120" focusable="false">
            <g stroke="#e99bb2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M66 53c-7-13-26-8-23 7 2 12 18 22 23 25 5-3 21-13 23-25 3-15-16-20-23-7Z" fill="#ffe6ed" />
              <path d="M31 87c-2-14-17-17-21-8-4 8 4 16 19 16-14 1-21 12-13 18 8 5 16-4 16-17 1 13 12 20 18 12 6-8-3-17-16-18 14-1 21-11 13-17-8-6-16 3-16 14Z" fill="#fff4e6" />
              <circle cx="32" cy="96" r="3.5" fill="#ffd977" stroke="#e6bf67" />
              <path d="M87 88q12 11 20 4m-20-4q7 14 18 13" fill="none" stroke="#8abb9a" />
              <path d="M94 37l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#8ED8F5" stroke="none" />
              <path d="M47 33q-6-10-12-2 0 7 12 8 12-1 12-8-6-8-12 2Zm0 6v8" fill="#f6d5e0" />
            </g>
          </svg>
        </div>
        <ClickEmojis />
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}