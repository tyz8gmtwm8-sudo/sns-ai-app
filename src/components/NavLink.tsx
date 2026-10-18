"use client";
// メニューのリンク。押してから画面が切り替わるまで、横に小さなクルクルを出す
// 今開いている画面のリンクは、色を付けて目立たせる
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

function PendingHint() {
  // useLinkStatus：このリンクの移動が終わっていないかどうかが分かるNext.jsの機能
  const { pending } = useLinkStatus();
  // 表示のずれを防ぐため、場所は常に取っておき、見えるかどうかだけを切り替える
  return <span className={`spinner h-3 w-3 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`} aria-hidden />;
}

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string; // 今開いている画面のときに足す見た目
};

export function NavLink({ href, children, className, activeClassName = "" }: Props) {
  // usePathname：今開いている画面のURL（例：/plans/123/materials）
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 ${className ?? ""} ${active ? activeClassName : ""}`}
    >
      {children}
      <PendingHint />
    </Link>
  );
}
