"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import type { ProcessZipResult } from "@/types/process-zip";
import { UploadResultDashboard } from "@/components/upload-result-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const POST_TIMEOUT_MS = 900_000;
const POLL_INTERVAL_MS = 1500;
const POLL_DEADLINE_MS = 420_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ZipUploadSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<null | "upload" | "process">(null);
  const [result, setResult] = useState<ProcessZipResult | null>(null);
  const isBusy = phase !== null;

  useEffect(() => {
    if (result?.ok && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isBusy) setDragOver(true);
  }, [isBusy]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (isBusy) return;
      const dropped = e.dataTransfer.files?.[0];
      if (!dropped || !inputRef.current) return;
      const dt = new DataTransfer();
      dt.items.add(dropped);
      inputRef.current.files = dt.files;
    },
    [isBusy],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isBusy) return;

    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setResult({ ok: false, message: "ZIP 파일을 선택하거나 드래그해 주세요." });
      return;
    }

    setResult(null);
    setPhase("upload");

    let postTimeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const postController = new AbortController();
      postTimeoutId = setTimeout(() => postController.abort(), POST_TIMEOUT_MS);

      const res = await fetch("/api/upload-zip", {
        method: "POST",
        body: fd,
        signal: postController.signal,
        cache: "no-store",
      });
      if (postTimeoutId) {
        clearTimeout(postTimeoutId);
        postTimeoutId = null;
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setResult({
          ok: false,
          message: "서버 응답을 해석할 수 없습니다. 네트워크나 용량 제한을 확인해 주세요.",
        });
        return;
      }

      if (
        typeof data === "object" &&
        data !== null &&
        "ok" in data &&
        (data as { ok: unknown }).ok === false &&
        "message" in data &&
        typeof (data as { message: unknown }).message === "string"
      ) {
        setResult(data as ProcessZipResult);
        return;
      }

      if (
        res.status !== 202 ||
        typeof data !== "object" ||
        data === null ||
        !("ok" in data) ||
        (data as { ok: unknown }).ok !== true ||
        !("jobId" in data) ||
        typeof (data as { jobId: unknown }).jobId !== "string"
      ) {
        setResult({ ok: false, message: "알 수 없는 응답 형식입니다." });
        return;
      }

      const jobId = (data as { jobId: string }).jobId;
      setPhase("process");

      const pollStarted = Date.now();
      while (Date.now() - pollStarted < POLL_DEADLINE_MS) {
        await sleep(POLL_INTERVAL_MS);
        const stRes = await fetch(`/api/upload-zip/status?jobId=${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        let st: { status?: string; result?: ProcessZipResult };
        try {
          st = (await stRes.json()) as { status?: string; result?: ProcessZipResult };
        } catch {
          setResult({
            ok: false,
            message: "분석 상태 응답을 해석할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          });
          return;
        }
        if (stRes.status === 404 || st.status === "not_found") {
          setResult({
            ok: false,
            message: "분석 작업을 찾을 수 없습니다. 서버가 재시작되었을 수 있습니다.",
          });
          return;
        }
        if (st.status === "complete" && st.result && "ok" in st.result) {
          setResult(st.result);
          return;
        }
      }

      setResult({
        ok: false,
        message:
          "분석이 제한 시간 안에 끝나지 않았습니다. ZIP을 나누거나 이미지 수를 줄인 뒤 다시 시도해 주세요.",
      });
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "AbortError") {
        setResult({
          ok: false,
          message:
            "ZIP 전송 시간이 너무 길어 중단되었습니다. 네트워크를 확인하거나 더 작은 파일로 시도해 주세요.",
        });
        return;
      }
      setResult({
        ok: false,
        message: "업로드 요청이 실패했습니다. 연결을 확인하고 다시 시도해 주세요.",
      });
    } finally {
      if (postTimeoutId) clearTimeout(postTimeoutId);
      setPhase(null);
    }
  }

  return (
    <div id="upload" className="space-y-6 scroll-mt-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ZIP 업로드 · Alt 검수</h1>
        <p className="text-muted-foreground">
          HTML과 이미지가 ZIP 루트에 같이 있어도 되고, <code className="rounded bg-muted px-1">images/</code> 폴더
          아래만 모여 있어도 됩니다. 단일 최상위 폴더만 있는 패킷(예: <code className="rounded bg-muted px-1">site/index.html</code>
          )이면 자동으로 그 폴더를 사이트 루트로 잡아 점검합니다.
        </p>
      </div>

      {isBusy ? (
        <div
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground"
          role="status"
          aria-live="assertive"
        >
          {phase === "upload"
            ? "ZIP을 서버로 보내는 중입니다. 용량이 크면 이 단계만 수 분 걸릴 수 있습니다."
            : "서버에서 압축을 풀고 OCR·분석을 실행 중입니다. 이미지가 많으면 수 분 더 걸릴 수 있습니다. 이 브라우저 탭을 닫지 마세요."}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>파일 선택</CardTitle>
            <CardDescription>드래그 앤 드롭 또는 찾아보기 — ZIP만, 최대 50MB</CardDescription>
          </div>
          <Badge variant={isBusy ? "secondary" : "outline"}>
            {phase === "upload" ? "업로드 중…" : phase === "process" ? "분석 중…" : "대기"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Label htmlFor="zip-file" className="sr-only">
              ZIP 파일
            </Label>
            <input
              ref={inputRef}
              id="zip-file"
              name="file"
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              disabled={isBusy}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center text-sm transition-colors ${
                isBusy
                  ? "cursor-not-allowed border-muted-foreground/20 bg-muted/20 text-muted-foreground opacity-70"
                  : dragOver
                    ? "cursor-pointer border-primary bg-primary/5 text-foreground"
                    : "cursor-pointer border-muted-foreground/25 bg-muted/30 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50"
              }`}
              aria-describedby="upload-hint"
              aria-disabled={isBusy}
            >
              <UploadCloud className="size-10 opacity-80" aria-hidden />
              <span className="font-medium text-foreground">
                {isBusy ? "분석이 끝날 때까지 다른 파일을 추가할 수 없습니다" : "ZIP을 여기에 놓거나 클릭하여 선택"}
              </span>
              <span id="upload-hint" className="max-w-md text-xs leading-relaxed">
                업로드된 파일은 임시 디렉터리에만 펼쳐지며, 분석이 끝나면 바로 삭제됩니다.
              </span>
            </button>
            <Button type="submit" className="w-full sm:w-auto" disabled={isBusy}>
              {phase === "upload" ? "업로드 중…" : phase === "process" ? "분석 중…" : "업로드 및 분석"}
            </Button>
          </form>

          {result && !result.ok ? (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              {result.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {result?.ok ? (
        <div ref={resultRef} className="space-y-4 scroll-mt-8">
          <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-[15px] leading-relaxed">
            <p className="flex items-start gap-2 font-medium text-foreground">
              <span aria-hidden>✅</span>
              <span>{result.message}</span>
            </p>
            <p className="mt-2 flex items-start gap-2 text-muted-foreground">
              <span aria-hidden>📝</span>
              <span>
                아래는 2×2 요약 노트예요. HTML 스캔은 최대 40개, OCR은 상한 내 이미지에 적용됩니다. alt가 이미 있는
                img는 덮어쓰지 않습니다.
              </span>
            </p>
            {result.stats.downloadToken ? (
              <p className="mt-3">
                <a
                  href={`/api/upload-zip/download?token=${encodeURIComponent(result.stats.downloadToken)}`}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  rel="nofollow"
                >
                  📦 alt 반영 ZIP 데스크톱으로 저장
                </a>
                <span className="ml-2 mt-1 block text-xs text-muted-foreground sm:ml-3 sm:mt-0 sm:inline">
                  링크는 일회성이며 곧 만료됩니다.
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                결과 ZIP 생성에 실패했습니다. 통계만 확인할 수 있습니다.
              </p>
            )}
          </div>
          <UploadResultDashboard result={result} />
        </div>
      ) : null}
    </div>
  );
}
