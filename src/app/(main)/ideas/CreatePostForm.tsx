// 「このネタで投稿を作る」のフォーム（要望の入力つき）
import { createFromIdea } from "@/app/actions/ideas";
import { ActionForm } from "@/components/ActionForm";
import { InstructionInput } from "@/components/InstructionInput";

const CREATE_STEPS = [
  "企画AIがネタと分析の結果を読んでいます…",
  "企画AIが企画をまとめています…",
  "投稿作成AIがキャプション・ハッシュタグを作っています…",
  "動画構成AIがカット割りを作っています…",
  "編集長AIが撮影タスクを整理しています…",
  "もう少しで完成です…",
];
const CHIPS = ["リールで", "カルーセルで", "1枚投稿で", "料理のアップ中心", "季節感を出して"];

export function CreatePostForm({ ideaId }: { ideaId: string }) {
  return (
    <ActionForm action={createFromIdea} className="space-y-2" progressSteps={CREATE_STEPS}>
      <input type="hidden" name="idea_id" value={ideaId} />
      <InstructionInput placeholder="（任意）要望 例：リールで、断面を最初に見せたい" chips={CHIPS} />
      <button className="btn w-full sm:w-auto">このネタで投稿を作る</button>
      <p className="text-xs text-stone-500">企画とキャプション・動画構成をまとめて作ります（1〜2分かかります）。</p>
    </ActionForm>
  );
}
