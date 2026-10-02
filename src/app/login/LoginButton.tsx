"use client";
// Googleログインボタン。押すとGoogleのログイン画面へ移動する
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      // ログイン後に戻ってくる場所
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button className="btn w-full" onClick={login} disabled={loading}>
      {loading ? "移動中…" : "Googleでログイン"}
    </button>
  );
}
