// アカウント方針の入力フォーム（S-03の確認と、S-10設定で共通）
import { ActionForm } from "./ActionForm";
import { savePolicy } from "@/app/actions/account";
import type { Policy } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

const FIELDS: { key: keyof Policy; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: "target", label: "ターゲット", placeholder: "例：20〜30代の女性、休日にカフェ巡りをする人" },
  { key: "region", label: "地域", placeholder: "例：東京・表参道〜渋谷" },
  { key: "purpose", label: "アカウントの目的", placeholder: "例：1年でフォロワー1万人、PR案件を受ける" },
  { key: "worldview", label: "世界観・トーン", placeholder: "例：落ち着いたおしゃれ系、明るく自然光の写真", multiline: true },
  { key: "followers", label: "現在のフォロワー数", placeholder: "例：1200" },
  { key: "post_frequency", label: "投稿頻度", placeholder: "例：今は週1回 → 週3回にしたい" },
  { key: "competitors", label: "競合・参考アカウント（スペース区切り）", placeholder: "例：@tokyo_cafe @gourmet_aoyama" },
  { key: "notes", label: "その他メモ", placeholder: "例：顔出しはしない", multiline: true },
];

export function PolicyForm({ policy, next, submitLabel }: { policy: Policy | null; next: string; submitLabel: string }) {
  const value = (key: keyof Policy) => {
    const v = policy?.[key];
    if (Array.isArray(v)) return v.map((c) => "@" + c).join(" ");
    return v == null ? "" : String(v);
  };
  return (
    <ActionForm action={savePolicy} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label" htmlFor={f.key}>{f.label}</label>
          {f.multiline ? (
            <textarea id={f.key} name={f.key} rows={2} className="input" defaultValue={value(f.key)} placeholder={f.placeholder} />
          ) : (
            <input id={f.key} name={f.key} className="input" defaultValue={value(f.key)} placeholder={f.placeholder} />
          )}
        </div>
      ))}
      <SubmitButton className="btn">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
