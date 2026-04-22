"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileCode2, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { ImageViewerZoom } from "@/components/image-viewer-zoom";
import { Button } from "@/components/ui/button";
import { extractZipAssets } from "@/lib/client/extract-zip-assets";
import { cn } from "@/lib/utils";

type PptSlideRow = {
	id: string;
	label: string;
	imageUrl: string;
};

type HtmlFileRow = {
	id: string;
	relativePath: string;
	text: string;
};

async function parsePptSlides(file: File): Promise<PptSlideRow[]> {
	const lower = file.name.toLowerCase();
	if (!lower.endsWith(".pptx")) {
		throw new Error("현재는 .pptx만 슬라이드 이미지 뷰어를 지원합니다.");
	}
	const formData = new FormData();
	formData.set("file", file);
	const res = await fetch("/api/parse-ppt", { method: "POST", body: formData });
	const payload = (await res.json()) as { ok?: boolean; message?: string; slides?: Array<{ id: string; label: string; imageDataUrl: string }> };
	if (!res.ok || !payload.ok) {
		throw new Error(payload.message || "PPT 슬라이드 이미지 렌더링에 실패했습니다.");
	}
	return (payload.slides ?? []).map((s, idx) => ({
		id: s.id || `slide-${idx + 1}`,
		label: s.label || `- ppt ${idx + 1}`,
		imageUrl: s.imageDataUrl,
	}));
}

function extractHtmlTextWithAlt(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const out: string[] = [];
	const body = doc.body;
	if (!body) return "";

	const ignoredTags = new Set(["script", "style", "noscript"]);

	const pushLine = (line: string) => {
		const normalized = line.replace(/\s+/g, " ").trim();
		if (!normalized) return;
		out.push(normalized);
		out.push(""); // 항목 간 1줄 공백(두 줄 간격 효과)
	};

	const pushAlt = (el: Element) => {
		const alt = el.getAttribute("alt")?.replace(/\s+/g, " ").trim();
		if (!alt) return;
		pushLine(`[alt] ${alt}`);
	};

	const isIgnoredContext = (n: Node | null): boolean => {
		let cur: Node | null = n;
		while (cur && cur !== body) {
			if (cur.nodeType === Node.ELEMENT_NODE) {
				const tag = (cur as Element).tagName.toLowerCase();
				if (ignoredTags.has(tag)) return true;
			}
			cur = cur.parentNode;
		}
		return false;
	};

	const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
	let node = walker.currentNode;
	while (node) {
		if (!isIgnoredContext(node)) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as Element;
				if (el.hasAttribute("alt")) pushAlt(el);
			} else if (node.nodeType === Node.TEXT_NODE) {
				pushLine(node.textContent ?? "");
			}
		}
		node = walker.nextNode();
	}

	return out.join("\n").trim();
}


