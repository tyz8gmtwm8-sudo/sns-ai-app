// Gemini API を呼び出す共通関数（サーバー側専用）
// APIキーは環境変数 GEMINI_API_KEY から読み込み、ブラウザには出さない
import { GoogleGenAI, type Part } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません（.env.local を確認してください）");
  return new GoogleGenAI({ apiKey });
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
  const res = await getClient().models.generateContent({
    model: MODEL,
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
  const res = await getClient().models.generateContent({
    model: MODEL,
    contents: buildContents(opts.prompt, opts.images),
    config: {
      systemInstruction: opts.system,
      tools: [{ googleSearch: {} }],
    },
  });
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
    .filter((s) => s.url);
  return { text: res.text ?? "", sources };
}
