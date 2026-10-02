import { redirect } from "next/navigation";

// トップページはダッシュボードへ（未ログイン・初回設定前はそれぞれの画面へ自動で移動）
export default function Home() {
  redirect("/dashboard");
}
