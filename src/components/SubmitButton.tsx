"use client";
// フォームの送信ボタン。送信中はクルクルを出して、押せないようにする
// （useFormStatus：このボタンが入っているフォームが送信中かどうかが分かるReactの機能）
import { useFormStatus } from "react-dom";

type Props = {
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
};

export function SubmitButton({ className, children, disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={disabled || pending} aria-busy={pending} {...rest}>
      {pending && <span className="spinner" aria-hidden />}
      {/* 中身のないボタン（チェックボックス型など）は、送信中はクルクルだけを出す */}
      {children}
    </button>
  );
}
