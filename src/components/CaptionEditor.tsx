"use client";
// キャプションの入力欄＋「店名からお店の情報を差し込む」機能
// 店名で検索 → 候補から選ぶ → 住所・営業時間・インスタなどをキャプションの最後に追加する
// （追加したあと「編集を保存」を押すと保存される）
import { useState, useTransition } from "react";
import { findInstagram, findStores, type InstagramSearchResult } from "@/app/actions/places";
import type { StoreInfo } from "@/lib/places";

// 差し込む項目（チェックを外した項目は入れない）
const ITEMS = [
  { key: "address", label: "住所" },
  { key: "hours", label: "営業時間" },
  { key: "phone", label: "電話番号" },
  { key: "instagram", label: "Instagram" },
  { key: "website", label: "Webサイト" },
  { key: "map", label: "Googleマップ" },
] as const;
type ItemKey = (typeof ITEMS)[number]["key"];

/** お店の情報を、キャプションに入れる文章にする */
function toCaptionBlock(s: StoreInfo, items: Set<ItemKey>, instagram: string) {
  const lines = [`📍${s.name}`];
  if (items.has("address") && s.address) lines.push(`住所：${s.address}`);
  if (items.has("hours") && s.hours.length) lines.push("営業時間：", ...s.hours);
  if (items.has("phone") && s.phone) lines.push(`☎️ ${s.phone}`);
  if (items.has("instagram") && instagram) lines.push(`📷 @${instagram}`);
  if (items.has("website") && s.website) lines.push(`🌐 ${s.website}`);
  if (items.has("map") && s.mapsUrl) lines.push(`🗺 ${s.mapsUrl}`);
  return lines.join("\n");
}

export function CaptionEditor({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [caption, setCaption] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [selected, setSelected] = useState<StoreInfo | null>(null);
  const [items, setItems] = useState<Set<ItemKey>>(new Set(["address", "hours", "instagram"]));
  const [instagram, setInstagram] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  // Geminiでのインスタ探し
  const [igResult, setIgResult] = useState<InstagramSearchResult | null>(null);
  const [igPending, startIgTransition] = useTransition();

  function search() {
    setError("");
    setMessage("");
    setSelected(null);
    // Server Action をボタンから呼ぶときは startTransition の中で呼ぶ
    startTransition(async () => {
      const res = await findStores(query);
      setStores(res.stores ?? []);
      if (res.error) setError(res.error);
    });
  }

  function choose(s: StoreInfo) {
    setSelected(s);
    setInstagram(s.instagram ?? ""); // Googleマップで分かればそれを入れておく（分からなければ手入力）
    setIgResult(null);
  }

  function searchInstagram() {
    if (!selected) return;
    setIgResult(null);
    startIgTransition(async () => {
      setIgResult(await findInstagram({ name: selected.name, address: selected.address, website: selected.website }));
    });
  }

  function toggle(key: ItemKey) {
    setItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function insert() {
    if (!selected) return;
    const block = toCaptionBlock(selected, items, instagram.trim().replace(/^@/, ""));
    // 今のキャプションの最後に、空行をはさんで追加する
    setCaption((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${block}` : block));
    setMessage("キャプションの最後に追加しました。内容を確認して「編集を保存」を押してください。");
    setSelected(null);
    setStores([]);
  }

  return (
    <div className="space-y-3">
      <textarea name={name} rows={22} className="input" value={caption} onChange={(e) => setCaption(e.target.value)} />

      <div className="space-y-2 rounded-lg bg-stone-50 p-3">
        <p className="label">🏪 お店の情報を差し込む（Googleマップから取得）</p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Enterキーで「編集を保存」が押されないようにして、検索だけする
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                search();
              }
            }}
            className="input"
            placeholder="例：〇〇カフェ 渋谷"
          />
          <button type="button" onClick={search} disabled={pending} className="btn-outline shrink-0">
            {pending ? "検索中…" : "検索"}
          </button>
        </div>
        {error && <p className="text-xs text-red-700">⚠️ {error}</p>}
        {message && <p className="text-xs text-emerald-700">{message}</p>}

        {/* 検索結果の候補 */}
        {stores.length > 0 && !selected && (
          <ul className="space-y-1">
            {stores.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => choose(s)} className="w-full rounded-lg border border-stone-200 bg-white p-2 text-left text-sm hover:border-stone-400">
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-stone-500">{s.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 選んだお店：入れる項目を選んで、プレビューを確認してから追加 */}
        {selected && (
          <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex flex-wrap gap-3 text-sm">
              {ITEMS.map((it) => (
                <label key={it.key} className="flex items-center gap-1">
                  <input type="checkbox" checked={items.has(it.key)} onChange={() => toggle(it.key)} />
                  {it.label}
                </label>
              ))}
            </div>
            {items.has("instagram") && (
              <div>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="input"
                  placeholder="お店のInstagram 例：@tokyo_cafe"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {!selected.instagram && (
                  <p className="mt-1 text-xs text-stone-500">Googleマップにはインスタが登録されていませんでした。下のボタンでAIに探してもらうか、分かれば入力してください（空なら入れません）。</p>
                )}
                <button type="button" onClick={searchInstagram} disabled={igPending} className="btn-outline mt-2 text-xs">
                  {igPending ? "AIがGoogle検索で探しています…（10〜30秒）" : "🔍 Geminiでインスタを探す"}
                </button>
                {igResult?.error && <p className="mt-1 text-xs text-red-700">⚠️ {igResult.error}</p>}

                {/* AIが見つけた候補。押すと上の欄に入る */}
                {igResult?.candidates && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-amber-800">
                      ⚠️ AIの検索結果なので、間違っている場合があります。リンクを開いて、お店の公式アカウントか確認してから選んでください。
                    </p>
                    {igResult.candidates.map((c) => (
                      <div key={c.username} className="flex items-start gap-2 rounded-lg border border-stone-200 p-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <a href={`https://www.instagram.com/${c.username}/`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                            @{c.username} ↗
                          </a>
                          {igResult.canVerify && (
                            <span className={`ml-2 badge ${c.profile ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-600"}`}>
                              {c.profile ? "✓ 実在を確認" : "確認できず"}
                            </span>
                          )}
                          {c.profile?.name && <span className="block text-xs text-stone-700">{c.profile.name}</span>}
                          {c.profile?.biography && <span className="block line-clamp-2 text-xs text-stone-500">{c.profile.biography}</span>}
                          {c.reason && <span className="block text-xs text-stone-500">理由：{c.reason}</span>}
                        </div>
                        <button type="button" onClick={() => setInstagram(c.username)} className="btn-outline shrink-0 text-xs">
                          これにする
                        </button>
                      </div>
                    ))}
                    {!igResult.canVerify && (
                      <p className="text-xs text-stone-500">設定画面でInstagram連携をすると、候補のアカウントが本当にあるかも確認できます。</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <pre className="whitespace-pre-wrap rounded bg-stone-50 p-2 text-xs">
              {toCaptionBlock(selected, items, instagram.trim().replace(/^@/, ""))}
            </pre>
            <p className="text-xs text-amber-800">⚠️ 営業時間などはGoogleマップの情報です。古い場合もあるので、お店の公式情報と見比べてください。</p>
            <div className="flex gap-2">
              <button type="button" onClick={insert} className="btn">キャプションに追加</button>
              <button type="button" onClick={() => setSelected(null)} className="btn-outline">候補に戻る</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
