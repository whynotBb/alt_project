"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Ban, Check, Copy, FileCode2, FolderOutput, Loader2, RefreshCw, SpellCheck2, Trash2, Upload, Wand2 } from "lucide-react";
import JSZip from "jszip";
import { List, type ListImperativeAPI, type RowComponentProps } from "react-window";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { extractZipAssets, isZipFile, zipArchiveLabel } from "@/lib/client/extract-zip-assets";
import { requestOcrForImageItem, type OcrEngineId } from "@/lib/client/ocr-image-fetch";
import { applySpellHits } from "@/lib/client/apply-spell-hits";
import { SpellDiffPreview } from "@/components/spell-diff-preview";
import type { SpellHit } from "@/types/spell-hit";
import { getExistingAltFromHtmlForImage } from "@/lib/client/existing-alt-from-html";
import { injectReviewedAltsIntoHtmlMarkup } from "@/lib/client/html-alt-inject-from-review";
import { appendAltReviewExcelToJsZip, downloadAltReviewExcelFile } from "@/lib/client/append-alt-review-excel-to-zip";
import { excelDeliverableImagePathLabel } from "@/lib/client/deliverable-image-path-label";

const MAX_IMAGES = 200;
const LIST_ITEM_HEIGHT = 52;
const SPELL_PREVIEW_MIN_H = 88;
const SPELL_PREVIEW_DEFAULT_H = 176;

function clampSpellPreviewHeight(px: number): number {
	const max = typeof window !== "undefined" ? Math.min(560, Math.round(window.innerHeight * 0.7)) : 560;
	return Math.round(Math.max(SPELL_PREVIEW_MIN_H, Math.min(max, px)));
}

type ImageItem = {
	id: string;
	name: string;
	url: string;
	extractedText: string;
	finalAlt: string;
	reviewed: boolean;
	excludedFromTarget: boolean;
};

type HtmlAsset = {
	id: string;
	relativePath: string;
	content: string;
	originalContent: string;
};

type ImageListRowData = {
	items: ImageItem[];
	itemNames: string[];
	selectedId: string | null;
	onSelect: (id: string) => void;
};

function ImageListRow({ index, style, ...data }: RowComponentProps<ImageListRowData>) {
	const it = data.items[index];
	const isActive = it.id === data.selectedId;
	const listLabel = excelDeliverableImagePathLabel(it.name, data.itemNames);
	return (
		<div style={style} className="pb-1">
			<button type="button" data-item-id={it.id} onClick={() => data.onSelect(it.id)} className={cn("flex h-[48px] w-full items-center gap-2 rounded-xl border border-transparent px-2 text-left text-sm transition-colors", isActive ? "border-primary/25 bg-sky-50 shadow-sm dark:bg-sky-950/40" : it.excludedFromTarget ? "text-muted-foreground opacity-80 hover:bg-muted/70" : "text-foreground hover:bg-muted/70")}>
				<span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted/40" aria-hidden>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={it.url} alt="" className="size-full object-cover" />
				</span>
				<span className="min-w-0 flex-1 truncate font-medium" title={it.name !== listLabel ? `${listLabel} — ${it.name}` : it.name}>
					{listLabel}
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
		</div>
	);
}

