import ExcelJS from "exceljs";

/** ZIP/아카이브 기준 첫 경로 세그먼트(보통 압축 파일명) 제거 */
function stripArchivePrefix(name: string): string {
  const n = name.replace(/\\/g, "/").trim();
  const i = n.indexOf("/");
  if (i === -1) return n;
  return n.slice(i + 1);
}

function packageHasImgFolder(names: string[]): boolean {
  return names.some((name) => {
    const rel = stripArchivePrefix(name).toLowerCase();
    return rel.startsWith("img/") || rel.includes("/img/");
  });
}

/**
 * C3 규칙: 패키지에 img 폴더가 있으면 `img/파일명`, 이미 경로에 img/가 있으면 그 이하만,
 * 없으면 파일명만.
 */
export function excelDeliverableImagePathLabel(name: string, allNames: string[]): string {
  const rel = stripArchivePrefix(name);
  const hasImg = packageHasImgFolder(allNames);
  const lower = rel.toLowerCase();
  const idx = lower.indexOf("img/");
  if (idx !== -1) return rel.slice(idx);
  const file = rel.split("/").pop() ?? rel;
  if (hasImg) return `img/${file}`;
  return file;
}

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

/** 10cm ≈ 283.46 pt (Excel 행 높이) */
const ROW_IMAGE_HEIGHT_PT = (10 / 2.54) * 72;
/** 앵커 ext 높이(px) — 약 96dpi 기준 10cm */
const IMAGE_EXT_HEIGHT_PX = Math.round((10 / 2.54) * 96);
const IMAGE_EXT_WIDTH_PX = Math.round(IMAGE_EXT_HEIGHT_PX * 0.85);

export type AltReviewDeliverableExcelRow = {
  /** 목록 표시용 경로 (아카이브/상대경로 포함 가능) */
  name: string;
  /** 엑셀에 넣을 래스터 이미지 (png/jpeg/gif). 미지원 형식이면 생략 가능 */
  imageBase64?: string;
  imageExtension?: "png" | "jpeg" | "gif";
  extractedText: string;
  excludedFromTarget: boolean;
};

/**
 * 검수 산출물 엑셀 (양식)
 * - B1~B3: 안내 문구
 * - 4행부터: 항목당 2행 — B 병합(번호), C2=이미지(세로 10cm 행), C3=경로, D 병합=img 태그 전체
 */
export async function buildAltReviewDeliverableExcel(
  rows: AltReviewDeliverableExcelRow[],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("산출물", {
    views: [{ state: "frozen", ySplit: 3, topLeftCell: "B4", activeCell: "B4" }],
  });

  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 28;
  sheet.getColumn(4).width = 72;

  sheet.getCell("B1").value = "No.";
  sheet.getCell("B2").value = "이미지 요소 내 이미지 또는 URL";
  sheet.getCell("B3").value = "작성된 대체텍스트(alt속성이 포함된 이미지 요소의 소스코드)";
  for (const addr of ["B1", "B2", "B3"] as const) {
    const c = sheet.getCell(addr);
    c.font = { bold: true };
    c.alignment = { wrapText: true, vertical: "top" };
  }

  const allNames = rows.map((r) => r.name);
  let excelRow = 4;
  let seq = 0;

  for (const row of rows) {
    seq += 1;
    const rTop = excelRow;
    const rBot = excelRow + 1;

    sheet.mergeCells(`B${rTop}:B${rBot}`);
    sheet.getCell(`B${rTop}`).value = seq;
    sheet.getCell(`B${rTop}`).alignment = { vertical: "middle", horizontal: "center" };

    const pathLabel = excelDeliverableImagePathLabel(row.name, allNames);
    const altText = row.excludedFromTarget ? "" : row.extractedText.trim();
    const tag = buildImgTagForDeliverable(pathLabel, altText);

    sheet.mergeCells(`D${rTop}:D${rBot}`);
    sheet.getCell(`D${rTop}`).value = tag;
    sheet.getCell(`D${rTop}`).alignment = { vertical: "top", horizontal: "left", wrapText: true };
    sheet.getCell(`D${rTop}`).font = { name: "Consolas", size: 10 };

    sheet.getCell(`C${rBot}`).value = pathLabel;
    sheet.getCell(`C${rBot}`).alignment = { vertical: "middle", wrapText: true };

    sheet.getRow(rTop).height = ROW_IMAGE_HEIGHT_PT;
    sheet.getRow(rBot).height = 22;

    const ext = row.imageExtension ?? extensionForExcel(row.name);
    if (row.imageBase64 && ext) {
      const imageId = workbook.addImage({
        base64: row.imageBase64,
        extension: ext,
      });
      sheet.addImage(imageId, {
        tl: { col: 2, row: rTop - 1 },
        ext: { width: IMAGE_EXT_WIDTH_PX, height: IMAGE_EXT_HEIGHT_PX },
      });
    } else {
      sheet.getCell(`C${rTop}`).value = "[이미지 형식 미지원 또는 미리보기 없음]";
      sheet.getCell(`C${rTop}`).alignment = { vertical: "middle", wrapText: true };
      sheet.getCell(`C${rTop}`).font = { italic: true, color: { argb: "FF888888" } };
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

/** blob URL / fetch 가능한 URL에서 행 입력을 만듭니다. */
export async function rowsForAltReviewDeliverableExcel(
  items: Array<{
    name: string;
    url: string;
    extractedText: string;
    excludedFromTarget: boolean;
  }>,
): Promise<AltReviewDeliverableExcelRow[]> {
  const out: AltReviewDeliverableExcelRow[] = [];
  for (const it of items) {
    const ext = extensionForExcel(it.name);
    let imageBase64: string | undefined;
    let imageExtension: "png" | "jpeg" | "gif" | undefined;
    if (ext) {
      try {
        const res = await fetch(it.url);
        if (res.ok) {
          const ab = await res.arrayBuffer();
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
      extractedText: it.extractedText,
      excludedFromTarget: it.excludedFromTarget,
    });
  }
  return out;
}
