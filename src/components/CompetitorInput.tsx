"use client";
// 競合・参考アカウントを1件ずつ追加・削除できる入力欄（アカウント方針フォームの中で使う）
// 一覧の中身は、隠し項目（hidden）に「スペース区切り」で入れて、今までと同じ形で保存処理に送る
import { useState } from "react";

// 「@tokyo_cafe」や「https://www.instagram.com/tokyo_cafe/」を「tokyo_cafe」にそろえる
function toUsername(text: string) {
  return text
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
}

// Instagramのユーザー名に使える文字（英数字・ピリオド・アンダーバー、30文字まで）
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

export function CompetitorInput({ name, defaultValue }: { name: string; defaultValue: string[] }) {
  const [list, setList] = useState<string[]>(defaultValue);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  function add() {
    // スペースや読点で区切って、まとめて貼り付けても追加できるようにする
    const names = text.split(/[\s,、，]+/).map(toUsername).filter(Boolean);
    if (!names.length) return;
    const invalid = names.find((n) => !USERNAME.test(n));
    if (invalid) {
      setError(`「${invalid}」はユーザー名として使えない文字が入っています（英数字・「.」「_」のみ）`);
      return;
    }
    setList((prev) => [...new Set([...prev, ...names])]);
    setText("");
    setError("");
  }

  // 「＋ 追加」を押し忘れて保存しても消えないよう、入力途中の正しいユーザー名も一緒に送る
  const pending = text.split(/[\s,、，]+/).map(toUsername).filter((n) => USERNAME.test(n));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={[...list, ...pending].join(" ")} />

      {list.length ? (
        <ul className="flex flex-wrap gap-2">
          {list.map((u) => (
            <li key={u} className="flex items-center gap-1 rounded-full border border-stone-300 bg-white py-1 pl-3 pr-1 text-sm">
              <a href={`https://www.instagram.com/${u}/`} target="_blank" rel="noreferrer" className="hover:underline">@{u}</a>
              <button
                type="button"
                onClick={() => setList((prev) => prev.filter((x) => x !== u))}
                className="rounded-full px-2 text-stone-400 hover:bg-stone-100 hover:text-stone-900"
                aria-label={`@${u} を削除`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-stone-500">まだ登録されていません。</p>
      )}

      <div className="flex gap-2">
        <input
          id={name}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Enterキーでフォーム全体が送信されないようにして、追加だけする
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          className="input"
          placeholder="例：@tokyo_cafe"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button type="button" onClick={add} className="btn-outline shrink-0">＋ 追加</button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <p className="text-xs text-stone-500">追加・削除したあとは、下の保存ボタンを押すと反映されます。</p>
    </div>
  );
}
