"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, FileArchive, Image as ImageIcon, Layers, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractZipAssets } from "@/lib/client/extract-zip-assets";
import { cn } from "@/lib/utils";

type LocalImageAsset = {
	id: string;
	name: string;
	url: string;
	ext: "png" | "jpg" | "jpeg" | "psd";
};

type HtmlAsset = {
	id: string;
	relativePath: string;
	content: string;
};

function normalizePath(p: string): string {
	const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
	const stack: string[] = [];
	for (const part of parts) {
		if (part === ".") continue;
		if (part === "..") {
			stack.pop();
			continue;
		}
		stack.push(part);
	}
	return stack.join("/").toLowerCase();
}

function dirname(p: string): string {
	const s = p.replace(/\\/g, "/");
	const i = s.lastIndexOf("/");
	return i >= 0 ? s.slice(0, i) : "";
}

function resolveAttrToZipPath(htmlPath: string, attrValue: string): string | null {
	const raw = attrValue.trim();
	if (!raw || raw.startsWith("data:") || raw.startsWith("blob:") || /^https?:\/\//i.test(raw) || raw.startsWith("//")) return null;
	const noHash = raw.split("#")[0] ?? raw;
	const noQuery = noHash.split("?")[0] ?? noHash;
	let decoded = noQuery;
	try {
		decoded = decodeURIComponent(noQuery);
	} catch {
		// keep raw
	}
	if (decoded.startsWith("/")) {
		return normalizePath(decoded.replace(/^\/+/, ""));
	}
	return normalizePath(`${dirname(htmlPath)}/${decoded}`);
}

function isCssAssetPath(p: string): boolean {
	return /\.css$/i.test(p);
}

function rewriteCssWithZipAssets(css: string, cssRelativePath: string, assetUrlByPath: Map<string, string>): string {
	return css.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (match, _quote: string, rawUrl: string) => {
		const key = resolveAttrToZipPath(cssRelativePath, rawUrl);
		if (!key) return match;
		const blobUrl = assetUrlByPath.get(key);
		return blobUrl ? `url("${blobUrl}")` : match;
	});
}

function rewriteHtmlWithZipAssets(html: string, htmlRelativePath: string, assetUrlByPath: Map<string, string>): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const rewriteAttr = (selector: string, attr: "src" | "href" | "poster") => {
		for (const el of Array.from(doc.querySelectorAll(selector))) {
			const cur = el.getAttribute(attr);
			if (!cur) continue;
			const key = resolveAttrToZipPath(htmlRelativePath, cur);
			if (!key) continue;
			const blobUrl = assetUrlByPath.get(key);
			if (blobUrl) el.setAttribute(attr, blobUrl);
		}
	};

	rewriteAttr("img[src]", "src");
	rewriteAttr("script[src]", "src");
	rewriteAttr("iframe[src]", "src");
	rewriteAttr("source[src]", "src");
	rewriteAttr("video[src]", "src");
	rewriteAttr("audio[src]", "src");
	rewriteAttr("video[poster]", "poster");
	rewriteAttr("link[href]", "href");

	for (const el of Array.from(doc.querySelectorAll("[srcset]"))) {
		const srcset = el.getAttribute("srcset");
		if (!srcset) continue;
		const rewritten = srcset
			.split(",")
			.map((chunk) => {
				const parts = chunk.trim().split(/\s+/);
				const src = parts[0] ?? "";
				const descriptor = parts.slice(1).join(" ");
				const key = resolveAttrToZipPath(htmlRelativePath, src);
				const mapped = key ? assetUrlByPath.get(key) : undefined;
				if (!mapped) return chunk.trim();
				return descriptor ? `${mapped} ${descriptor}` : mapped;
			})
			.join(", ");
		el.setAttribute("srcset", rewritten);
	}

	return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

function isSupportedImageFile(file: File): file is File {
	return /\.(png|jpe?g|psd)$/i.test(file.name);
}

function extOf(name: string): LocalImageAsset["ext"] {
	const n = name.toLowerCase();
	if (n.endsWith(".png")) return "png";
	if (n.endsWith(".jpg")) return "jpg";
	if (n.endsWith(".jpeg")) return "jpeg";
	return "psd";
}

