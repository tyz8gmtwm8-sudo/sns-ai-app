// Gemini API を呼び出す共通関数（サーバー側専用）
// APIキーは環境変数 GEMINI_API_KEY から読み込み、ブラウザには出さない
import { ApiError, GoogleGenAI, type GenerateContentParameters, type Part } from "@google/genai";

// メインのモデル。2026年10月時点で、無料枠で安定して使えたものを選んでいる
// （gemini-flash-latest は混雑・利用上限でほぼ使えず、軽いモデルに切り替わっていた）
// 混雑するようになったら、環境変数 GEMINI_MODEL で別のモデルに変えられる
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
// メインのモデルが混雑しているときに切り替える、軽いモデル
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";

// 1回の呼び出しで返事を待つ上限（ミリ秒）
const REQUEST_TIMEOUT_MS = 45 * 1000;
// やり直しも含めた全体の上限。これを過ぎたら新しくやり直さない（画面の処理時間の上限を超えないため）
const TOTAL_BUDGET_MS = 75 * 1000;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません（.env.local を確認してください）");
  // 1回の呼び出しで返事を待つ時間の上限（これを過ぎたら諦めてやり直す）
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
}

// 少し待ってからやり直せば成功する可能性があるエラー
// 429: 使いすぎ（短時間の回数制限）、500/503: Google側の一時的な不調・混雑、504: Google側の時間切れ
const RETRYABLE_STATUS = [429, 500, 503, 504];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** AI呼び出しのエラー。status にエラー番号（429など）を残しておく */
export class AiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/**
 * Geminiを呼び出す。混雑などで失敗したら、少し待って自動でやり直す。
 * メインのモデルで3回失敗したら、軽いモデルに切り替えてもう一度試す。
 * retryOnQuota を false にすると、429（利用枠オーバー）のときはやり直さない。
 */
async function generate(params: Omit<GenerateContentParameters, "model">, { retryOnQuota = true } = {}) {
  const client = getClient();
  const attempts = [MODEL, MODEL, MODEL, FALLBACK_MODEL];
  const started = Date.now();
  let lastError: unknown;

  for (let i = 0; i < attempts.length; i++) {
    // 時間が残り少ないときは、最後の手段として軽いモデルで1回だけ試す
    const elapsed = Date.now() - started;
    if (i > 0 && elapsed > TOTAL_BUDGET_MS) break;
    const model = i > 0 && elapsed > TOTAL_BUDGET_MS / 2 ? FALLBACK_MODEL : attempts[i];
    try {
      const res = await client.models.generateContent({ ...params, model });
      if (model !== MODEL) console.warn(`軽量モデル(${model})で作成しました`);
      return res;
    } catch (e) {
      lastError = e;
      const timedOut = isTimeout(e);
      const retryable =
        timedOut || (e instanceof ApiError && RETRYABLE_STATUS.includes(e.status) && (retryOnQuota || e.status !== 429));
      if (!retryable) break;
      console.warn(`Gemini一時エラー(${timedOut ? "時間切れ" : (e as ApiError).status})。やり直します（${i + 1}回目）`);
      if (model === FALLBACK_MODEL) break;
      await sleep(1000 * 2 ** i); // 1秒→2秒→4秒と、待つ時間を少しずつ延ばす
    }
  }
  throw toFriendlyError(lastError);
}

/** 返事を待ちきれずに打ち切ったエラーかどうか */
function isTimeout(e: unknown) {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /abort|timeout|timed out/i.test(text);
}

/** Geminiのエラーを、画面に出しても分かりやすい日本語にする */
function toFriendlyError(e: unknown): AiError {
  if (isTimeout(e)) return new AiError("AIの返事に時間がかかりすぎています。少し待ってから、もう一度お試しください。");
  if (e instanceof ApiError) {
    if (e.status === 503 || e.status === 500 || e.status === 504) {
      return new AiError("AIが混み合っています。1〜2分ほど待ってから、もう一度お試しください。", e.status);
    }
    if (e.status === 429) {
      return new AiError("AIの利用回数の上限に達しました。しばらく待ってから、もう一度お試しください。", e.status);
    }
    if (e.status === 400 || e.status === 403) {
      return new AiError("AIの設定に問題があります（APIキーやモデル名を確認してください）。", e.status);
    }
    return new AiError(e.message, e.status);
  }
  return new AiError(e instanceof Error ? e.message : "AIの呼び出しに失敗しました");
}

// 画像をAIに渡すときの形式
export type ImageInput = { mimeType: string; base64: string };

type BaseOptions = {
  system: string; // エージェントの役割（プロンプトファイルの内容）
  prompt: string; // 今回の依頼内容
  images?: ImageInput[];
};

function buildContents(prompt: string, images: ImageInput[] = []) {
  const parts: Part[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }
  return [{ role: "user", parts }];
}

/**
 * JSON形式で答えを返させる。
 * schema（JSON Schema）で「どんな形のJSONを返すか」をAIに指定する。
 */
export async function generateJson<T>(opts: BaseOptions & { schema: object }): Promise<T> {
  const res = await generate({
    contents: buildContents(opts.prompt, opts.images),
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
    },
  });
  const text = res.text;
  if (!text) throw new Error("AIから空の応答が返りました");
  return JSON.parse(text) as T;
}

/**
 * Google検索を使いながら文章で答えを返させる（リサーチAI用）。
 * 参照したWebページの一覧も一緒に返す。
 */
export async function generateWithSearch(opts: BaseOptions) {
  const res = await generate(
    {
      contents: buildContents(opts.prompt, opts.images),
      config: {
        systemInstruction: opts.system,
        tools: [{ googleSearch: {} }],
      },
    },
    // 検索の利用枠が無いときは、やり直しても無駄なのですぐに諦める
    { retryOnQuota: false },
  );
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
    .filter((s) => s.url);
  return { text: res.text ?? "", sources };
}

/** 検索を使わずに、文章で答えを返させる */
export async function generateText(opts: BaseOptions) {
  const res = await generate({
    contents: buildContents(opts.prompt, opts.images),
    config: { systemInstruction: opts.system },
  });
  return res.text ?? "";
}
