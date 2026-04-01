import { randomUUID } from "node:crypto";
import { runZipProcessing } from "@/lib/pipeline/run-zip-job";
import type { ProcessZipResult } from "@/types/process-zip";

type JobRecord = {
	status: "pending" | "processing" | "complete";
	result?: ProcessZipResult;
};

const jobs = new Map<string, JobRecord>();

export type ZipJobPollResponse =
	| { status: "not_found" }
	| { status: "pending" | "processing" }
	| { status: "complete"; result: ProcessZipResult };

export function createZipProcessJob(buffer: Buffer, fileName: string): string {
	const id = randomUUID();
	const rec: JobRecord = { status: "pending" };
	jobs.set(id, rec);

	void (async () => {
		rec.status = "processing";
		try {
			rec.result = await runZipProcessing(buffer, fileName);
		} catch (e) {
			rec.result = {
				ok: false,
				message: e instanceof Error ? e.message : "ZIP 처리 중 오류가 발생했습니다.",
			};
		} finally {
			rec.status = "complete";
		}
	})();

	return id;
}

export function getZipJobStatus(jobId: string): ZipJobPollResponse {
	const rec = jobs.get(jobId);
	if (!rec) return { status: "not_found" };
	if (rec.status === "complete" && rec.result !== undefined) {
		return { status: "complete", result: rec.result };
	}
	return { status: rec.status === "processing" ? "processing" : "pending" };
}
