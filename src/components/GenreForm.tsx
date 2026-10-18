// ジャンル選択フォーム（S-02と設定画面で共通）
import { ActionForm } from "./ActionForm";
import { saveGenres } from "@/app/actions/account";
import { GENRES } from "@/lib/constants";
import { SubmitButton } from "@/components/SubmitButton";

type Props = { name: string | null; selected: string[]; other: string | null; next: string };

export function GenreForm({ name, selected, other, next }: Props) {
  return (
    <ActionForm action={saveGenres} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="name">このアカウントの呼び名（切り替えメニューに表示）</label>
        <input id="name" name="name" className="input" defaultValue={name ?? ""} placeholder="例：グルメ、旅行vlog（空欄ならジャンル名を表示）" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GENRES.map((g) => (
          <label
            key={g}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm has-[:checked]:border-stone-900 has-[:checked]:bg-stone-50"
          >
            <input type="checkbox" name="genres" value={g} defaultChecked={selected.includes(g)} />
            {g}
          </label>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="genre_other">「その他」を選んだ場合の内容</label>
        <input id="genre_other" name="genre_other" className="input" defaultValue={other ?? ""} placeholder="例：ペット、インテリア" />
      </div>
      <SubmitButton className="btn">保存して次へ</SubmitButton>
    </ActionForm>
  );
}
