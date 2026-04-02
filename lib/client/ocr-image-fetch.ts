export type OcrImageItem = {
  id: string;
  name: string;
  url: string;
};

/** `/api/ocr-image`의 `engine` 필드와 동일 */
export type OcrEngineId = "tesseract" | "google-vision";

const SVG_PLACEHOLDER = "(SVG는 OCR 대상이 아닙니다. 대체텍스트를 직접 입력해 주세요.)";

export async function requestOcrForImageItem(
  item: OcrImageItem,
  engine: OcrEngineId = "tesseract",
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  if (item.name.toLowerCase().endsWith(".svg")) {
    return { ok: true, text: SVG_PLACEHOLDER };
  }

  try {
    const blobRes = await fetch(item.url);
    const blob = await blobRes.blob();

    if (engine === "tesseract") {
      try {
        const { ocrRasterImageBlobWithTesseract } = await import("@/lib/client/tesseract-browser-ocr");
        const text = await ocrRasterImageBlobWithTesseract(blob);
        return { ok: true, text };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Tesseract OCR에 실패했습니다.";
        return { ok: false, message: msg };
      }
    }

    const fileName = item.name.split("/").pop() ?? "image.png";
    const fd = new FormData();
    fd.append("file", blob, fileName);
    fd.append("engine", engine);

    const res = await fetch("/api/ocr-image", { method: "POST", body: fd });
    const data = (await res.json()) as { text?: string; message?: string };

    if (res.ok && typeof data.text === "string") {
      return { ok: true, text: data.text };
    }
    return { ok: false, message: data.message ?? "텍스트 추출에 실패했습니다." };
  } catch {
    return { ok: false, message: "텍스트 추출 요청 중 오류가 났습니다." };
  }
}
