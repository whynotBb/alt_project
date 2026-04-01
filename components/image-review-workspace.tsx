"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Check,
  Copy,
  FolderOutput,
  Loader2,
  RefreshCw,
  SpellCheck2,
  Upload,
  Wand2,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Mascot } from "@/components/mascot";
import {
  extractZipAssets,
  isZipFile,
  zipArchiveLabel,
} from "@/lib/client/extract-zip-assets";
import { requestOcrForImageItem } from "@/lib/client/ocr-image-fetch";
import { applySpellHits } from "@/lib/client/apply-spell-hits";
import { SpellDiffPreview } from "@/components/spell-diff-preview";
import type { SpellHit } from "@/types/spell-hit";
import { injectReviewedAltsIntoHtmlMarkup } from "@/lib/client/html-alt-inject-from-review";
import { appendAltReviewExcelToJsZip } from "@/lib/client/append-alt-review-excel-to-zip";

const MAX_IMAGES = 50;

type ImageItem = {
  id: string;
  name: string;
  url: string;
  extractedText: string;
  reviewed: boolean;
  excludedFromTarget: boolean;
};

type HtmlAsset = {
  id: string;
  relativePath: string;
  content: string;
  originalContent: string;
};

export function ImageReviewWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [htmlAssets, setHtmlAssets] = useState<HtmlAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isParsingZip, setIsParsingZip] = useState(false);
  const [sideNotice, setSideNotice] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [spellLoading, setSpellLoading] = useState(false);
  const [spellHits, setSpellHits] = useState<SpellHit[]>([]);
  const [spellBaseline, setSpellBaseline] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const reviewTargetCount = items.filter((i) => !i.excludedFromTarget).length;
  const reviewedCount = items.filter((i) => !i.excludedFromTarget && i.reviewed).length;
  const excludedCount = items.filter((i) => i.excludedFromTarget).length;
  const total = items.length;
  const progressPct =
    reviewTargetCount > 0 ? Math.round((reviewedCount / reviewTargetCount) * 100) : 0;

  const allReviewComplete = reviewTargetCount > 0 && reviewedCount === reviewTargetCount;
  const canExportDeliverables = allReviewComplete && htmlAssets.length > 0;

  const mascotMood = useMemo(() => {
    if (isParsingZip || ocrLoading || spellLoading || exportLoading) return "working" as const;
    if (reviewTargetCount > 0 && reviewedCount === reviewTargetCount) return "success" as const;
    return "happy" as const;
  }, [isParsingZip, ocrLoading, spellLoading, exportLoading, reviewedCount, reviewTargetCount]);

  const itemsRef = useRef<ImageItem[]>([]);
  itemsRef.current = items;
  const htmlAssetsRef = useRef<HtmlAsset[]>([]);
  htmlAssetsRef.current = htmlAssets;

  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.url);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setOcrLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const item = itemsRef.current.find((i) => i.id === selectedId);
      if (!item) return;

      if (item.excludedFromTarget) {
        setOcrLoading(false);
        return;
      }

      if (item.extractedText.trim() !== "") {
        setOcrLoading(false);
        return;
      }

      setOcrLoading(true);
      setSideNotice(null);
      try {
        const result = await requestOcrForImageItem(item);
        if (cancelled) return;
        if (result.ok) {
          setSpellHits([]);
          setSpellBaseline(null);
          setItems((prev) =>
            prev.map((it) => (it.id === selectedId ? { ...it, extractedText: result.text } : it)),
          );
        } else {
          setSideNotice(result.message);
        }
      } finally {
        if (!cancelled) setOcrLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    setSpellHits([]);
    setSpellBaseline(null);
    setSpellLoading(false);
  }, [selectedId]);

  const handleAddFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setSideNotice(null);
    setIsParsingZip(true);

    try {
      const files = Array.from(fileList);
      const newImages: ImageItem[] = [];
      const newHtml: HtmlAsset[] = [];

      let room = MAX_IMAGES - items.length;

      for (const file of files) {
        if (isZipFile(file)) {
          const { images, htmlFiles } = await extractZipAssets(file);
          const base = zipArchiveLabel(file.name);
          for (const h of htmlFiles) {
            newHtml.push({
              id: crypto.randomUUID(),
              relativePath: `${base}/${h.relativePath}`,
              content: h.content,
              originalContent: h.content,
            });
          }
          for (const img of images) {
            if (room <= 0) break;
            newImages.push({
              id: crypto.randomUUID(),
              name: `${base}/${img.relativePath}`,
              url: URL.createObjectURL(img.blob),
              extractedText: "",
              reviewed: false,
              excludedFromTarget: false,
            });
            room -= 1;
          }
        } else if (file.type.startsWith("image/")) {
          if (room <= 0) break;
          newImages.push({
            id: crypto.randomUUID(),
            name: file.name,
            url: URL.createObjectURL(file),
            extractedText: "",
            reviewed: false,
            excludedFromTarget: false,
          });
          room -= 1;
        }
      }

      if (newHtml.length === 0 && newImages.length === 0 && files.some((f) => isZipFile(f))) {
        setSideNotice("ZIP 안에서 이미지·HTML 파일을 찾지 못했습니다.");
      }

      if (newHtml.length > 0) {
        setHtmlAssets((prev) => [...prev, ...newHtml]);
      }
      if (newImages.length > 0) {
        setItems((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
        setSelectedId((cur) => cur ?? newImages[0].id);
      }
    } catch (e) {
      setSideNotice(e instanceof Error ? e.message : "ZIP을 읽는 중 오류가 났습니다.");
    } finally {
      setIsParsingZip(false);
    }
  }, [items.length]);

  const handleReExtract = useCallback(async () => {
    const id = selectedId;
    if (!id) return;
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;

    setOcrLoading(true);
    setSideNotice(null);
    try {
      const result = await requestOcrForImageItem(item);
      if (result.ok) {
        setSpellHits([]);
        setSpellBaseline(null);
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, extractedText: result.text } : it)));
      } else {
        setSideNotice(result.message);
      }
    } finally {
      setOcrLoading(false);
    }
  }, [selectedId]);

  const copyExtractedText = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.extractedText);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2000);
    } catch {
      setSideNotice("클립보드에 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }, [selected]);

  const updateSelectedText = useCallback(
    (text: string) => {
      setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, extractedText: text } : it)));
    },
    [selectedId],
  );

  const handleSpellCheck = useCallback(async () => {
    if (!selectedId || !selected) return;
    const text = selected.extractedText;
    setSpellLoading(true);
    setSideNotice(null);
    try {
      const res = await fetch("/api/spell-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { ok?: boolean; hits?: SpellHit[]; message?: string };
      if (!res.ok || !data.ok) {
        setSideNotice(typeof data.message === "string" ? data.message : "맞춤법 검사에 실패했습니다.");
        setSpellHits([]);
        setSpellBaseline(null);
        return;
      }
      setSpellBaseline(text);
      setSpellHits(Array.isArray(data.hits) ? data.hits : []);
    } catch {
      setSideNotice("맞춤법 검사 요청 중 오류가 났습니다.");
      setSpellHits([]);
      setSpellBaseline(null);
    } finally {
      setSpellLoading(false);
    }
  }, [selectedId, selected]);

  const handleSpellApply = useCallback(() => {
    if (!selectedId || spellBaseline === null || spellHits.length === 0) return;
    const corrected = applySpellHits(spellBaseline, spellHits);
    setItems((prev) => {
      const next = prev.map((it) =>
        it.id === selectedId ? { ...it, extractedText: corrected } : it,
      );
      const self = next.find((i) => i.id === selectedId);
      if (self?.reviewed && htmlAssetsRef.current.length > 0) {
        setHtmlAssets((hprev) =>
          hprev.map((h) => ({
            ...h,
            content: injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, next),
          })),
        );
      }
      return next;
    });
    setSpellHits([]);
    setSpellBaseline(null);
  }, [selectedId, spellBaseline, spellHits]);

  const spellPreviewActive =
    selected && spellBaseline !== null && selected.extractedText === spellBaseline;

  const currentIndex = selected ? items.findIndex((i) => i.id === selected.id) : -1;

  const goToIndex = useCallback(
    (index: number) => {
      if (items.length === 0) return;
      const wrapped = ((index % items.length) + items.length) % items.length;
      setSelectedId(items[wrapped].id);
    },
    [items],
  );

  const handleDeferReview = useCallback(() => {
    if (items.length === 0) return;
    goToIndex(currentIndex + 1);
  }, [currentIndex, goToIndex, items.length]);

  const handleExcludeFromTarget = useCallback(() => {
    if (!selectedId) return;
    setItems((prev) => {
      const next = prev.map((it) =>
        it.id === selectedId ? { ...it, excludedFromTarget: true, reviewed: false } : it,
      );
      setHtmlAssets((hprev) =>
        hprev.map((h) => ({
          ...h,
          content: injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, next),
        })),
      );
      const idx = prev.findIndex((i) => i.id === selectedId);
      const forward = next.findIndex((it, j) => j > idx && !it.excludedFromTarget);
      if (forward >= 0) setSelectedId(next[forward].id);
      else {
        const anyOpen = next.findIndex((it) => !it.excludedFromTarget);
        if (anyOpen >= 0) setSelectedId(next[anyOpen].id);
        else setSelectedId(null);
      }
      return next;
    });
  }, [selectedId]);

  const handleApprove = useCallback(() => {
    if (!selectedId) return;
    setItems((prev) => {
      const next = prev.map((it) => (it.id === selectedId ? { ...it, reviewed: true } : it));
      setHtmlAssets((hprev) =>
        hprev.map((h) => ({
          ...h,
          content: injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, next),
        })),
      );
      const idx = prev.findIndex((i) => i.id === selectedId);
      const nextUnreviewed = next.findIndex(
        (it, j) => j > idx && !it.reviewed && !it.excludedFromTarget,
      );
      if (nextUnreviewed >= 0) setSelectedId(next[nextUnreviewed].id);
      else {
        const anyUnreviewed = next.findIndex((it) => !it.reviewed && !it.excludedFromTarget);
        if (anyUnreviewed >= 0) setSelectedId(next[anyUnreviewed].id);
        else if (idx >= 0 && idx < next.length - 1) setSelectedId(next[idx + 1].id);
      }
      return next;
    });
  }, [selectedId]);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleExportDeliverables = useCallback(async () => {
    const snapshotItems = itemsRef.current;
    const snapshotHtml = htmlAssetsRef.current;
    const targets = snapshotItems.filter((i) => !i.excludedFromTarget);
    if (snapshotHtml.length === 0 || targets.length === 0) return;
    if (!targets.every((i) => i.reviewed)) return;

    setExportLoading(true);
    setSideNotice(null);
    try {
      const zip = new JSZip();

      for (const h of snapshotHtml) {
        const markup = injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, snapshotItems);
        zip.file(h.relativePath.replace(/\\/g, "/"), markup);
      }

      for (const it of snapshotItems) {
        const path = it.name.replace(/\\/g, "/");
        const res = await fetch(it.url);
        if (!res.ok) throw new Error(`이미지를 읽지 못했습니다: ${path}`);
        const buf = await res.arrayBuffer();
        zip.file(path, buf);
      }

      await appendAltReviewExcelToJsZip(zip, snapshotItems);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alt-review-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSideNotice(e instanceof Error ? e.message : "산출물보내기에 실패했습니다.");
    } finally {
      setExportLoading(false);
    }
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-1 flex-col rounded-xl border border-border/60 bg-(--app-canvas) shadow-sm sm:min-h-128">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className="flex min-h-0 w-full shrink-0 flex-col border-b border-border/80 bg-card/70 backdrop-blur-sm lg:w-60 lg:border-b-0 lg:border-r"
          aria-label="업로드된 이미지 목록"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-3">
            <span className="text-sm font-semibold tracking-tight text-foreground">이미지 목록</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary tabular-nums text-xs">
              {total}/{MAX_IMAGES}
            </span>
          </div>
          {htmlAssets.length > 0 ? (
            <p className="border-b border-border/80 bg-primary/6 px-3 py-2 text-xs leading-snug text-muted-foreground">
              HTML <strong className="text-foreground">{htmlAssets.length}</strong>개 · alt 주입용
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.zip,application/zip,application/x-zip-compressed"
              multiple
              className="sr-only"
              onChange={async (e) => {
                await handleAddFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={cn(
                "mb-2 flex w-full flex-col items-stretch gap-2 rounded-xl border-2 border-dashed bg-card px-2.5 py-2.5 text-left shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                dropActive
                  ? "border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30"
                  : "border-primary/30 hover:border-primary/50 hover:bg-primary/3",
              )}
              disabled={total >= MAX_IMAGES || isParsingZip}
              onClick={openFilePicker}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isParsingZip && total < MAX_IMAGES) setDropActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropActive(false);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropActive(false);
                if (isParsingZip || total >= MAX_IMAGES) return;
                await handleAddFiles(e.dataTransfer.files);
              }}
              aria-label="이미지 또는 ZIP 파일 추가"
            >
              <div className="flex items-center justify-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-cyan-400/25 text-primary">
                  {isParsingZip ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="size-3.5" aria-hidden />
                  )}
                </div>
                <Mascot mood={mascotMood} size="sm" className="shrink-0" />
              </div>
              <div className="text-center">
                <p className="text-[11px] leading-tight font-semibold text-foreground">
                  {isParsingZip ? "처리 중…" : "이미지 · ZIP 추가"}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  끌어놓기 또는 클릭 · HTML은 alt 주입용
                </p>
              </div>
            </button>
            {sideNotice ? (
              <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                {sideNotice}
              </p>
            ) : null}
            {items.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                이미지 또는 ZIP을 추가하면 목록이 여기에 표시됩니다. ZIP에는 HTML과 이미지가 함께 있어도 됩니다.
              </p>
            ) : (
              <ul className="space-y-1">
                {items.map((it) => {
                  const isActive = it.id === selectedId;
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(it.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl border border-transparent px-2 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "border-primary/25 bg-sky-50 shadow-sm dark:bg-sky-950/40"
                            : it.excludedFromTarget
                              ? "text-muted-foreground opacity-80 hover:bg-muted/70"
                              : "text-foreground hover:bg-muted/70",
                        )}
                      >
                        <span
                          className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted/40"
                          aria-hidden
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.url} alt="" className="size-full object-cover" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium" title={it.name}>
                          {it.name}
                        </span>
                        {it.excludedFromTarget ? (
                          <span className="shrink-0 text-base" title="대상 제외" aria-label="대상 제외">
                            ⊘
                          </span>
                        ) : it.reviewed ? (
                          <span className="shrink-0 text-base" title="검수 완료" aria-label="검수 완료">
                            ✅
                          </span>
                        ) : (
                          <span className="size-5 shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-border/80 bg-card/90 p-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              disabled={!canExportDeliverables || exportLoading || isParsingZip}
              onClick={() => void handleExportDeliverables()}
            >
              {exportLoading ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FolderOutput className="size-4 shrink-0" aria-hidden />
              )}
              산출물보내기
            </Button>
            {!canExportDeliverables && items.length > 0 ? (
              <p className="mt-1.5 px-0.5 text-center text-[10px] leading-snug text-muted-foreground">
                검수 대상을 모두 승인하고, ZIP에서 가져온 HTML이 있어야 합니다.
              </p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-border/80 bg-card/40 px-4 py-3 sm:px-5">
            <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">이미지 접근성 검수</h1>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              왼쪽 목록에서 파일을 추가한 뒤, 대체텍스트를 편집·승인합니다.
            </p>
          </header>

          <div className="grid min-h-[min(45vh,380px)] flex-1 grid-cols-1 divide-y divide-border/80 bg-card/30 lg:min-h-0 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="flex min-h-[200px] flex-col lg:min-h-0">
              <div className="border-b border-border/80 bg-muted/30 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                이미지 뷰어
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                {selected ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.url}
                    alt={selected.name}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-md ring-1 ring-black/5"
                  />
                ) : (
                  <p className="max-w-xs text-center text-sm text-muted-foreground">
                    왼쪽에서 이미지·ZIP을 추가한 뒤, 목록에서 항목을 선택해 주세요.
                  </p>
                )}
              </div>
            </div>
            <div className="flex min-h-[200px] flex-col lg:min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-2">
                <Label
                  htmlFor="extracted-text"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  추출 텍스트 (편집)
                </Label>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-primary hover:bg-primary/10"
                    disabled={!selected || ocrLoading || selected?.excludedFromTarget}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleReExtract();
                    }}
                  >
                    <RefreshCw className={cn("size-3.5", ocrLoading && "animate-spin")} aria-hidden />
                    다시 추출
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2 text-xs text-cyan-700 hover:bg-cyan-500/10 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
                    disabled={!selected || ocrLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyExtractedText();
                    }}
                  >
                    <Copy className="size-3.5" aria-hidden />
                    {copyFlash ? "복사됨" : "클립보드 복사"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-amber-800 hover:bg-amber-500/10 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
                    disabled={!selected || ocrLoading || spellLoading || selected?.excludedFromTarget}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSpellCheck();
                    }}
                  >
                    <SpellCheck2 className={cn("size-3.5", spellLoading && "animate-pulse")} aria-hidden />
                    맞춤법 검사
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-red-800 hover:bg-red-500/10 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
                    disabled={
                      !selected ||
                      ocrLoading ||
                      spellLoading ||
                      selected?.excludedFromTarget ||
                      !spellPreviewActive ||
                      spellHits.length === 0
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpellApply();
                    }}
                  >
                    <Wand2 className="size-3.5" aria-hidden />
                    맞춤법 적용
                  </Button>
                </div>
              </div>
              <textarea
                id="extracted-text"
                value={selected?.extractedText ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  updateSelectedText(v);
                  if (spellBaseline !== null && v !== spellBaseline) {
                    setSpellHits([]);
                    setSpellBaseline(null);
                  }
                }}
                disabled={!selected || ocrLoading || selected?.excludedFromTarget}
                placeholder={
                  !selected
                    ? "이미지를 선택하세요."
                    : selected?.excludedFromTarget
                      ? "대상에서 제외된 이미지입니다. alt 주입·검수 대상에 포함되지 않습니다."
                      : ocrLoading
                        ? "Tesseract OCR로 텍스트 추출 중…"
                        : "추출된 텍스트가 여기 표시됩니다. 필요하면 직접 수정할 수 있습니다."
                }
                aria-busy={ocrLoading}
                className="min-h-0 flex-1 resize-none border-0 bg-background/80 p-4 font-mono text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
                spellCheck={false}
              />
              {spellPreviewActive ? (
                <div
                  className="max-h-40 shrink-0 overflow-y-auto border-t border-border/80 bg-muted/25 px-4 py-3"
                  aria-live="polite"
                >
                  <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    맞춤법 미리보기
                  </p>
                  <SpellDiffPreview text={spellBaseline ?? ""} hits={spellHits} />
                </div>
              ) : null}
            </div>
          </div>

          <footer
            className="shrink-0 border-t border-border/80 bg-card/80 px-4 py-3 backdrop-blur-sm"
            aria-label="검수 진행"
          >
            <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground">전체 진행</span>
                  <span className="tabular-nums text-muted-foreground">
                    {reviewedCount}/{reviewTargetCount || 0} 검수 완료
                    {excludedCount > 0 ? (
                      <span className="text-muted-foreground/80"> · 제외 {excludedCount}</span>
                    ) : null}
                  </span>
                </div>
                {total > 0 ? (
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={reviewedCount}
                    aria-valuemin={0}
                    aria-valuemax={reviewTargetCount}
                    aria-label={`검수 완료 ${reviewedCount}개, 검수 대상 ${reviewTargetCount}개`}
                  >
                    <div
                      className="h-full bg-linear-to-r from-[#a855f7] to-[#06b6d4] transition-[width] duration-300 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2 rounded-full bg-muted" aria-hidden />
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExcludeFromTarget}
                  disabled={!selected || selected.excludedFromTarget}
                >
                  <Ban className="size-4" aria-hidden />
                  대상 제외
                </Button>
                <Button type="button" variant="outline" onClick={handleDeferReview} disabled={items.length === 0}>
                  나중에 검수
                </Button>
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={!selected || selected.excludedFromTarget}
                >
                  <Check className="size-4" aria-hidden />
                  승인
                </Button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
