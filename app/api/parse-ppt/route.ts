import { NextResponse } from "next/server";
import { convertPptxToPng } from "pptx-glimpse";

type SlideResult = {
	id: string;
	label: string;
	imageDataUrl: string;
};

type ParsePptResponse =
	| { ok: true; slides: SlideResult[] }
	| { ok: false; message: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse<ParsePptResponse>> {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ ok: false, message: "요청 본문을 읽지 못했습니다." }, { status: 400 });
	}

	const file = formData.get("file");
	if (!(file instanceof File)) {
		return NextResponse.json({ ok: false, message: "PPT 파일을 선택하세요." }, { status: 400 });
	}

	const lower = file.name.toLowerCase();
	if (!lower.endsWith(".pptx")) {
		return NextResponse.json({ ok: false, message: "슬라이드 이미지 렌더링은 .pptx만 지원합니다." }, { status: 400 });
	}

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const pngResults = await convertPptxToPng(buffer);
		const slides: SlideResult[] = pngResults.map((item, idx) => {
			const index = item.slideNumber ?? idx + 1;
			const b64 = item.png.toString("base64");
			return {
				id: `slide-${index}`,
				label: `- ppt ${index}`,
				imageDataUrl: `data:image/png;base64,${b64}`,
			};
		});

		return NextResponse.json({ ok: true, slides });
	} catch (error) {
		console.error("[parse-ppt] parse failed", error);
		return NextResponse.json({ ok: false, message: "PPT 슬라이드 이미지 렌더링에 실패했습니다." }, { status: 500 });
	}
}

