"use client";
// テキストをクリップボードにコピーするボタン
import { useState } from "react";

export function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-outline px-3 py-1 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "コピーしました" : label}
    </button>
  );
}
