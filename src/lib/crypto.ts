// トークンなどの秘密情報を暗号化・復号する（サーバー側専用）
// AES-256-GCM という方式で暗号化する。鍵は環境変数 TOKEN_ENCRYPTION_KEY（32バイトをbase64にしたもの）
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY が設定されていません");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY は32バイト（base64）にしてください");
  return key;
}

/** 文字列を暗号化して「iv.tag.暗号文」の形の文字列にする */
export function encrypt(text: string): string {
  const iv = randomBytes(12); // 毎回変わるランダムな値（同じ文字列でも毎回違う暗号文になる）
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 改ざんされていないかを確かめるための値
  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(".");
}

/** encrypt() で作った文字列を元に戻す */
export function decrypt(payload: string): string {
  const [iv, tag, encrypted] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
