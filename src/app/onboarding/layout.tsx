// AIヒアリングはAIの応答待ちがあるため、処理の最大時間を延ばす（秒）
export const maxDuration = 60;

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return children;
}
