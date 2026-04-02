import ExcelJS from "exceljs";
import { excelDeliverableImagePathLabel } from "@/lib/client/deliverable-image-path-label";

export { excelDeliverableImagePathLabel };

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildImgTagForDeliverable(src: string, alt: string): string {
  return `<img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(alt)}" />`;
}

function extensionForExcel(name: string): "png" | "jpeg" | "gif" | null {
  const lower = name.split(".").pop()?.toLowerCase() ?? "";
  if (lower === "png") return "png";
  if (lower === "jpg" || lower === "jpeg") return "jpeg";
  if (lower === "gif") return "gif";
  return null;
}

/** 96dpi 기준 1cm 픽셀 */
const PX_PER_CM = 96 / 2.54;
/** 이미지가 들어가는 행의 상하 여백(총 2px) */
const IMAGE_ROW_EXTRA_PX = 2;
/** 이미지 배치 미세 조정: x축 +1px */
const IMAGE_X_OFFSET_PX = 1;
/** C열 폭(픽셀) — 이미지 x 오프셋의 열 단위 환산용 */
const IMAGE_COL_WIDTH_PX = 696;
/** 이미지 박스: 세로 최대 10cm, 가로 최대 14cm (세로 10cm일 때 가로가 14cm 넘으면 가로 14cm에 맞춰 세로 축소) */
const MAX_IMAGE_H_PX = 10 * PX_PER_CM;
const MAX_IMAGE_W_PX = 14 * PX_PER_CM;

/** 엑셀 열 너비(문자 단위) ≈ 픽셀 환산 (Calibri 11 기준 근사) */
function pixelsToExcelColumnWidth(px: number): number {
  const w = (px - 5) / 7;
  return Math.max(2, Math.round(w * 100) / 100);
}

/** 표시용 이미지 ext 크기(px) — 비율 유지 */
export function imageDisplayExtentsPx(
  pixelWidth?: number,
  pixelHeight?: number,
): { width: number; height: number } {
  if (!pixelWidth || !pixelHeight || pixelWidth <= 0 || pixelHeight <= 0) {
    const h = Math.round(MAX_IMAGE_H_PX);
    const w = Math.round(Math.min(MAX_IMAGE_W_PX, h * 0.75));
    return { width: w, height: h };
  }
  const ratio = pixelWidth / pixelHeight;
  let h = MAX_IMAGE_H_PX;
  let w = h * ratio;
  if (w > MAX_IMAGE_W_PX) {
    w = MAX_IMAGE_W_PX;
    h = w / ratio;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

/** Excel 행 높이(pt) — 96dpi 픽셀 높이에 맞춤 */
function rowHeightPointsFromPx(px: number): number {
  return (px * 72) / 96;
}

function imageRowHeightPoints(displayHeightPx: number): number {
  return rowHeightPointsFromPx(displayHeightPx);
}

/** 맑은 고딕 — Windows/Excel에서 `Malgun Gothic`으로 인식 */
const FONT_FAMILY = "Malgun Gothic";
const FONT_TITLE: Partial<ExcelJS.Font> = {
  name: FONT_FAMILY,
  size: 12,
  bold: true,
};
const FONT_CONTENT: Partial<ExcelJS.Font> = {
  name: FONT_FAMILY,
  size: 11,
};

const BORDER_THIN_BLACK: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const BORDER_THIN_LIGHT_GRAY: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9D9D9" } },
  left: { style: "thin", color: { argb: "FFD9D9D9" } },
  bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
  right: { style: "thin", color: { argb: "FFD9D9D9" } },
};

function applyBoxBorder(cell: ExcelJS.Cell): void {
  cell.border = BORDER_THIN_BLACK;
}

function applyImageBoxBorder(cell: ExcelJS.Cell): void {
  cell.border = BORDER_THIN_LIGHT_GRAY;
}

const TITLE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};

export type AltReviewDeliverableExcelRow = {
  name: string;
  /** C열 경로 표기가 name 규칙과 다를 때 강제 사용 */
  pathLabel?: string;
  imageBase64?: string;
  imageExtension?: "png" | "jpeg" | "gif";
  /** 원본 픽셀 크기(비율 계산용) */
  imagePixelWidth?: number;
  imagePixelHeight?: number;
  extractedText: string;
  excludedFromTarget: boolean;
};

/**
 * 검수 산출물 엑셀
 * - 2행 B2·C2·D2: 타이틀(노란 배경)
 * - 3행부터: 항목당 2행 — B 병합 번호, C 상단 이미지, C 하단 경로, D 병합 img 태그
 */
