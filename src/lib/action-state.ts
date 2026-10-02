// Server Action の結果（エラーや完了メッセージ）を画面に返すための型
import { unstable_rethrow } from "next/navigation";

export type ActionState = { error?: string; message?: string } | null;

/** エラーを画面向けのメッセージに変換する */
export function toErrorState(e: unknown): ActionState {
  // redirect() などNext.jsの内部用の例外は、そのまま投げ直す必要がある
  unstable_rethrow(e);
  console.error(e);
  return { error: e instanceof Error ? e.message : "エラーが発生しました" };
}
