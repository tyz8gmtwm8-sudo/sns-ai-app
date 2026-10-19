"use client";
// 写真を選ぶ欄。点線の枠を押すか、写真をドラッグして落とすと選べる
// 選んだ写真は小さなプレビューで表示して、選べたことがひと目で分かるようにする
import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  id?: string;
  multiple?: boolean;
  hint?: string; // 枠の中に出す補足（例：3枚・合計3.5MBまで）
  what?: string; // 何を選ぶか（例：写真、スクショ）
};

export function FileDrop({ name, id, multiple, hint, what = "写真" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  // 選んだ写真から、プレビュー用の一時的なURLを作る
  const showFiles = (files: FileList | null) => {
    setPreviews((old) => {
      old.forEach((p) => URL.revokeObjectURL(p.url)); // 前のプレビューのURLは片付ける
      return Array.from(files ?? []).map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    });
  };

  // 送信が終わってフォームが空に戻ったら、プレビューも消す
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => showFiles(null);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const selected = previews.length > 0;

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed p-5 text-center transition ${
        dragging
          ? "border-stone-900 bg-stone-100"
          : selected
            ? "border-emerald-400 bg-emerald-50/50"
            : "border-stone-300 bg-stone-50 hover:border-stone-500 hover:bg-stone-100"
      }`}
    >
      {/* 本物のファイル選択欄を枠いっぱいに透明で重ねる（押す・ドラッグして落とす、の両方に対応するため） */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(e) => showFiles(e.target.files)}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={() => setDragging(false)}
      />

      {selected ? (
        <div className="pointer-events-none space-y-2">
          <div className="flex flex-wrap justify-center gap-2">
            {previews.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.url} src={p.url} alt={p.name} className="h-20 w-20 rounded-lg object-cover shadow-sm" />
            ))}
          </div>
          <p className="text-sm font-semibold text-emerald-800">✓ {previews.length}枚選択中</p>
          <p className="text-xs text-stone-500">押すと選び直せます</p>
        </div>
      ) : (
        <div className="pointer-events-none space-y-1">
          <p className="text-3xl" aria-hidden>📷</p>
          <p className="text-sm font-semibold text-stone-800">クリックして{what}を選ぶ</p>
          <p className="text-xs text-stone-500">またはここに{what}をドラッグ{hint ? `（${hint}）` : ""}</p>
        </div>
      )}
    </div>
  );
}
