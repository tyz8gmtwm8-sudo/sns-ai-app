"use client";
// メニューのリンク。押してから画面が切り替わるまで、横に小さなクルクルを出す
import Link, { useLinkStatus } from "next/link";

function PendingHint() {
  // useLinkStatus：このリンクの移動が終わっていないかどうかが分かるNext.jsの機能
  const { pending } = useLinkStatus();
  // 表示のずれを防ぐため、場所は常に取っておき、見えるかどうかだけを切り替える
  return <span className={`spinner h-3 w-3 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`} aria-hidden />;
}

export function NavLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {children}
      <PendingHint />
    </Link>
  );
}