export function TextComparatorWorkspace() {
	const zipInputRef = useRef<HTMLInputElement>(null);
	const pptInputRef = useRef<HTMLInputElement>(null);

	const [zipLabel, setZipLabel] = useState<string | null>(null);
	const [pptLabel, setPptLabel] = useState<string | null>(null);
	const [zipBusy, setZipBusy] = useState(false);
	const [pptBusy, setPptBusy] = useState(false);

	const [pptSlides, setPptSlides] = useState<PptSlideRow[]>([]);
	const [htmlFiles, setHtmlFiles] = useState<HtmlFileRow[]>([]);
	const [selectedPptId, setSelectedPptId] = useState<string | null>(null);
	const [selectedHtmlId, setSelectedHtmlId] = useState<string | null>(null);

	const [htmlText, setHtmlText] = useState("");
	const [isMdUp, setIsMdUp] = useState(false);
	const [pptListRatio, setPptListRatio] = useState(0.4); // list:text = 4:6
	const [htmlTextRatio, setHtmlTextRatio] = useState(0.6); // text:list = 6:4
	const pptSplitRef = useRef<HTMLDivElement | null>(null);
	const htmlSplitRef = useRef<HTMLDivElement | null>(null);
	const dragStateRef = useRef<{ target: "ppt" | "html"; startX: number; startRatio: number } | null>(null);

	const openZipPicker = useCallback(() => zipInputRef.current?.click(), []);
	const openPptPicker = useCallback(() => pptInputRef.current?.click(), []);

	const handleClearAll = useCallback(() => {
		if (!zipLabel && !pptLabel && pptSlides.length === 0 && htmlFiles.length === 0) return;
		if (!window.confirm("업로드한 파일과 목록을 모두 지울까요?")) return;
		setZipLabel(null);
		setPptLabel(null);
		setPptSlides([]);
		setHtmlFiles([]);
		setSelectedPptId(null);
		setSelectedHtmlId(null);
		setHtmlText("");
	}, [zipLabel, pptLabel, pptSlides.length, htmlFiles.length]);

	const hasUpload = Boolean(zipLabel || pptLabel);

	useEffect(() => {
		const check = () => setIsMdUp(window.innerWidth >= 768);
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	useEffect(() => {
		const onPointerMove = (e: PointerEvent) => {
			const drag = dragStateRef.current;
			if (!drag) return;
			const host = drag.target === "ppt" ? pptSplitRef.current : htmlSplitRef.current;
			if (!host) return;
			const w = host.getBoundingClientRect().width;
			if (w <= 0) return;
			const deltaRatio = (e.clientX - drag.startX) / w;
			const next = Math.min(0.8, Math.max(0.2, drag.startRatio + deltaRatio));
			if (drag.target === "ppt") setPptListRatio(next);
			else setHtmlTextRatio(next);
		};

		const onPointerUp = () => {
			dragStateRef.current = null;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, []);

	const startResize = useCallback((target: "ppt" | "html", e: React.PointerEvent<HTMLButtonElement>) => {
		e.preventDefault();
		const ratio = target === "ppt" ? pptListRatio : htmlTextRatio;
		dragStateRef.current = { target, startX: e.clientX, startRatio: ratio };
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, [htmlTextRatio, pptListRatio]);

	useEffect(() => {
		return () => {
			for (const slide of pptSlides) {
				if (slide.imageUrl.startsWith("blob:")) URL.revokeObjectURL(slide.imageUrl);
			}
		};
	}, [pptSlides]);

	useEffect(() => {
		if (!selectedHtmlId) {
			setHtmlText("");
			return;
		}
		const selected = htmlFiles.find((h) => h.id === selectedHtmlId);
		setHtmlText(selected?.text ?? "");
	}, [selectedHtmlId, htmlFiles]);

	return (
		<div className="flex h-[calc(100vh-5rem)] min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-(--app-canvas) shadow-sm">
			<header className="shrink-0 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
				<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
					<div className="min-w-0">
						<h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">텍스트 대조</h1>
						<p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-1.5">
							PPT는 슬라이드 목록과 추출 텍스트, HTML은 추출 텍스트와 파일 목록을 각각 2열로 둡니다. (추출·비교 로직은 다음 단계에서 연결됩니다.)
						</p>
					</div>
					<Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={!hasUpload && pptSlides.length === 0 && htmlFiles.length === 0} onClick={handleClearAll}>
						<Trash2 className="size-3.5" aria-hidden />
						초기화
					</Button>
				</div>
			</header>

			<div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border/80 bg-card/30 lg:grid-cols-2 lg:divide-x lg:divide-y-0" role="region" aria-label="PPT·HTML 텍스트 대조">
				{/* PPT: 슬라이드 목록 + 추출 텍스트 */}
				<section className="flex min-h-[min(48vh,420px)] min-w-0 flex-col lg:min-h-0" aria-label="PPT">
					<div className="shrink-0 border-b border-border/80 bg-card/60 px-3 py-2 sm:px-4">
						<h2 className="text-sm font-semibold text-foreground">PPT</h2>
						<p className="text-[11px] text-muted-foreground">슬라이드 목록 → 슬라이드 이미지 뷰어</p>
					</div>

					<div
						ref={pptSplitRef}
						className="grid min-h-0 min-w-0 flex-1 grid-cols-1 divide-y divide-border/70 md:divide-y-0"
						style={isMdUp ? { gridTemplateColumns: `minmax(180px, ${Math.round(pptListRatio * 100)}%) 10px minmax(220px, ${Math.round((1 - pptListRatio) * 100)}%)` } : undefined}
					>
						<div className="flex min-h-0 min-w-0 flex-col">
							<div className="shrink-0 border-b border-border/60 bg-card/40 px-2 py-2">
								<input
									ref={pptInputRef}
									type="file"
									accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
									className="sr-only"
									onChange={async (e) => {
										const f = e.target.files?.[0];
										e.target.value = "";
										if (!f) return;
										setPptBusy(true);
										try {
											for (const slide of pptSlides) {
												if (slide.imageUrl.startsWith("blob:")) URL.revokeObjectURL(slide.imageUrl);
											}
											setPptLabel(f.name);
											const slides = await parsePptSlides(f);
											setPptSlides(slides);
											setSelectedPptId(slides[0]?.id ?? null);
										} catch (error) {
											setPptSlides([]);
											setSelectedPptId(null);
											alert(error instanceof Error ? error.message : "PPT 이미지 추출에 실패했습니다.");
										} finally {
											setPptBusy(false);
										}
									}}
								/>
								<button
									type="button"
									className={cn(
										"mb-2 flex w-full items-center gap-2 rounded-lg border-2 border-dashed bg-card px-2.5 py-2 text-left text-[11px] shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
										"border-primary/30 hover:border-primary/50 hover:bg-primary/3",
									)}
									disabled={pptBusy}
									onClick={openPptPicker}
									aria-label="화면 설계서 PPT 선택"
								>
									<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-violet-400/20 text-primary">
										{pptBusy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-3" aria-hidden />}
									</div>
									<div className="min-w-0 flex-1">
										<p className="font-semibold text-foreground">PPT 업로드</p>
										<p className="truncate text-[10px] text-muted-foreground">{pptLabel ?? "선택"}</p>
									</div>
									<Upload className="size-3.5 shrink-0 text-muted-foreground opacity-70" aria-hidden />
								</button>
								<div className="border-b border-border/50 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">슬라이드</div>
							</div>
							<div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
								{pptSlides.length === 0 ? (
									<p className="px-1 py-3 text-center text-xs leading-relaxed text-muted-foreground">PPT를 올리면 슬라이드 목록이 표시됩니다.</p>
								) : (
									<ul className="flex flex-col gap-1">
										{pptSlides.map((s) => (
											<li key={s.id}>
												<button
													type="button"
													onClick={() => setSelectedPptId(s.id)}
													className={cn(
														"w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
														selectedPptId === s.id ? "bg-primary/15 font-medium text-primary" : "text-foreground hover:bg-muted/80",
													)}
												>
													{s.label}
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>

						<div className="hidden items-stretch bg-card/20 md:flex">
							<button
								type="button"
								aria-label="PPT 영역 비율 조절"
								title="드래그해서 너비 조절"
								onPointerDown={(e) => startResize("ppt", e)}
								className="group relative h-full w-full cursor-col-resize border-x border-border/70 bg-transparent transition-colors hover:bg-primary/5"
							>
								<span className="absolute top-1/2 left-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border group-hover:bg-primary/50" />
							</button>
						</div>

						<div className="flex min-h-0 min-w-0 flex-col">
							<div className="shrink-0 border-b border-border/60 bg-card/40 px-3 py-2">
								<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">슬라이드 미리보기</p>
							</div>
							<div className="min-h-0 flex-1 p-3">
								{selectedPptId ? (
									(() => {
										const selected = pptSlides.find((s) => s.id === selectedPptId);
										if (!selected) return <div className="flex h-full items-center justify-center text-xs text-muted-foreground">슬라이드를 선택해 주세요.</div>;
										return <ImageViewerZoom src={selected.imageUrl} alt={selected.label} className="h-full" />;
									})()
								) : (
									<div className="flex h-full items-center justify-center text-xs text-muted-foreground">슬라이드를 선택하면 이미지 뷰어가 표시됩니다.</div>
								)}
							</div>
						</div>
					</div>
				</section>

				{/* HTML: 추출 텍스트 + HTML 파일 목록 */}
				<section className="flex min-h-[min(48vh,420px)] min-w-0 flex-col lg:min-h-0" aria-label="HTML">
					<div className="shrink-0 border-b border-border/80 bg-card/60 px-3 py-2 sm:px-4">
						<h2 className="text-sm font-semibold text-foreground">HTML</h2>
						<p className="text-[11px] text-muted-foreground">추출 텍스트(alt 포함) → HTML 파일 목록</p>
					</div>

					<div
						ref={htmlSplitRef}
						className="grid min-h-0 min-w-0 flex-1 grid-cols-1 divide-y divide-border/70 md:divide-y-0"
						style={isMdUp ? { gridTemplateColumns: `minmax(220px, ${Math.round(htmlTextRatio * 100)}%) 10px minmax(180px, ${Math.round((1 - htmlTextRatio) * 100)}%)` } : undefined}
					>
						<div className="flex min-h-0 min-w-0 flex-col">
							<div className="shrink-0 border-b border-border/60 bg-card/40 px-3 py-2">
								<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">추출 텍스트 (alt 포함)</p>
							</div>
							<div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
								<pre className="whitespace-pre-wrap wrap-break-word font-sans text-xs leading-relaxed text-foreground">{htmlText || "HTML을 선택하거나 추출이 완료되면 텍스트가 표시됩니다."}</pre>
							</div>
						</div>

						<div className="hidden items-stretch bg-card/20 md:flex">
							<button
								type="button"
								aria-label="HTML 영역 비율 조절"
								title="드래그해서 너비 조절"
								onPointerDown={(e) => startResize("html", e)}
								className="group relative h-full w-full cursor-col-resize border-x border-border/70 bg-transparent transition-colors hover:bg-primary/5"
							>
								<span className="absolute top-1/2 left-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border group-hover:bg-primary/50" />
							</button>
						</div>

						<div className="flex min-h-0 min-w-0 flex-col">
							<div className="shrink-0 border-b border-border/60 bg-card/40 px-2 py-2">
								<input
									ref={zipInputRef}
									type="file"
									accept=".zip,application/zip,application/x-zip-compressed"
									className="sr-only"
									onChange={async (e) => {
										const f = e.target.files?.[0];
										e.target.value = "";
										if (!f) return;
										setZipBusy(true);
										try {
											setZipLabel(f.name);
										const extracted = await extractZipAssets(f);
										const rows: HtmlFileRow[] = extracted.htmlFiles.map((h) => ({
											id: h.relativePath,
											relativePath: h.relativePath,
											text: extractHtmlTextWithAlt(h.content),
										}));
										rows.sort((a, b) => {
											const aName = a.relativePath.split("/").pop() ?? a.relativePath;
											const bName = b.relativePath.split("/").pop() ?? b.relativePath;
											return aName.localeCompare(bName, "ko", { sensitivity: "base" }) || a.relativePath.localeCompare(b.relativePath, "ko", { sensitivity: "base" });
										});
										setHtmlFiles(rows);
										setSelectedHtmlId(rows[0]?.id ?? null);
										} finally {
											setZipBusy(false);
										}
									}}
								/>
								<button
									type="button"
									className={cn(
										"mb-2 flex w-full items-center gap-2 rounded-lg border-2 border-dashed bg-card px-2.5 py-2 text-left text-[11px] shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
										"border-primary/30 hover:border-primary/50 hover:bg-primary/3",
									)}
									disabled={zipBusy}
									onClick={openZipPicker}
									aria-label="퍼블리싱 산출물 ZIP 선택"
								>
									<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-cyan-400/25 text-primary">
										{zipBusy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <FileCode2 className="size-3" aria-hidden />}
									</div>
									<div className="min-w-0 flex-1">
										<p className="font-semibold text-foreground">ZIP 업로드</p>
										<p className="truncate text-[10px] text-muted-foreground">{zipLabel ?? "선택"}</p>
									</div>
									<Upload className="size-3.5 shrink-0 text-muted-foreground opacity-70" aria-hidden />
								</button>
								<div className="border-b border-border/50 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">HTML 파일</div>
							</div>
							<div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
								{htmlFiles.length === 0 ? (
									<p className="px-1 py-3 text-center text-xs leading-relaxed text-muted-foreground">ZIP을 올리면 HTML 목록이 표시됩니다.</p>
								) : (
									<ul className="flex flex-col gap-1">
										{htmlFiles.map((h) => (
											<li key={h.id}>
												<button
													type="button"
													onClick={() => setSelectedHtmlId(h.id)}
													className={cn(
														"w-full rounded-md px-2 py-1.5 text-left font-mono text-[11px] leading-snug break-all transition-colors",
														selectedHtmlId === h.id ? "bg-primary/15 font-medium text-primary" : "text-foreground hover:bg-muted/80",
													)}
												>
													{h.relativePath}
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
