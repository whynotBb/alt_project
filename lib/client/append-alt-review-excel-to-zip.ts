"use client";

import type JSZip from "jszip";
import {
  type AltReviewDeliverableExcelRow,
  buildAltReviewDeliverableExcel,
  excelDeliverableImagePathLabel,
  rowsForAltReviewDeliverableExcel,
  uint8ToBase64,
} from "@/lib/build-alt-review-deliverable-excel";
import { normalizeZipRelativePath, resolveImgSrcToZipRelativeKey } from "@/lib/client/resolve-html-img-src";

export type DeliverableExcelItemInput = {
  name: string;
  url: string;
  finalAlt: string;
  excludedFromTarget: boolean;
};

export type DeliverableExcelHtmlInput = {
  relativePath: string;
  content: string;
};

type ResolveRowsOptions = {
  /** true면 OCR/검수 텍스트를 쓰지 않고 HTML img 태그만으로 엑셀 행 생성 */
  preferHtmlTagRows?: boolean;
};

function extensionForExcel(name: string): "png" | "jpeg" | "gif" | null {
  const lower = name.split(".").pop()?.toLowerCase() ?? "";
  if (lower === "png") return "png";
  if (lower === "jpg" || lower === "jpeg") return "jpeg";
  if (lower === "gif") return "gif";
  return null;
}

async function bitmapSizeFromBlob(blob: Blob): Promise<{ w: number; h: number } | null> {
  if (typeof createImageBitmap === "undefined") return null;
  try {
    const bmp = await createImageBitmap(blob);
    const w = bmp.width;
    const h = bmp.height;
    bmp.close();
    if (w > 0 && h > 0) return { w, h };
  } catch {
    /* ignore */
  }
  return null;
}

async function buildRowsFromHtmlAssets(
  htmlAssets: DeliverableExcelHtmlInput[],
  items: DeliverableExcelItemInput[],
): Promise<AltReviewDeliverableExcelRow[]> {
  const itemByNormName = new Map<string, DeliverableExcelItemInput>();
  const allItemNames = items.map((it) => it.name);
  const hasImgFolder = allItemNames.some((n) => {
    const lower = n.replace(/\\/g, "/").toLowerCase();
    return lower.includes("/img/") || lower.startsWith("img/");
  });
  for (const it of items) {
    itemByNormName.set(normalizeZipRelativePath(it.name), it);
  }
  const sorted = [...htmlAssets].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const rows: AltReviewDeliverableExcelRow[] = [];
  for (const html of sorted) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html.content, "text/html");
    const imgs = Array.from(doc.querySelectorAll("img[src]"));
    for (let idx = 0; idx < imgs.length; idx += 1) {
      const img = imgs[idx]!;
      const src = (img.getAttribute("src") ?? "").trim();
      if (!src) continue;
      const altAttr = img.getAttribute("alt");
      // alt 속성이 없거나 값이 비어 있으면 제외
      if (altAttr === null || altAttr.trim().length === 0) continue;
      const resolved = resolveImgSrcToZipRelativeKey(html.relativePath, src);
      const matched = resolved ? itemByNormName.get(resolved) : undefined;
      let imageBase64: string | undefined;
      let imageExtension: "png" | "jpeg" | "gif" | undefined;
      let imagePixelWidth: number | undefined;
      let imagePixelHeight: number | undefined;

      if (matched) {
        const ext = extensionForExcel(matched.name);
        if (ext) {
          try {
            const res = await fetch(matched.url);
            if (res.ok) {
              const blob = await res.blob();
              const dims = await bitmapSizeFromBlob(blob);
              if (dims) {
                imagePixelWidth = dims.w;
                imagePixelHeight = dims.h;
              }
              const ab = await blob.arrayBuffer();
              imageBase64 = uint8ToBase64(new Uint8Array(ab));
              imageExtension = ext;
            }
          } catch {
            /* keep row without image */
          }
        }
      }
      const fallbackFileName = src.split("/").pop() ?? src;
      const pathLabel = matched
        ? excelDeliverableImagePathLabel(matched.name, allItemNames)
        : hasImgFolder
          ? `img/${fallbackFileName}`
          : fallbackFileName;

      rows.push({
        name: matched?.name ?? `${html.relativePath}#img-${idx + 1}`,
        pathLabel,
        imageBase64,
        imageExtension,
        imagePixelWidth,
        imagePixelHeight,
        extractedText: altAttr.trim(),
        excludedFromTarget: false,
      });
    }
  }
  return rows;
}

async function resolveDeliverableRows(
  items: DeliverableExcelItemInput[],
  htmlAssets?: DeliverableExcelHtmlInput[],
  options?: ResolveRowsOptions,
): Promise<AltReviewDeliverableExcelRow[]> {
  if (options?.preferHtmlTagRows) {
    if (!htmlAssets || htmlAssets.length === 0) return [];
    return buildRowsFromHtmlAssets(htmlAssets, items);
  }
  const itemRows = await rowsForAltReviewDeliverableExcel(items);
  if (itemRows.length > 0) return itemRows;
  if (!htmlAssets || htmlAssets.length === 0) return itemRows;
  return buildRowsFromHtmlAssets(htmlAssets, items);
}

/** ZIP 산출물에 엑셀 파일을 추가합니다. (기본 파일명: alt-accessibility-deliverable.xlsx) */
export async function appendAltReviewExcelToJsZip(
  zip: JSZip,
  items: DeliverableExcelItemInput[],
  htmlAssets?: DeliverableExcelHtmlInput[],
  options?: ResolveRowsOptions,
  xlsxPath = "alt-accessibility-deliverable.xlsx",
): Promise<void> {
  const rows = await resolveDeliverableRows(items, htmlAssets, options);
  const ab = await buildAltReviewDeliverableExcel(rows);
  zip.file(xlsxPath, ab);
}

/** 엑셀만 단독으로 내려받습니다. */
export async function downloadAltReviewExcelFile(
  items: DeliverableExcelItemInput[],
  htmlAssets?: DeliverableExcelHtmlInput[],
  options?: ResolveRowsOptions,
  filename = `alt-accessibility-deliverable-${new Date().toISOString().slice(0, 10)}.xlsx`,
): Promise<void> {
  const rows = await resolveDeliverableRows(items, htmlAssets, options);
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
