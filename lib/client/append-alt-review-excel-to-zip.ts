"use client";

import type JSZip from "jszip";
import {
  buildAltReviewDeliverableExcel,
  rowsForAltReviewDeliverableExcel,
} from "@/lib/build-alt-review-deliverable-excel";

export type DeliverableExcelItemInput = {
  name: string;
  url: string;
  extractedText: string;
  excludedFromTarget: boolean;
};

/** ZIP 산출물에 엑셀 파일을 추가합니다. (기본 파일명: alt-accessibility-deliverable.xlsx) */
export async function appendAltReviewExcelToJsZip(
  zip: JSZip,
  items: DeliverableExcelItemInput[],
  xlsxPath = "alt-accessibility-deliverable.xlsx",
): Promise<void> {
  const rows = await rowsForAltReviewDeliverableExcel(items);
  const ab = await buildAltReviewDeliverableExcel(rows);
  zip.file(xlsxPath, ab);
}

/** 엑셀만 단독으로 내려받습니다. */
export async function downloadAltReviewExcelFile(
  items: DeliverableExcelItemInput[],
  filename = `alt-accessibility-deliverable-${new Date().toISOString().slice(0, 10)}.xlsx`,
): Promise<void> {
  const rows = await rowsForAltReviewDeliverableExcel(items);
  const ab = await buildAltReviewDeliverableExcel(rows);
  const blob = new Blob([ab], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
