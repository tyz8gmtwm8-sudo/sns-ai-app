import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // prompts/ フォルダのプロンプトファイルを、デプロイ時にサーバーへ一緒に含める
  outputFileTracingIncludes: {
    "/**": ["./prompts/**/*"],
  },
  experimental: {
    serverActions: {
      // サムネ画像・スクショをアップロードできるよう、送信サイズ上限を4MBにする（Vercelの上限4.5MBより小さく）
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
