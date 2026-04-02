const OCR_SPACE_URL = "https://api.ocr.space/parse/image";

type OcrSpaceResponse = {
  ParsedResults?: Array<{
    ParsedText?: string | null;
    FileParseExitCode?: number | string | null;
    ErrorMessage?: string | null;
    ErrorDetails?: string | null;
  }>;
  OCRExitCode?: number | string | null;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | null;
  ErrorDetails?: string | null;
};

function mapUploadContentTypeToOcrFiletype(uploadContentType?: string): string | undefined {
  if (!uploadContentType) return undefined;
  const ct = uploadContentType.toLowerCase();

  if (ct.includes("png")) return "PNG";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "JPG";
  if (ct.includes("gif")) return "GIF";
  if (ct.includes("bmp")) return "BMP";
  if (ct.includes("tif") || ct.includes("tiff")) return "TIF";
  if (ct.includes("pdf")) return "PDF";

  return undefined;
}

function normalizeUploadContentType(uploadContentType?: string): string {
  if (!uploadContentType) return "image/png";
  const ct = uploadContentType.toLowerCase();
  if (ct.includes("png")) return "image/png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
  if (ct.includes("gif")) return "image/gif";
  if (ct.includes("bmp")) return "image/bmp";
  if (ct.includes("tif") || ct.includes("tiff")) return "image/tiff";
  if (ct.includes("pdf")) return "application/pdf";
  return "image/png";
}

export async function ocrImageBufferOcrSpace(
  imageBuffer: Buffer,
  opts?: { uploadContentType?: string },
): Promise<string> {
  const key = process.env.OCR_SPACE_API_KEY?.trim();
  if (!key) {
    throw new Error("OCR_SPACE_API_KEY가 설정되어 있지 않습니다.");
  }

  // OCR.space는 language 파라미터로 "kor+eng" 같은 조합을 허용하지 않습니다.
  // (3-letter 단일 코드만 지원) 필요하면 환경변수로 조정합니다.
  const language = (process.env.OCR_SPACE_LANGUAGE?.trim() || "kor").toLowerCase();

  const mimeType = normalizeUploadContentType(opts?.uploadContentType);
  const base64Image = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const filetype = mapUploadContentTypeToOcrFiletype(opts?.uploadContentType);

  const form = new FormData();
  form.set("apikey", key);
  form.set("base64Image", base64Image);
  form.set("language", language);
  form.set("isOverlayRequired", "false");
  if (filetype) form.set("filetype", filetype);

  const res = await fetch(OCR_SPACE_URL, {
    method: "POST",
    body: form,
  });

  const data = (await res.json()) as OcrSpaceResponse;
  if (!res.ok) {
    const msg = data?.ErrorMessage ?? data?.ErrorDetails ?? `OCR.space HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (data?.IsErroredOnProcessing) {
    const msg = data.ErrorMessage ?? data.ErrorDetails ?? "OCR.space 처리 중 오류가 발생했습니다.";
    throw new Error(msg);
  }

  const first = data?.ParsedResults?.[0];
  const text = first?.ParsedText;
  if (typeof text !== "string") return "";
  return text.trim();
}

