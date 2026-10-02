"use client";
// AI生成中の進捗表示（経過秒数と、今どの段階かのメッセージ）
import { useEffect, useState } from "react";

export function Progress({ steps }: { steps: string[] }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  // 約10秒ごとに次の段階のメッセージへ進める（最後の段階で止まる）
  const step = steps[Math.min(Math.floor(seconds / 10), steps.length - 1)];
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
      <span>{step}</span>
      <span className="ml-auto tabular-nums text-amber-700">{seconds}秒</span>
    </div>
  );
}
