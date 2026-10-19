"use client";
// レポートを画面に表示したときに、そのレポートを「既読」にする
// （画面を表示しただけで呼ぶため、見た目は何も出さない）
import { useEffect } from "react";
import { markReportRead } from "@/app/actions/reports";

export function MarkRead({ reportId }: { reportId: string }) {
  useEffect(() => {
    markReportRead(reportId);
  }, [reportId]);
  return null;
}
