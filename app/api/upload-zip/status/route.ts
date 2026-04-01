import { NextResponse } from "next/server";
import { getZipJobStatus } from "@/lib/zip-process-job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
	const jobId = new URL(request.url).searchParams.get("jobId");
	if (!jobId) {
		return NextResponse.json({ status: "not_found" }, { status: 400 });
	}

	const state = getZipJobStatus(jobId);
	if (state.status === "not_found") {
		return NextResponse.json({ status: "not_found" }, { status: 404 });
	}
	if (state.status === "complete") {
		return NextResponse.json({ status: "complete", result: state.result });
	}
	return NextResponse.json({ status: state.status });
}
