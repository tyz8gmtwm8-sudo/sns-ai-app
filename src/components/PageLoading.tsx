// 画面を切り替えている間に出す表示（loading.tsx から使う）
export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-stone-500" role="status">
      <span className="spinner h-8 w-8 border-[3px]" aria-hidden />
      <p className="text-sm">読み込み中…</p>
    </div>
  );
}
