"use client";

import type { ReactNode } from "react";
import type { ProcessZipResult } from "@/types/process-zip";

type OkResult = Extract<ProcessZipResult, { ok: true }>;

type Props = { result: OkResult };

function Section({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col rounded-lg border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
      <h2 className="mb-2.5 flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
        <span className="select-none text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        {title}
      </h2>
      <div className="min-h-0 flex-1 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Item({ children }: { children: ReactNode }) {
  return <li className="flex gap-2 py-0.5 pl-1 [&>span:first-child]:mt-0.5">{children}</li>;
}

export function UploadResultDashboard({ result }: Props) {
  const { stats } = result;
  const { layout } = stats;
  const filledAlt = Math.max(0, stats.imageTags - stats.imagesMissingAlt);
  const otherFiles = Math.max(0, stats.totalFiles - stats.htmlFiles - stats.imageFiles);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-4">
      <Section emoji="📋" title="분석 요약">
        <ul className="list-none space-y-0.5">
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              총 <strong className="font-medium text-foreground tabular-nums">{stats.totalFiles}</strong>개 파일
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              HTML <strong className="font-medium text-foreground tabular-nums">{stats.htmlFiles}</strong>
              {" · "}
              이미지 <strong className="font-medium text-foreground tabular-nums">{stats.imageFiles}</strong>
              {otherFiles > 0 ? (
                <>
                  {" · "}
                  기타 <strong className="font-medium text-foreground tabular-nums">{otherFiles}</strong>
                </>
              ) : null}
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              스캔한 HTML{" "}
              <strong className="font-medium text-foreground tabular-nums">{stats.htmlFilesScanned}</strong>개 (최대 40)
            </span>
          </Item>
        </ul>
      </Section>

      <Section emoji="📁" title="폴더 구조">
        <ul className="list-none space-y-0.5">
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              감지한 사이트 루트{" "}
              <code className="rounded bg-muted px-1.5 py-px text-[13px] text-foreground">
                {layout.contentRootRelativePosix}
              </code>
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              HTML — 콘텐츠 루트 옆{" "}
              <strong className="font-medium text-foreground tabular-nums">{layout.htmlNextToContentRoot}</strong>
              {" · "}
              하위 폴더{" "}
              <strong className="font-medium text-foreground tabular-nums">{layout.htmlInSubfolders}</strong>
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              이미지 — 같은 루트{" "}
              <strong className="font-medium text-foreground tabular-nums">{layout.imagesNextToContentRoot}</strong>
              {" · "}
              <code className="rounded bg-muted px-1 py-px text-[13px]">images/</code>{" "}
              <strong className="font-medium text-foreground tabular-nums">{layout.imagesUnderImagesFolder}</strong>
              {" · "}
              기타 경로{" "}
              <strong className="font-medium text-foreground tabular-nums">{layout.imagesInOtherFolders}</strong>
            </span>
          </Item>
        </ul>
      </Section>

      <Section emoji="🖼" title="이미지 · OCR · alt">
        <ul className="list-none space-y-0.5">
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              Tesseract OCR 처리{" "}
              <strong className="font-medium text-foreground tabular-nums">{stats.ocrImagesProcessed}</strong>장
              {stats.ocrImagesSkippedCap > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  (상한으로{" "}
                  <strong className="font-medium text-foreground tabular-nums">{stats.ocrImagesSkippedCap}</strong>장
                  생략)
                </span>
              ) : null}
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              OCR 결과가 비어 있는 이미지{" "}
              <strong className="font-medium text-foreground tabular-nums">{stats.ocrTextsEmpty}</strong>장
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              빈 alt에 주입한 횟수{" "}
              <strong className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                {stats.altsInjected}
              </strong>
              {" · "}
              수정한 HTML{" "}
              <strong className="font-medium text-foreground tabular-nums">{stats.htmlFilesUpdated}</strong>개
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              <code className="rounded bg-muted px-1 py-px text-[13px]">&lt;img&gt;</code> (스캔 구간){" "}
              <strong className="font-medium text-foreground tabular-nums">{stats.imageTags}</strong>개
            </span>
          </Item>
          {stats.imageTags > 0 ? (
            <Item>
              <span className="text-muted-foreground/80">▸</span>
              <span>
                alt 있음 <strong className="font-medium text-foreground tabular-nums">{filledAlt}</strong>
                {" · "}
                alt 없음{" "}
                <strong className="font-medium text-amber-700 tabular-nums dark:text-amber-400">
                  {stats.imagesMissingAlt}
                </strong>{" "}
                <span className="text-[13px]">(주입 이후 스캔 기준)</span>
              </span>
            </Item>
          ) : (
            <Item>
              <span className="text-muted-foreground/80">▸</span>
              <span>스캔 구간에 img 태그가 없습니다.</span>
            </Item>
          )}
        </ul>
      </Section>

      <Section emoji="🔗" title="로컬 경로 매칭">
        <p className="mb-1.5 text-[14px] text-muted-foreground">
          <code className="rounded bg-muted px-1 py-px text-[13px]">data:</code> · URL은 제외하고, 상대 경로만
          디스크와 대조했습니다.
        </p>
        <ul className="list-none space-y-0.5">
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              점검한 로컬 참조{" "}
              <strong className="font-medium text-foreground tabular-nums">{layout.localImgRefs}</strong>건
            </span>
          </Item>
          <Item>
            <span className="text-muted-foreground/80">▸</span>
            <span>
              ZIP 안에서 찾음{" "}
              <strong className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                {layout.localImgResolved}
              </strong>
              {" · "}
              경로 불일치{" "}
              <strong className="font-medium text-red-600 tabular-nums dark:text-red-400">
                {layout.localImgMissing}
              </strong>
            </span>
          </Item>
        </ul>
      </Section>
    </div>
  );
}
