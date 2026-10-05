# Instagram運用AIアプリ

AIエージェントの編集部（編集長・リサーチ・企画・投稿作成・動画構成・分析）が、Instagram運用を手伝うアプリです。
仕様は `Instagram運用AIアプリ 要件定義書.md` を参照してください。

## 技術構成

| 用途 | 技術 |
| --- | --- |
| 画面・サーバー処理 | Next.js 16（App Router） |
| DB・ログイン・画像保存 | Supabase |
| AI | Gemini API（`@google/genai`） |

## フォルダ構成（主なもの）

```
prompts/                  … 各AIエージェントへの指示文（ここを編集するとAIの振る舞いが変わる）
supabase/migrations/      … DBのテーブル定義（SupabaseのSQL Editorで実行）
src/proxy.ts              … 全ページ共通のログイン判定
src/lib/agents/           … 6つのAIエージェント＋ヒアリングAIの関数
src/lib/workflows.ts      … 運用サイクル（編集長AIが各AIを順に呼ぶ処理）
src/app/actions/          … 画面のボタンから呼ばれるサーバー処理（Server Actions）
src/app/(main)/           … ログイン後の画面（ダッシュボード・企画・素材・完成報告・投稿・レポート・設定・通知）
src/app/onboarding/       … 初回設定（ジャンル選択・AIヒアリング）
```

## セットアップ手順

### 1. Supabaseのプロジェクトを作る
1. https://supabase.com にログインし、「New project」でプロジェクトを作成
2. 左メニュー「SQL Editor」を開き、`supabase/migrations/0001_init.sql` の中身を全部貼り付けて「Run」
3. 「Project Settings」→「API Keys」で **Publishable key**、「Data API」などで **Project URL** を確認

### 2. Googleログインを設定する
1. Google Cloud Console（https://console.cloud.google.com）で「OAuth クライアント ID（ウェブアプリケーション）」を作成
   - 「承認済みのリダイレクト URI」に `https://<SupabaseのプロジェクトID>.supabase.co/auth/v1/callback` を追加
2. Supabaseの「Authentication」→「Sign In / Providers」→「Google」を有効にし、クライアントIDとシークレットを入力
3. Supabaseの「Authentication」→「URL Configuration」の「Redirect URLs」に `http://localhost:3000/auth/callback` を追加（デプロイ後は本番URLも追加）

### 3. Gemini APIキーを発行する
https://aistudio.google.com/apikey でAPIキーを作成

### 4. 環境変数を設定して起動する
```bash
cp .env.example .env.local   # ひな形をコピーし、.env.local に値を入れる
npm install                  # 必要なライブラリをインストール
npm run dev                  # 開発サーバーを起動 → http://localhost:3000
```

## 本番環境

- URL：https://sns-ai-app-plum.vercel.app
- `main` ブランチにプッシュすると、Vercelに自動で公開されます
- 毎朝7時台（日本時間）に `/api/cron/daily` が動き、Instagramのデータ取得・レポート作成を行います

## 開発の進み具合

- [x] Day 1：Instagram連携なしで、手入力でサイクルが一周する状態
- [x] 複数アカウント対応（1つのログインでアカウントを切り替え）
- [x] Day 2：スクショ読み取り・メール通知
- [x] Day 2：Instagram連携・競合分析・定期実行
- [x] Day 2：Vercelにデプロイ
