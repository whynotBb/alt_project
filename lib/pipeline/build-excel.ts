import ExcelJS from "exceljs";

export type ExcelRow = {
  imagePath: string;
  ocrText: string;
  altApplied: string;
  note?: string;
};

/**
 * 검수 산출물 엑셀을 생성합니다. Server Action에서 Buffer로 반환하거나 임시 파일로 저장할 수 있습니다.
 */
export async function buildAuditWorkbook(rows: ExcelRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("검수");
  sheet.columns = [
    { header: "이미지 경로", key: "imagePath", width: 40 },
    { header: "OCR 텍스트", key: "ocrText", width: 50 },
    { header: "적용된 alt", key: "altApplied", width: 40 },
    { header: "비고", key: "note", width: 30 },
  ];
  for (const row of rows) {
    sheet.addRow(row);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