export async function buildAltReviewDeliverableExcel(
  rows: AltReviewDeliverableExcelRow[],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("산출물", {
    views: [{ state: "frozen", ySplit: 2, topLeftCell: "A3", activeCell: "B3" }],
  });

  sheet.getColumn(1).width = pixelsToExcelColumnWidth(28);
  sheet.getColumn(2).width = pixelsToExcelColumnWidth(38);
  sheet.getColumn(3).width = pixelsToExcelColumnWidth(696);
  sheet.getColumn(4).width = pixelsToExcelColumnWidth(752);

  sheet.getCell("B2").value = "No.";
  sheet.getCell("C2").value = "이미지 요소 내 이미지 또는 URL";
  sheet.getCell("D2").value = "작성된 대체텍스트(alt속성이 포함된 이미지 요소의 소스코드)";

  for (const addr of ["B2", "C2", "D2"] as const) {
    const c = sheet.getCell(addr);
    c.font = { ...FONT_TITLE };
    c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    c.fill = TITLE_FILL;
    applyBoxBorder(c);
  }

  sheet.getRow(2).height = rowHeightPointsFromPx(28);

  const allNames = rows.map((r) => r.name);
  let excelRow = 3;
  let seq = 0;

  for (const row of rows) {
    seq += 1;
    const rTop = excelRow;
    const rBot = excelRow + 1;

    sheet.mergeCells(`B${rTop}:B${rBot}`);
    const cellB = sheet.getCell(`B${rTop}`);
    cellB.value = seq;
    cellB.font = { ...FONT_CONTENT };
    cellB.alignment = { vertical: "middle", horizontal: "center" };
    applyBoxBorder(cellB);

    const pathLabel = row.pathLabel ?? excelDeliverableImagePathLabel(row.name, allNames);
    const altText = row.excludedFromTarget ? "" : row.extractedText.trim();
    const tag = buildImgTagForDeliverable(pathLabel, altText);

    sheet.mergeCells(`D${rTop}:D${rBot}`);
    const cellD = sheet.getCell(`D${rTop}`);
    cellD.value = tag;
    cellD.font = { ...FONT_CONTENT };
    cellD.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    applyBoxBorder(cellD);

    const cellCPath = sheet.getCell(`C${rBot}`);
    cellCPath.value = pathLabel;
    cellCPath.font = { ...FONT_CONTENT };
    cellCPath.alignment = { vertical: "middle", wrapText: true };
    applyBoxBorder(cellCPath);

    const { width: extW, height: extH } = imageDisplayExtentsPx(row.imagePixelWidth, row.imagePixelHeight);
    const rowImageHeightPx = extH + IMAGE_ROW_EXTRA_PX;
    sheet.getRow(rTop).height = imageRowHeightPoints(rowImageHeightPx);
    sheet.getRow(rBot).height = 22;

    const ext = row.imageExtension ?? extensionForExcel(row.name);
    if (row.imageBase64 && ext) {
      const imageId = workbook.addImage({
        base64: row.imageBase64,
        extension: ext,
      });
      sheet.addImage(imageId, {
        // 이미지 행 높이를 이미지보다 2px 크게 두고, 상단 1px 오프셋으로 세로 가운데 정렬
        tl: {
          col: 2 + IMAGE_X_OFFSET_PX / IMAGE_COL_WIDTH_PX,
          row: rTop - 1 + 1 / rowImageHeightPx,
        },
        ext: { width: extW, height: extH },
      });
      const cellCImg = sheet.getCell(`C${rTop}`);
      cellCImg.font = { ...FONT_CONTENT };
      applyImageBoxBorder(cellCImg);
    } else {
      const cellCImg = sheet.getCell(`C${rTop}`);
      cellCImg.value = "[이미지 형식 미지원 또는 미리보기 없음]";
      cellCImg.alignment = { vertical: "middle", wrapText: true };
      cellCImg.font = { ...FONT_CONTENT, italic: true, color: { argb: "FF888888" } };
      applyImageBoxBorder(cellCImg);
      sheet.getRow(rTop).height = imageRowHeightPoints(Math.round(MAX_IMAGE_H_PX) + IMAGE_ROW_EXTRA_PX);
    }

    excelRow += 2;
  }

  const buf = await workbook.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
}

export function uint8ToBase64(u8: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(u8).toString("base64");
  }
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < u8.length; i += chunk) {
    const sub = u8.subarray(i, Math.min(i + chunk, u8.length));
    for (let j = 0; j < sub.length; j += 1) {
      binary += String.fromCharCode(sub[j]!);
    }
  }
  return btoa(binary);
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

/** blob URL / fetch 가능한 URL에서 행 입력을 만듭니다. */
export async function rowsForAltReviewDeliverableExcel(
  items: Array<{
    name: string;
    url: string;
    finalAlt: string;
    excludedFromTarget: boolean;
  }>,
): Promise<AltReviewDeliverableExcelRow[]> {
  const out: AltReviewDeliverableExcelRow[] = [];
  for (const it of items) {
    if (it.excludedFromTarget) continue;
    const ext = extensionForExcel(it.name);
    let imageBase64: string | undefined;
    let imageExtension: "png" | "jpeg" | "gif" | undefined;
    let imagePixelWidth: number | undefined;
    let imagePixelHeight: number | undefined;
    if (ext) {
      try {
        const res = await fetch(it.url);
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
        /* 이미지 생략 */
      }
    }
    out.push({
      name: it.name,
      imageBase64,
      imageExtension,
      imagePixelWidth,
      imagePixelHeight,
      extractedText: it.finalAlt,
      excludedFromTarget: it.excludedFromTarget,
    });
  }
  return out;
}
