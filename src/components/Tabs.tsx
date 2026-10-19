"use client";
// タブで表示を切り替える（素材の画面の項目、企画一覧の進行中・投稿済みなど）
// 中身はすべて読み込んでおき、見えるかどうかだけを切り替える（入力途中の内容が消えないように）
import { useState } from "react";

type Tab = { key: string; label: string; content: React.ReactNode };

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm transition ${
              active === t.key
                ? "border-stone-900 font-semibold text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key} className="pt-4">
          {t.content}
        </div>
      ))}
    </div>
  );
}
