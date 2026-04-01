import { consumeZipDownload } from "@/lib/upload-download-cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return new NextResponse("token이 필요합니다.", { status: 400 });
  }
  const buffer = consumeZipDownload(token);
  if (!buffer) {
    return new NextResponse("만료되었거나 잘못된 다운로드 링크입니다. 다시 업로드해 주세요.", {
      status: 404,
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="alt-ocr-injected.zip"',
      "Cache-Control": "no-store",
    },
  });
}
