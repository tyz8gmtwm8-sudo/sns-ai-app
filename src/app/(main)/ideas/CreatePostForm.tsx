// 「このネタで投稿を作る」のフォーム（要望の入力つき）
import { createFromIdea } from "@/app/actions/ideas";
import { ActionForm } from "@/components/ActionForm";
import { InstructionInput } from "@/components/InstructionInput";
import { SubmitButton } from "@/components/SubmitButton";

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
      {/* 要望の入力欄は、開いたときだけ表示する（閉じていても、入力した要望は一緒に送られる） */}
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-600 hover:text-stone-900">✏️ 要望を伝える（任意）</summary>
        <div className="mt-2">
          <InstructionInput placeholder="例：リールで、断面を最初に見せたい" chips={CHIPS} />
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton className="btn">このネタで投稿を作る</SubmitButton>
        <span className="text-xs text-stone-500">企画・キャプション・動画構成をまとめて作ります（1〜2分）</span>
      </div>
    </ActionForm>
  );
}