export function ImageComparatorWorkspace() {
	const imageInputRef = useRef<HTMLInputElement>(null);
	const zipInputRef = useRef<HTMLInputElement>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);

	const [images, setImages] = useState<LocalImageAsset[]>([]);
	const [htmlFiles, setHtmlFiles] = useState<HtmlAsset[]>([]);
	const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
	const [selectedHtmlId, setSelectedHtmlId] = useState<string | null>(null);
	const [imageBusy, setImageBusy] = useState(false);
	const [zipBusy, setZipBusy] = useState(false);
	const [notice, setNotice] = useState<string>("");
	const [iframeOpacity, setIframeOpacity] = useState(0.72);
	const [imageOpacity, setImageOpacity] = useState(0.6);
	const [assetUrlByPath, setAssetUrlByPath] = useState<Map<string, string>>(() => new Map());
	const [iframeScrollTop, setIframeScrollTop] = useState(0);
	const [htmlSize, setHtmlSize] = useState({ width: 0, height: 0 });
	const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
	const [overlayVisible, setOverlayVisible] = useState(true);
	const [overlayScale, setOverlayScale] = useState(1);
	const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });
	const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

	const selectedImage = useMemo(() => images.find((i) => i.id === selectedImageId) ?? null, [images, selectedImageId]);
	const selectedHtml = useMemo(() => htmlFiles.find((h) => h.id === selectedHtmlId) ?? null, [htmlFiles, selectedHtmlId]);
	const canPreviewImage = selectedImage && selectedImage.ext !== "psd";
	const renderedHtml = useMemo(() => {
		if (!selectedHtml) return "";
		return rewriteHtmlWithZipAssets(selectedHtml.content, selectedHtml.relativePath, assetUrlByPath);
	}, [assetUrlByPath, selectedHtml]);
	const imageRender = useMemo(() => {
		if (!canPreviewImage || imageNaturalSize.width === 0 || imageNaturalSize.height === 0) return null;
		const targetW = htmlSize.width > 0 ? htmlSize.width : imageNaturalSize.width;
		const scale = Math.max(0.01, targetW / imageNaturalSize.width);
		return {
			width: Math.max(1, Math.round(targetW)),
			height: Math.max(1, Math.round(imageNaturalSize.height * scale)),
		};
	}, [canPreviewImage, htmlSize.width, imageNaturalSize.height, imageNaturalSize.width]);

	useEffect(() => {
		setIframeScrollTop(0);
		setHtmlSize({ width: 0, height: 0 });
		setOverlayOffset({ x: 0, y: 0 });
		setOverlayScale(1);
	}, [selectedHtmlId]);

	useEffect(() => {
		if (!selectedImage || selectedImage.ext === "psd") {
			setImageNaturalSize({ width: 0, height: 0 });
			return;
		}
		const img = new Image();
		img.onload = () => setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
		img.src = selectedImage.url;
	}, [selectedImage]);

	const bindIframeScrollSync = useCallback(() => {
		const iframe = iframeRef.current;
		if (!iframe) return;
		const boundIframe = iframe as HTMLIFrameElement & { __cleanupScrollSync?: () => void };
		boundIframe.__cleanupScrollSync?.();

		const win = iframe.contentWindow;
		const doc = iframe.contentDocument;
		if (!win || !doc) return;
		let disposed = false;
		const timeoutIds: number[] = [];
		const rafIds: number[] = [];

		const onScroll = () => {
			const top = win.scrollY || doc.documentElement?.scrollTop || doc.body?.scrollTop || 0;
			setIframeScrollTop(top);
		};
		const syncSize = () => {
			const root = doc.documentElement;
			const body = doc.body;
			// root.clientWidth는 iframe 내부 세로 스크롤바 폭을 제외한 실제 콘텐츠 표시 폭입니다.
			const viewportWidth = root?.clientWidth || body?.clientWidth || win.innerWidth || 0;
			const height = Math.max(root?.scrollHeight ?? 0, body?.scrollHeight ?? 0, root?.clientHeight ?? 0, body?.clientHeight ?? 0);
			setHtmlSize({ width: viewportWidth, height });
		};
		const queueSyncSize = () => {
			if (disposed) return;
			const rafId = win.requestAnimationFrame(() => {
				if (!disposed) syncSize();
			});
			rafIds.push(rafId);
		};

		onScroll();
		syncSize();
		win.addEventListener("scroll", onScroll, { passive: true });
		win.addEventListener("resize", queueSyncSize);

		const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(queueSyncSize) : null;
		if (resizeObserver) {
			if (doc.documentElement) resizeObserver.observe(doc.documentElement);
			if (doc.body) resizeObserver.observe(doc.body);
		}

		for (const delay of [100, 300, 800]) {
			timeoutIds.push(win.setTimeout(queueSyncSize, delay));
		}

		const cleanup = () => {
			disposed = true;
			win.removeEventListener("scroll", onScroll);
			win.removeEventListener("resize", queueSyncSize);
			resizeObserver?.disconnect();
			for (const timeoutId of timeoutIds) win.clearTimeout(timeoutId);
			for (const rafId of rafIds) win.cancelAnimationFrame(rafId);
		};
		iframe.dataset.scrollSyncBound = "1";
		boundIframe.__cleanupScrollSync = cleanup;
	}, []);

	useEffect(() => {
		const iframe = iframeRef.current as (HTMLIFrameElement & { __cleanupScrollSync?: () => void }) | null;
		return () => {
			iframe?.__cleanupScrollSync?.();
		};
	}, [selectedHtmlId]);

	useEffect(() => {
		return () => {
			for (const img of images) URL.revokeObjectURL(img.url);
		};
	}, [images]);

	useEffect(() => {
		return () => {
			for (const v of assetUrlByPath.values()) URL.revokeObjectURL(v);
		};
	}, [assetUrlByPath]);

	const onAddImages = useCallback(async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		setImageBusy(true);
		try {
			const picked = Array.from(files).filter(isSupportedImageFile);
			if (picked.length === 0) {
				setNotice("png, jpg, jpeg, psd 파일만 업로드할 수 있습니다.");
				return;
			}
			setNotice("");
			const newRows = picked.map((f) => ({
				id: crypto.randomUUID(),
				name: f.name,
				url: URL.createObjectURL(f),
				ext: extOf(f.name),
			}));
			setImages((prev) => {
				const next = [...prev];
				next.push(...newRows);
				return next;
			});
			setSelectedImageId((prev) => prev ?? newRows[0]?.id ?? null);
		} finally {
			setImageBusy(false);
		}
	}, []);

	const onAddZip = useCallback(
		async (file: File | null) => {
			if (!file) return;
			setZipBusy(true);
			try {
				for (const v of assetUrlByPath.values()) URL.revokeObjectURL(v);
				const extracted = await extractZipAssets(file);
				const rows: HtmlAsset[] = [];
				const nextAssetMap = new Map<string, string>();
				for (const h of extracted.htmlFiles) {
					rows.push({
						id: h.relativePath,
						relativePath: h.relativePath,
						content: h.content,
					});
				}
				const cssAssets: typeof extracted.assets = [];
				for (const asset of extracted.assets) {
					if (isCssAssetPath(asset.relativePath)) {
						cssAssets.push(asset);
					} else {
						nextAssetMap.set(normalizePath(asset.relativePath), URL.createObjectURL(asset.blob));
					}
				}
				for (const asset of cssAssets) {
					const css = await asset.blob.text();
					const rewrittenCss = rewriteCssWithZipAssets(css, asset.relativePath, nextAssetMap);
					const cssBlob = new Blob([rewrittenCss], { type: "text/css" });
					nextAssetMap.set(normalizePath(asset.relativePath), URL.createObjectURL(cssBlob));
				}
				rows.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "ko", { sensitivity: "base" }));
				setHtmlFiles(rows);
				setAssetUrlByPath(nextAssetMap);
				setSelectedHtmlId(rows[0]?.id ?? null);
				setNotice(rows.length === 0 ? "ZIP에서 HTML 파일을 찾지 못했습니다." : "");
			} catch {
				setNotice("ZIP 처리 중 오류가 발생했습니다.");
			} finally {
				setZipBusy(false);
			}
		},
		[assetUrlByPath],
	);

	useEffect(() => {
		if (!selectedImageId && images.length > 0) setSelectedImageId(images[0].id);
	}, [images, selectedImageId]);

	const handleClear = useCallback(() => {
		for (const img of images) URL.revokeObjectURL(img.url);
		for (const v of assetUrlByPath.values()) URL.revokeObjectURL(v);
		setImages([]);
		setHtmlFiles([]);
		setAssetUrlByPath(new Map());
		setSelectedHtmlId(null);
		setSelectedImageId(null);
		setNotice("");
		setOverlayOffset({ x: 0, y: 0 });
		setOverlayScale(1);
		setOverlayVisible(true);
	}, [assetUrlByPath, images]);

	const resetOverlay = useCallback(() => {
		setOverlayOffset({ x: 0, y: 0 });
		setOverlayScale(1);
	}, []);

	const onOverlayPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.preventDefault();
			dragRef.current = {
				pointerId: e.pointerId,
				startX: e.clientX,
				startY: e.clientY,
				startOffsetX: overlayOffset.x,
				startOffsetY: overlayOffset.y,
			};
			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[overlayOffset.x, overlayOffset.y],
	);

	const onOverlayPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const d = dragRef.current;
		if (!d || d.pointerId !== e.pointerId) return;
		setOverlayOffset({
			x: d.startOffsetX + (e.clientX - d.startX),
			y: d.startOffsetY + (e.clientY - d.startY),
		});
	}, []);

	const onOverlayPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const d = dragRef.current;
		if (!d || d.pointerId !== e.pointerId) return;
		dragRef.current = null;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			// no-op
		}
	}, []);

	const onOverlayWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
		e.preventDefault();
		if (!e.ctrlKey && !e.metaKey) {
			iframeRef.current?.contentWindow?.scrollBy({ left: e.deltaX, top: e.deltaY, behavior: "auto" });
			return;
		}
		const delta = e.deltaY > 0 ? -0.04 : 0.04;
		setOverlayScale((prev) => Math.max(0.2, Math.min(3, prev + delta)));
	}, []);

	const compareHint = !selectedImage || !selectedHtml ? "왼쪽에서 이미지와 HTML을 각각 선택하면 비교 화면이 표시됩니다." : "";

	return (
		<div className="flex h-[calc(100vh-5rem)] min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-(--app-canvas) shadow-sm">
			<aside className="flex w-full shrink-0 flex-col border-b border-border/80 bg-card/60 lg:w-80 lg:border-r lg:border-b-0">
				<div className="border-b border-border/80 px-3 py-3">
					<h2 className="text-sm font-semibold">이미지 대조</h2>
					<p className="mt-1 text-xs text-muted-foreground">이미지(png/jpg)와 퍼블 ZIP 내 HTML을 선택해 겹쳐 비교합니다.</p>
				</div>

				<div className="space-y-2 border-b border-border/80 p-2">
					<input
						ref={imageInputRef}
						type="file"
						accept=".png,.jpg,.jpeg,.psd,image/png,image/jpeg"
						multiple
						className="sr-only"
						onChange={async (e) => {
							await onAddImages(e.target.files);
							e.target.value = "";
						}}
					/>
					<button type="button" onClick={() => imageInputRef.current?.click()} disabled={imageBusy} className={cn("flex w-full items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 text-left text-xs transition-colors", "border-primary/30 hover:border-primary/50 hover:bg-primary/3")}>
						{imageBusy ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
						<span>이미지 업로드 (png, jpg)</span>
						<Upload className="ml-auto size-4 opacity-70" />
					</button>

					<input
						ref={zipInputRef}
						type="file"
						accept=".zip,application/zip,application/x-zip-compressed"
						className="sr-only"
						onChange={async (e) => {
							await onAddZip(e.target.files?.[0] ?? null);
							e.target.value = "";
						}}
					/>
					<button type="button" onClick={() => zipInputRef.current?.click()} disabled={zipBusy} className={cn("flex w-full items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 text-left text-xs transition-colors", "border-primary/30 hover:border-primary/50 hover:bg-primary/3")}>
						{zipBusy ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
						<span>퍼블리싱 ZIP 업로드</span>
						<Upload className="ml-auto size-4 opacity-70" />
					</button>
				</div>

				<div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border/80">
					<section className="min-h-0 p-2">
						<p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">이미지 목록</p>
						<div className="app-scrollbar h-36 overflow-y-auto rounded border border-border/60 p-1">
							{images.length === 0 ? (
								<p className="p-2 text-xs text-muted-foreground">이미지를 업로드해 주세요.</p>
							) : (
								<ul className="space-y-1">
									{images.map((img) => (
										<li key={img.id}>
											<button type="button" onClick={() => setSelectedImageId(img.id)} className={cn("w-full rounded px-2 py-1 text-left text-xs", selectedImageId === img.id ? "bg-primary/15 text-primary" : "hover:bg-muted")}>
												{img.name}
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					</section>

					<section className="min-h-0 p-2">
						<p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">HTML 목록</p>
						<div className="app-scrollbar h-40 overflow-y-auto rounded border border-border/60 p-1">
							{htmlFiles.length === 0 ? (
								<p className="p-2 text-xs text-muted-foreground">ZIP 업로드 후 HTML을 선택해 주세요.</p>
							) : (
								<ul className="space-y-1">
									{htmlFiles.map((h) => (
										<li key={h.id}>
											<button type="button" onClick={() => setSelectedHtmlId(h.id)} className={cn("w-full rounded px-2 py-1 text-left font-mono text-[11px]", selectedHtmlId === h.id ? "bg-primary/15 text-primary" : "hover:bg-muted")}>
												{h.relativePath}
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					</section>
				</div>

				<div className="border-t border-border/80 p-2">
					<div className="mb-2 flex items-center gap-2 text-xs">
						<Layers className="size-4 text-muted-foreground" />
						<label htmlFor="iframe-opacity">퍼블 화면 투명도</label>
					</div>
					<input id="iframe-opacity" type="range" min={0.1} max={1} step={0.01} value={iframeOpacity} onChange={(e) => setIframeOpacity(Number(e.target.value))} className="w-full" />
					<div className="mt-2 flex items-center gap-2 text-xs">
						<ImageIcon className="size-4 text-muted-foreground" />
						<label htmlFor="image-opacity">이미지 투명도</label>
					</div>
					<input id="image-opacity" type="range" min={0.05} max={1} step={0.01} value={imageOpacity} onChange={(e) => setImageOpacity(Number(e.target.value))} className="w-full" />
					<div className="mt-2 space-y-2 rounded border border-border/60 p-2">
						<div className="flex items-center justify-between text-xs">
							<span>이미지 오버레이</span>
							<button type="button" className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted" onClick={() => setOverlayVisible((v) => !v)}>
								{overlayVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
								{overlayVisible ? "보임" : "숨김"}
							</button>
						</div>
						<div className="text-[11px] text-muted-foreground">휠: HTML 스크롤 · 드래그: 이동 · Ctrl/⌘+휠: 확대/축소</div>
						<label htmlFor="overlay-scale" className="text-[11px] text-muted-foreground">
							배율 ({Math.round(overlayScale * 100)}%)
						</label>
						<input id="overlay-scale" type="range" min={0.2} max={3} step={0.01} value={overlayScale} onChange={(e) => setOverlayScale(Number(e.target.value))} className="w-full" />
						<div className="flex justify-end">
							<Button type="button" variant="outline" size="sm" onClick={resetOverlay}>
								<RotateCcw className="mr-1 size-4" />
								정렬 리셋
							</Button>
						</div>
					</div>
					<div className="mt-2 flex justify-end">
						<Button type="button" variant="outline" size="sm" onClick={handleClear}>
							<Trash2 className="mr-1 size-4" />
							초기화
						</Button>
					</div>
					{notice ? <p className="mt-2 text-xs text-destructive">{notice}</p> : null}
				</div>
			</aside>

			<section className="min-h-0 min-w-0 flex-1 bg-muted/20 p-3">
				<div className="relative h-full w-full overflow-hidden rounded-lg border border-border/70 bg-black/5">
					{selectedImage && selectedImage.ext === "psd" ? <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">PSD 파일은 브라우저에서 직접 배경 렌더링이 어려워 현재 미리보기를 지원하지 않습니다. PNG/JPG를 선택하면 즉시 비교할 수 있습니다.</div> : null}

					{canPreviewImage && imageRender && overlayVisible ? (
						<div
							className="absolute top-0 left-0 z-10 cursor-grab active:cursor-grabbing will-change-transform"
							style={{
								width: imageRender.width,
								height: imageRender.height,
								transform: `translate(${overlayOffset.x}px, ${overlayOffset.y - iframeScrollTop}px) scale(${overlayScale})`,
								transformOrigin: "top left",
								opacity: imageOpacity,
							}}
							onPointerDown={onOverlayPointerDown}
							onPointerMove={onOverlayPointerMove}
							onPointerUp={onOverlayPointerUp}
							onPointerCancel={onOverlayPointerUp}
							onWheel={onOverlayWheel}
						>
							<img src={selectedImage.url} alt="" className="h-full w-full object-fill select-none" draggable={false} />
						</div>
					) : null}

					{selectedHtml ? <iframe ref={iframeRef} title="퍼블리싱 HTML 비교 프리뷰" className="absolute inset-0 h-full w-full border-0" style={{ opacity: iframeOpacity, background: "transparent" }} srcDoc={renderedHtml} onLoad={bindIframeScrollSync} /> : null}

					{compareHint ? <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">{compareHint}</div> : null}
				</div>
			</section>
		</div>
	);
}
