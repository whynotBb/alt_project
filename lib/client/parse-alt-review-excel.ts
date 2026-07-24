import ExcelJS from "exceljs";
import JSZip from "jszip";
import { decode } from "html-entities";
import { normalizeZipRelativePath } from "@/lib/client/resolve-html-img-src";
import { normalizeImportedAltText } from "@/lib/client/normalize-alt-text";

/**
 * 엑셀을 Excel 등 외부 프로그램에서 열어 재저장하면 drawing(이미지) XML의 루트 요소가
 * `xdr:` 네임스페이스 접두사 없이 저장되는 경우가 있다. exceljs의 drawing 파서는
 * 이 접두사를 하드코딩으로 기대하므로 인식에 실패해 파싱 결과가 `undefined`가 되고,
 * `wb.xlsx.load()`가 워크북 레벨/시트 레벨 두 곳 모두에서
 * "Cannot read properties of undefined (reading 'anchors')" 로 죽는다.
 * 이 함수는 셀 텍스트만 필요하므로, 로드 전에 (1) 시트 XML의 이미지 참조와
 * (2) `xl/drawings/` 파트 자체를 제거해 exceljs가 drawing을 아예 파싱하지 않도록 우회한다.
 */
async function stripDrawingReferencesFromXlsx(buf: ArrayBuffer): Promise<ArrayBuffer> {
	try {
		const zip = await JSZip.loadAsync(buf);
		const sheetPaths = Object.keys(zip.files).filter((name) =>
			/^xl\/worksheets\/sheet\d+\.xml$/.test(name),
		);
		let changed = false;
		for (const path of sheetPaths) {
			const file = zip.file(path);
			if (!file) continue;
			const xml = await file.async("string");
			const stripped = xml.replace(/<drawing\b[^>]*\/>/g, "");
			if (stripped !== xml) {
				zip.file(path, stripped);
				changed = true;
			}
		}
		const drawingPaths = Object.keys(zip.files).filter((name) => name.startsWith("xl/drawings/"));
		for (const path of drawingPaths) {
			zip.remove(path);
			changed = true;
		}
		if (!changed) return buf;
		return await zip.generateAsync({ type: "arraybuffer" });
	} catch {
		// 전처리 실패 시 원본 그대로 시도 (실패하면 원래 에러가 그대로 노출됨)
		return buf;
	}
}

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
	const alt = normalizeImportedAltText(decode(altM[2] ?? ""));
	return alt.trim().length > 0 ? alt : "";
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
 * ALT 작성 산출물 엑셀(시트 `Sheet1`, 구버전 `산출물`, 또는 첫 시트)에서
 * C열 경로 → `pathLabelLookupKey` → 대체텍스트(alt) 맵을 만듭니다.
 */
export async function parseAltReviewDeliverableExcel(file: File): Promise<Map<string, string>> {
	const buf = await file.arrayBuffer();
	const sanitized = await stripDrawingReferencesFromXlsx(buf);
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(sanitized);
	const sheet = wb.getWorksheet("Sheet1") ?? wb.getWorksheet("산출물") ?? wb.worksheets[0];
	const map = new Map<string, string>();
	if (!sheet) return map;

	const maxRow = sheet.rowCount || 0;
	/** 본문 표: 신규 양식은 B6=`No.` 다음 7행부터, 구 양식은 3행부터 */
	const b6Header = cellToPlainString(sheet.getCell("B6")).trim();
	let row = b6Header === "No." ? 7 : 3;
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
