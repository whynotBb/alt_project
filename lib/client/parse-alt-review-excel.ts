import ExcelJS from "exceljs";
import { decode } from "html-entities";
import { normalizeZipRelativePath } from "@/lib/client/resolve-html-img-src";

/** 엑셀 C열 경로 표기와 이미지 `name` 매칭용 키 */
export function pathLabelLookupKey(pathLabel: string): string {
	const raw = pathLabel.trim();
	if (!raw) return "";
	const noHash = raw.split("#")[0] ?? raw;
	const noQuery = noHash.split("?")[0] ?? noHash;
	let decoded = noQuery;
	try {
		decoded = decodeURIComponent(noQuery);
	} catch {
		/* keep raw */
	}
	return normalizeZipRelativePath(decoded.replace(/^\/+/, ""));
}

function cellToPlainString(cell: ExcelJS.Cell): string {
	const v = cell.value;
	if (v == null) return "";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (typeof v === "object" && v !== null && "richText" in v) {
		const rt = v as ExcelJS.CellRichTextValue;
		return Array.isArray(rt.richText) ? rt.richText.map((t) => t.text).join("") : "";
	}
	if (typeof v === "object" && v !== null && "text" in v && typeof (v as { text?: string }).text === "string") {
		return (v as { text: string }).text;
	}
	return String(v);
}

/**
 * 산출물 엑셀 D열 `<img ... alt="...">` 에서 alt 추출
 */
export function extractAltFromImgTagCell(htmlOrTag: string): string {
	const s = htmlOrTag.trim();
	if (!s) return "";
	const m = s.match(/<img\b[^>]*>/i);
	const tag = m ? m[0] : s;
	const altM = tag.match(/\balt\s*=\s*(["'])([\s\S]*?)\1/i);
	if (!altM) return "";
	return decode(altM[2] ?? "").trim();
}

function extractSrcFromImgTagCell(htmlOrTag: string): string {
	const s = htmlOrTag.trim();
	if (!s) return "";
	const m = s.match(/<img\b[^>]*>/i);
	const tag = m ? m[0] : s;
	const srcM = tag.match(/\bsrc\s*=\s*(["'])([\s\S]*?)\1/i);
	if (!srcM) return "";
	return decode(srcM[2] ?? "").trim();
}

/**
 * ALT 작성 산출물 엑셀(시트 `산출물` 또는 첫 시트)에서
 * C열 경로 → `pathLabelLookupKey` → 대체텍스트(alt) 맵을 만듭니다.
 */
export async function parseAltReviewDeliverableExcel(file: File): Promise<Map<string, string>> {
	const buf = await file.arrayBuffer();
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(buf);
	const sheet = wb.getWorksheet("산출물") ?? wb.worksheets[0];
	const map = new Map<string, string>();
	if (!sheet) return map;

	const maxRow = sheet.rowCount || 0;
	let row = 3;
	while (row <= maxRow) {
		const pathRow = row + 1;
		const pathCell = sheet.getCell(`C${pathRow}`);
		const imgCell = sheet.getCell(`D${row}`);
		const pathRaw = cellToPlainString(pathCell).trim();
		const dRaw = cellToPlainString(imgCell);
		const alt = extractAltFromImgTagCell(dRaw);
		const srcRaw = extractSrcFromImgTagCell(dRaw);
		const srcKey = pathLabelLookupKey(srcRaw);
		if (srcKey) {
			map.set(srcKey, alt);
		}
		const pathKey = pathLabelLookupKey(pathRaw);
		if (pathKey) {
			// C열 경로를 우선키로 간주해 동일 키가 있으면 덮어쓴다.
			map.set(pathKey, alt);
		}
		row += 2;
	}
	return map;
}