export function ImageReviewWorkspace() {
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<ListImperativeAPI | null>(null);
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
	const [imageReviewEnabled, setImageReviewEnabled] = useState(true);
	const [ocrEngine, setOcrEngine] = useState<OcrEngineId>("tesseract");
	const [spellPreviewHeightPx, setSpellPreviewHeightPx] = useState(SPELL_PREVIEW_DEFAULT_H);
	const spellPreviewResizeRef = useRef<{ pointerId: number; startY: number; startH: number } | null>(null);

	const selected = items.find((i) => i.id === selectedId) ?? null;
	const reviewTargetCount = items.filter((i) => !i.excludedFromTarget).length;
	const reviewedCount = items.filter((i) => !i.excludedFromTarget && i.reviewed).length;
	const excludedCount = items.filter((i) => i.excludedFromTarget).length;
	const total = items.length;
	const progressPct = reviewTargetCount > 0 ? Math.round((reviewedCount / reviewTargetCount) * 100) : 0;

	const allReviewComplete = reviewTargetCount > 0 && reviewedCount === reviewTargetCount;
	const hasOnlyHtml = items.length === 0 && htmlAssets.length > 0;
	const canExportDeliverables = htmlAssets.length > 0 && (!imageReviewEnabled || allReviewComplete || hasOnlyHtml);

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
		if (htmlAssets.length === 0) return;
		setItems((prev) => {
			let changed = false;
			const next = prev.map((it) => {
				if (it.finalAlt.trim() !== "") return it;
				const fromHtml = getExistingAltFromHtmlForImage(it.name, htmlAssets);
				if (!fromHtml) return it;
				changed = true;
				return { ...it, finalAlt: fromHtml };
			});
			return changed ? next : prev;
		});
	}, [htmlAssets]);

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
				const result = await requestOcrForImageItem(item, ocrEngine);
				if (cancelled) return;
				if (result.ok) {
					setSpellHits([]);
					setSpellBaseline(null);
					setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, extractedText: result.text } : it)));
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
	}, [selectedId, ocrEngine]);

	useEffect(() => {
		setSpellHits([]);
		setSpellBaseline(null);
		setSpellLoading(false);
	}, [selectedId]);

	useEffect(() => {
		const snapshot = itemsRef.current;
		if (!selectedId || snapshot.length === 0) return;
		const rowIndex = snapshot.findIndex((it) => it.id === selectedId);
		if (rowIndex < 0) return;
		listRef.current?.scrollToRow({ index: rowIndex, align: "smart" });
		const rafId = window.requestAnimationFrame(() => {
			const root = listRef.current?.element;
			const button = root?.querySelector<HTMLButtonElement>(`button[data-item-id="${selectedId}"]`);
			button?.focus({ preventScroll: true });
		});
		return () => window.cancelAnimationFrame(rafId);
	}, [selectedId]);

	const handleAddFiles = useCallback(
		async (fileList: FileList | null) => {
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
								finalAlt: "",
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
							finalAlt: "",
							reviewed: false,
							excludedFromTarget: false,
						});
						room -= 1;
					}
				}

				if (newHtml.length === 0 && newImages.length === 0 && files.some((f) => isZipFile(f))) {
					setSideNotice("ZIP 안에서 이미지·HTML 파일을 찾지 못했습니다.");
				}

				let mergedHtmlSnapshot: HtmlAsset[] = [];
				if (newHtml.length > 0) {
					setHtmlAssets((prev) => {
						mergedHtmlSnapshot = [...prev, ...newHtml];
						return mergedHtmlSnapshot;
					});
				} else {
					mergedHtmlSnapshot = htmlAssetsRef.current;
				}

				if (newImages.length > 0) {
					setItems((prev) => {
						const stamped = newImages.map((img) => ({
							...img,
							finalAlt: getExistingAltFromHtmlForImage(img.name, mergedHtmlSnapshot),
						}));
						return [...prev, ...stamped].slice(0, MAX_IMAGES);
					});
					setSelectedId((cur) => cur ?? newImages[0].id);
				}
			} catch (e) {
				setSideNotice(e instanceof Error ? e.message : "ZIP을 읽는 중 오류가 났습니다.");
			} finally {
				setIsParsingZip(false);
			}
		},
		[items.length],
	);

	const handleReExtract = useCallback(async () => {
		const id = selectedId;
		if (!id) return;
		const item = itemsRef.current.find((i) => i.id === id);
		if (!item) return;

		setOcrLoading(true);
		setSideNotice(null);
		try {
			const result = await requestOcrForImageItem(item, ocrEngine);
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
	}, [selectedId, ocrEngine]);

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

	const updateSelectedFinalAlt = useCallback(
		(text: string) => {
			setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, finalAlt: text } : it)));
		},
		[selectedId],
	);

	const applyExtractedToFinalAlt = useCallback(() => {
		if (!selectedId || !selected) return;
		setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, finalAlt: selected.extractedText } : it)));
		setSpellHits([]);
		setSpellBaseline(null);
	}, [selectedId, selected]);

	/** 업로드 시점 HTML(`originalContent`)에서 매칭 img의 alt만 다시 읽어 최종 ALT에 넣습니다. */
	const refreshFinalAltFromHtmlSource = useCallback(() => {
		if (!selectedId || !selected) return;
		const snapshot = htmlAssetsRef.current.map((h) => ({
			relativePath: h.relativePath,
			content: h.originalContent ?? h.content,
		}));
		const fromHtml = getExistingAltFromHtmlForImage(selected.name, snapshot);
		setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, finalAlt: fromHtml } : it)));
		setSpellHits([]);
		setSpellBaseline(null);
	}, [selectedId, selected]);

	const handleSpellCheck = useCallback(async () => {
		if (!selectedId || !selected) return;
		const text = selected.finalAlt;
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
			const next = prev.map((it) => (it.id === selectedId ? { ...it, finalAlt: corrected } : it));
			const self = next.find((i) => i.id === selectedId);
			if (self?.reviewed && htmlAssetsRef.current.length > 0) {
				setHtmlAssets((hprev) =>
					hprev.map((h) => ({
						...h,
						content: injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, next, h.relativePath),
					})),
				);
			}
			return next;
		});
		setSpellHits([]);
		setSpellBaseline(null);
	}, [selectedId, spellBaseline, spellHits]);

	const spellPreviewActive = selected && spellBaseline !== null && selected.finalAlt === spellBaseline;

	const onSpellPreviewResizePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.preventDefault();
			spellPreviewResizeRef.current = {
				pointerId: e.pointerId,
				startY: e.clientY,
				startH: spellPreviewHeightPx,
			};
			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[spellPreviewHeightPx],
	);

	const onSpellPreviewResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const d = spellPreviewResizeRef.current;
		if (!d || e.pointerId !== d.pointerId) return;
		const delta = e.clientY - d.startY;
		setSpellPreviewHeightPx(clampSpellPreviewHeight(d.startH - delta));
	}, []);

	const onSpellPreviewResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const d = spellPreviewResizeRef.current;
		if (d && e.pointerId === d.pointerId) {
			spellPreviewResizeRef.current = null;
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* already released */
			}
		}
	}, []);

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
			const next = prev.map((it) => (it.id === selectedId ? { ...it, excludedFromTarget: true, reviewed: false } : it));
			setHtmlAssets((hprev) =>
				hprev.map((h) => ({
					...h,
					content: injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, next, h.relativePath),
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
					content: injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, next, h.relativePath),
				})),
			);
			const idx = prev.findIndex((i) => i.id === selectedId);
			const nextUnreviewed = next.findIndex((it, j) => j > idx && !it.reviewed && !it.excludedFromTarget);
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

	const handleClearUploads = useCallback(() => {
		if (itemsRef.current.length === 0 && htmlAssetsRef.current.length === 0) return;
		if (!window.confirm("업로드된 이미지와 HTML을 모두 삭제할까요?")) return;
		for (const it of itemsRef.current) {
			URL.revokeObjectURL(it.url);
		}
		setItems([]);
		setHtmlAssets([]);
		setSelectedId(null);
		setSideNotice(null);
		setSpellHits([]);
		setSpellBaseline(null);
		setOcrLoading(false);
		setSpellLoading(false);
		setCopyFlash(false);
	}, []);

	const handleExportDeliverables = useCallback(async () => {
		const snapshotItems = itemsRef.current;
		const snapshotHtml = htmlAssetsRef.current;
		const targets = snapshotItems.filter((i) => !i.excludedFromTarget);
		if (snapshotHtml.length === 0) return;
		if (!imageReviewEnabled) {
			setExportLoading(true);
			setSideNotice(null);
			try {
				// 이미지 검수 OFF: ZIP 없이 엑셀만 내리되, 업로드된 이미지는 그대로 엑셀에 포함
				await downloadAltReviewExcelFile(snapshotItems, snapshotHtml, {
					preferHtmlTagRows: true,
				});
			} catch (e) {
				setSideNotice(e instanceof Error ? e.message : "엑셀 추출에 실패했습니다.");
			} finally {
				setExportLoading(false);
			}
			return;
		}
		const htmlOnly = snapshotItems.length === 0;
		if (!htmlOnly && targets.length === 0) return;
		if (!htmlOnly && !targets.every((i) => i.reviewed)) return;

		setExportLoading(true);
		setSideNotice(null);
		try {
			const zip = new JSZip();

			for (const h of snapshotHtml) {
				const markup = injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, snapshotItems, h.relativePath);
				zip.file(h.relativePath.replace(/\\/g, "/"), markup);
			}

			for (const it of snapshotItems) {
				const path = it.name.replace(/\\/g, "/");
				const res = await fetch(it.url);
				if (!res.ok) throw new Error(`이미지를 읽지 못했습니다: ${path}`);
				const buf = await res.arrayBuffer();
				zip.file(path, buf);
			}

			await appendAltReviewExcelToJsZip(zip, snapshotItems, snapshotHtml);

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
	}, [imageReviewEnabled]);

	return (
		<div className="flex h-[calc(100vh-5rem)] min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-(--app-canvas) shadow-sm">
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border/80 bg-card/70 backdrop-blur-sm lg:w-60 lg:border-b-0 lg:border-r" aria-label="업로드된 이미지 목록">
					<div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-3">
						<span className="text-sm font-semibold tracking-tight text-foreground">이미지 목록</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors", "hover:bg-destructive/10 hover:text-destructive", "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", "disabled:pointer-events-none disabled:opacity-40")}
								disabled={(total === 0 && htmlAssets.length === 0) || isParsingZip || exportLoading}
								aria-label="업로드된 파일 모두 지우기"
								onClick={handleClearUploads}
							>
								<Trash2 className="size-4" aria-hidden />
							</button>
							<span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary tabular-nums text-xs">
								{total}/{MAX_IMAGES}
							</span>
						</div>
					</div>
					<div className="shrink-0 border-b border-border/80 p-2">
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
							className={cn("mb-2 flex w-full flex-col items-stretch gap-2 rounded-xl border-2 border-dashed bg-card px-2.5 py-2.5 text-left shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", dropActive ? "border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30" : "border-primary/30 hover:border-primary/50 hover:bg-primary/3")}
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
							<div className="flex items-center justify-center">
								<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-cyan-400/25 text-primary">{isParsingZip ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}</div>
							</div>
							<div className="text-center">
								<p className="text-[11px] leading-tight font-semibold text-foreground">{isParsingZip ? "처리 중…" : "이미지 · ZIP 추가"}</p>
								<p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">끌어놓기 또는 클릭 · HTML은 alt 주입용</p>
							</div>
						</button>
					</div>

					{htmlAssets.length > 0 ? (
						<p className="shrink-0 border-b border-border/80 bg-primary/6 px-3 py-2 text-xs leading-snug text-muted-foreground">
							HTML <strong className="text-foreground">{htmlAssets.length}</strong>개 · alt 주입용
						</p>
					) : null}
					{sideNotice ? <p className="mx-2 mt-2 shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">{sideNotice}</p> : null}

					<div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
						{items.length === 0 ? (
							<p className="px-1 py-4 text-center text-sm text-muted-foreground">이미지 또는 ZIP을 추가하면 목록이 여기에 표시됩니다. ZIP에는 HTML과 이미지가 함께 있어도 됩니다.</p>
						) : (
							<div className="min-h-0 h-full">
								<List rowCount={items.length} rowHeight={LIST_ITEM_HEIGHT} rowComponent={ImageListRow} rowProps={{ items, itemNames: items.map((i) => i.name), selectedId, onSelect: setSelectedId }} listRef={listRef} defaultHeight={320} style={{ height: "100%" }} />
							</div>
						)}
					</div>
					<div className="shrink-0 border-t border-border/80 bg-card/90 p-2">
						<button type="button" role="switch" aria-checked={imageReviewEnabled} aria-label="이미지 검수 사용 여부" className="mb-2 flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors" disabled={exportLoading || isParsingZip} onClick={() => setImageReviewEnabled((prev) => !prev)}>
							<span className="font-medium text-foreground">이미지 검수</span>
							<span className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground">{imageReviewEnabled ? "ON" : "OFF"}</span>
								<span className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", imageReviewEnabled ? "bg-primary" : "bg-muted")}>
									<span className={cn("inline-block size-4 transform rounded-full bg-white transition-transform", imageReviewEnabled ? "translate-x-4" : "translate-x-0.5")} />
								</span>
							</span>
						</button>
						<Button type="button" variant="secondary" className="w-full gap-2" disabled={!canExportDeliverables || exportLoading || isParsingZip} onClick={() => void handleExportDeliverables()}>
							{exportLoading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <FolderOutput className="size-4 shrink-0" aria-hidden />}
							산출물보내기
						</Button>
						{!canExportDeliverables && items.length > 0 && imageReviewEnabled ? <p className="mt-1.5 px-0.5 text-center text-[10px] leading-snug text-muted-foreground">검수 대상을 모두 승인하고, ZIP에서 가져온 HTML이 있어야 합니다.</p> : null}
					</div>
				</aside>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<header className="shrink-0 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
						<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
							<div className="min-w-0">
								<h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">대체텍스트 추출 및 편집</h1>
								<p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-1.5">왼쪽 목록에서 파일을 추가한 뒤, 추출 텍스트와 최종 ALT를 편집·승인합니다.</p>
							</div>
							<div className="flex shrink-0 flex-col gap-1 sm:items-end">
								<Label htmlFor="ocr-engine" className="text-[10px] font-medium text-muted-foreground">
									텍스트 추출 엔진
								</Label>
								<select id="ocr-engine" className={cn("h-8 min-w-42 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm", "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", "disabled:cursor-not-allowed disabled:opacity-50")} value={ocrEngine} disabled={ocrLoading || isParsingZip} onChange={(e) => setOcrEngine(e.target.value as OcrEngineId)} aria-label="텍스트 추출 엔진">
									<option value="tesseract">Tesseract</option>
									<option value="google-vision">구글 비전</option>
								</select>
							</div>
						</div>
					</header>

					<div className="min-h-0 flex-1">
						<div className="grid h-full min-h-[min(45vh,380px)] grid-cols-1 divide-y divide-border/80 bg-card/30 lg:min-h-0 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
							<div className="flex min-h-[200px] flex-col lg:min-h-0">
								<div className="border-b border-border/80 bg-muted/30 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">이미지 뷰어</div>
								<div className="flex min-h-0 flex-1 items-center justify-center p-4">
									{selected ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img src={selected.url} alt={selected.name} className="max-h-full max-w-full rounded-lg object-contain shadow-md ring-1 ring-black/5" />
									) : (
										<p className="max-w-xs text-center text-sm text-muted-foreground">왼쪽에서 이미지·ZIP을 추가한 뒤, 목록에서 항목을 선택해 주세요.</p>
									)}
								</div>
							</div>
							<div className="flex min-h-[200px] flex-col lg:min-h-0">
								<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-2">
									<Label htmlFor="extracted-text" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
											className="h-7 gap-1 px-2 text-xs text-violet-800 hover:bg-violet-500/10 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
											disabled={!selected || ocrLoading || selected?.excludedFromTarget}
											onClick={(e) => {
												e.stopPropagation();
												applyExtractedToFinalAlt();
											}}
											title="추출 텍스트를 최종 ALT로 적용"
										>
											<ArrowRight className="size-3.5" aria-hidden />
											최종 ALT로
										</Button>
									</div>
								</div>
								<textarea
									id="extracted-text"
									value={selected?.extractedText ?? ""}
									onChange={(e) => {
										const v = e.target.value;
										updateSelectedText(v);
									}}
									disabled={!selected || ocrLoading || selected?.excludedFromTarget}
									placeholder={!selected ? "이미지를 선택하세요." : selected?.excludedFromTarget ? "대상에서 제외된 이미지입니다. alt 주입·검수 대상에 포함되지 않습니다." : ocrLoading ? (ocrEngine === "google-vision" ? "Google Cloud Vision으로 텍스트 추출 중…" : "Tesseract OCR로 텍스트 추출 중…") : "추출된 텍스트가 여기 표시됩니다. 필요하면 직접 수정할 수 있습니다."}
									aria-busy={ocrLoading}
									className="min-h-0 flex-1 resize-none border-0 bg-background/80 p-4 font-mono text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
									spellCheck={false}
								/>
							</div>
							<div className="flex min-h-[200px] flex-col lg:min-h-0">
								<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-2">
									<Label htmlFor="final-alt-text" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
										최종 ALT (편집)
									</Label>
									<div className="flex shrink-0 flex-wrap items-center gap-1">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 gap-1 px-2 text-xs text-sky-800 hover:bg-sky-500/10 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
											disabled={!selected || ocrLoading || selected?.excludedFromTarget || htmlAssets.length === 0}
											onClick={(e) => {
												e.stopPropagation();
												refreshFinalAltFromHtmlSource();
											}}
											title="ZIP에 넣은 원본 HTML에서 매칭 img의 alt를 다시 읽습니다"
										>
											<FileCode2 className="size-3.5" aria-hidden />
											원본 alt
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
											disabled={!selected || ocrLoading || spellLoading || selected?.excludedFromTarget || !spellPreviewActive || spellHits.length === 0}
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
									id="final-alt-text"
									value={selected?.finalAlt ?? ""}
									onChange={(e) => {
										const v = e.target.value;
										updateSelectedFinalAlt(v);
										if (spellBaseline !== null && v !== spellBaseline) {
											setSpellHits([]);
											setSpellBaseline(null);
										}
									}}
									disabled={!selected || ocrLoading || selected?.excludedFromTarget}
									placeholder={!selected ? "이미지를 선택하세요." : selected?.excludedFromTarget ? "대상에서 제외된 이미지입니다." : htmlAssets.length === 0 ? "HTML과 함께 ZIP을 넣으면 img alt가 있을 때 여기에 먼저 채워집니다. 승인 시 빈 alt에 주입됩니다." : "HTML에 매칭된 img의 alt가 있으면 표시됩니다. 없으면 직접 입력하세요."}
									aria-busy={ocrLoading}
									className="min-h-0 flex-1 resize-none border-0 bg-background/80 p-4 font-mono text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
									spellCheck={false}
								/>
								{spellPreviewActive ? (
									<>
										<div role="separator" aria-orientation="horizontal" aria-label="맞춤법 미리보기 높이 조절" className="relative z-10 flex h-2 shrink-0 cursor-ns-resize touch-none items-center justify-center border-t border-border/80 bg-muted/15 hover:bg-muted/35" onPointerDown={onSpellPreviewResizePointerDown} onPointerMove={onSpellPreviewResizePointerMove} onPointerUp={onSpellPreviewResizePointerUp} onPointerCancel={onSpellPreviewResizePointerUp}>
											<span className="pointer-events-none h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35" aria-hidden />
										</div>
										<div className="min-h-22 shrink-0 overflow-y-auto bg-muted/25 px-4 py-3 [overflow-anchor:none]" style={{ height: spellPreviewHeightPx }} aria-live="polite">
											<p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">맞춤법 미리보기</p>
											<SpellDiffPreview text={spellBaseline ?? ""} hits={spellHits} />
										</div>
									</>
								) : null}
							</div>
						</div>
					</div>

					<footer className="shrink-0 border-t border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm" aria-label="검수 진행">
						<div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<div className="min-w-0 flex-1 space-y-1.5">
								<div className="flex items-center justify-between gap-2 text-sm">
									<span className="font-medium text-foreground">전체 진행</span>
									<span className="tabular-nums text-muted-foreground">
										{reviewedCount}/{reviewTargetCount || 0} 검수 완료
										{excludedCount > 0 ? <span className="text-muted-foreground/80"> · 제외 {excludedCount}</span> : null}
									</span>
								</div>
								{total > 0 ? (
									<div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={reviewedCount} aria-valuemin={0} aria-valuemax={reviewTargetCount} aria-label={`검수 완료 ${reviewedCount}개, 검수 대상 ${reviewTargetCount}개`}>
										<div className="h-full bg-linear-to-r from-[#a855f7] to-[#06b6d4] transition-[width] duration-300 ease-out" style={{ width: `${progressPct}%` }} />
									</div>
								) : (
									<div className="h-2 rounded-full bg-muted" aria-hidden />
								)}
							</div>
							<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
								<Button type="button" variant="outline" onClick={handleExcludeFromTarget} disabled={!selected || selected.excludedFromTarget}>
									<Ban className="size-4" aria-hidden />
									대상 제외
								</Button>
								<Button type="button" variant="outline" onClick={handleDeferReview} disabled={items.length === 0}>
									나중에 검수
								</Button>
								<Button type="button" onClick={handleApprove} disabled={!selected || selected.excludedFromTarget}>
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
