"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Joyride, EVENTS, STATUS, type EventData } from "react-joyride";
import { Ban, Check, Download, Loader2, Trash2, Upload, X } from "lucide-react";
import { List, type ListImperativeAPI } from "react-window";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { extractZipAssets, isZipFile, MAX_HTML_ENTRIES, zipArchiveLabel } from "@/lib/client/extract-zip-assets";
import { getExistingAltFromHtmlForImage } from "@/lib/client/existing-alt-from-html";
import { excelDeliverableImagePathLabel } from "@/lib/client/deliverable-image-path-label";
import { pathLabelLookupKey, parseAltReviewDeliverableExcel } from "@/lib/client/parse-alt-review-excel";
import { ImageListRow } from "@/components/image-list-row";
import { ImageViewerZoom } from "@/components/image-viewer-zoom";
import { EditablePlainText } from "@/components/editable-plain-text";
import { getInspectionTutorialSteps, INSPECTION_TUTORIAL_DEMO_TEXT } from "@/lib/tutorial-inspection-joyride-steps";

const MAX_IMAGES = 200;
const LIST_ITEM_HEIGHT = 52;

type InspectionItem = {
	id: string;
	name: string;
	url: string;
	htmlAlt: string;
	excludedFromTarget: boolean;
	outcome: "pending" | "pass" | "fail";
};

type HtmlAsset = {
	id: string;
	relativePath: string;
	content: string;
	originalContent: string;
};

type ReviewComment = {
	id: string;
	imageName: string;
	status: "PASS" | "FAIL";
	selectedText: string;
	note: string;
};

type SelectionRange = {
	start: number;
	end: number;
};

function isExcelUploadFile(file: File): boolean {
	const n = file.name.toLowerCase();
	return file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || n.endsWith(".xlsx");
}

function excelAltForItem(name: string, allNames: string[], excelAltByPath: Map<string, string>): string {
	const label = excelDeliverableImagePathLabel(name, allNames);
	return excelAltByPath.get(pathLabelLookupKey(label)) ?? "";
}

function fileNameOnly(pathLike: string): string {
	return pathLike.split("/").pop() ?? pathLike;
}

export function AltInspectionWorkspace() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<ListImperativeAPI | null>(null);
	const joyrideTutorialActiveRef = useRef(false);
	const [runTutorialJoyride, setRunTutorialJoyride] = useState(false);
	const tutorialSteps = useMemo(() => getInspectionTutorialSteps(), []);
	const [tutorialInjected, setTutorialInjected] = useState(false);
	const [items, setItems] = useState<InspectionItem[]>([]);
	const [htmlAssets, setHtmlAssets] = useState<HtmlAsset[]>([]);
	const [excelAltByPath, setExcelAltByPath] = useState<Map<string, string>>(() => new Map());
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isParsingZip, setIsParsingZip] = useState(false);
	const [isParsingExcel, setIsParsingExcel] = useState(false);
	const [sideNotice, setSideNotice] = useState<string | null>(null);
	const [dropActive, setDropActive] = useState(false);
	const [commentsByImage, setCommentsByImage] = useState<Record<string, ReviewComment[]>>({});
	const excelAltRef = useRef<HTMLDivElement | null>(null);
	const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [selectionTooltip, setSelectionTooltip] = useState<{ selectedText: string; x: number; y: number } | null>(null);
	const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
	const [commentDraft, setCommentDraft] = useState("");
	const [excelSourceFileName, setExcelSourceFileName] = useState<string>("");

	const selected = items.find((i) => i.id === selectedId) ?? null;
	const itemNames = useMemo(() => items.map((i) => i.name), [items]);
	const selectedDeliverableLabel = useMemo(() => (selected ? excelDeliverableImagePathLabel(selected.name, itemNames) : null), [selected, itemNames]);
	const selectedExcelAlt = useMemo(() => (selected ? excelAltForItem(selected.name, itemNames, excelAltByPath) : ""), [selected, itemNames, excelAltByPath]);
	const selectedComments = selected ? (commentsByImage[selected.id] ?? []) : [];

	const reviewTargetCount = items.filter((i) => !i.excludedFromTarget).length;
	const decidedCount = items.filter((i) => !i.excludedFromTarget && (i.outcome === "pass" || i.outcome === "fail")).length;
	const excludedCount = items.filter((i) => i.excludedFromTarget).length;
	const total = items.length;
	const progressPct = reviewTargetCount > 0 ? Math.round((decidedCount / reviewTargetCount) * 100) : 0;
	const canDownloadInspectionReport = items.length > 0 && items.every((it) => it.excludedFromTarget || it.outcome === "pass" || it.outcome === "fail");

	const itemsRef = useRef<InspectionItem[]>([]);
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
				if (it.htmlAlt.trim() !== "") return it;
				const fromHtml = getExistingAltFromHtmlForImage(it.name, htmlAssets);
				if (!fromHtml) return it;
				changed = true;
				return { ...it, htmlAlt: fromHtml };
			});
			return changed ? next : prev;
		});
	}, [htmlAssets]);

	useEffect(() => {
		if (!selectedId) return;
		const rowIndex = items.findIndex((it) => it.id === selectedId);
		if (rowIndex < 0) return;
		listRef.current?.scrollToRow({ index: rowIndex, align: "smart" });
		const rafId = window.requestAnimationFrame(() => {
			const root = listRef.current?.element;
			const button = root?.querySelector<HTMLButtonElement>(`button[data-item-id="${selectedId}"]`);
			button?.focus({ preventScroll: true });
		});
		return () => window.cancelAnimationFrame(rafId);
	}, [selectedId, items]);

	useEffect(() => {
		setSelectionTooltip(null);
		setSelectionRange(null);
		setCommentDraft("");
	}, [selectedId]);

	useEffect(() => {
		if (!selectionTooltip) return;
		const id = window.setTimeout(() => {
			commentTextareaRef.current?.focus();
		}, 0);
		return () => window.clearTimeout(id);
	}, [selectionTooltip]);

	useEffect(() => {
		const t = searchParams.get("tutorial");
		if (t === "1" || t === "true") {
			setRunTutorialJoyride(true);
			router.replace("/inspection", { scroll: false });
		}
	}, [searchParams, router]);

	const handleAddFiles = useCallback(
		async (fileList: FileList | null) => {
			if (!fileList?.length) return;
			setSideNotice(null);
			setIsParsingZip(true);

			try {
				const files = Array.from(fileList);
				const newImages: InspectionItem[] = [];
				const newHtml: HtmlAsset[] = [];
				let room = MAX_IMAGES - items.length;
				const priorHtmlCount = htmlAssetsRef.current.length;

				for (const file of files) {
					if (isExcelUploadFile(file)) {
						setIsParsingExcel(true);
						try {
							const map = await parseAltReviewDeliverableExcel(file);
							setExcelSourceFileName(file.name);
							setExcelAltByPath((prev) => {
								const next = new Map(prev);
								for (const [k, v] of map) next.set(k, v);
								return next;
							});
						} catch (e) {
							setSideNotice(e instanceof Error ? e.message : "엑셀을 읽는 중 오류가 났습니다.");
						} finally {
							setIsParsingExcel(false);
						}
						continue;
					}

					if (isZipFile(file)) {
						const { images, htmlFiles } = await extractZipAssets(file);
						const base = zipArchiveLabel(file.name);
						for (const h of htmlFiles) {
							if (priorHtmlCount + newHtml.length >= MAX_HTML_ENTRIES) break;
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
								htmlAlt: "",
								excludedFromTarget: false,
								outcome: "pending",
							});
							room -= 1;
						}
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
							htmlAlt: getExistingAltFromHtmlForImage(img.name, mergedHtmlSnapshot),
						}));
						return [...prev, ...stamped].slice(0, MAX_IMAGES);
					});
					setSelectedId((cur) => cur ?? newImages[0].id);
				} else if (newHtml.length > 0) {
					setItems((prev) => {
						if (prev.length === 0) return prev;
						return prev.map((img) => {
							if (img.htmlAlt.trim() !== "") return img;
							const fromHtml = getExistingAltFromHtmlForImage(img.name, mergedHtmlSnapshot);
							if (fromHtml) return { ...img, htmlAlt: fromHtml };
							return img;
						});
					});
				}
			} catch (e) {
				setSideNotice(e instanceof Error ? e.message : "ZIP을 읽는 중 오류가 났습니다.");
			} finally {
				setIsParsingZip(false);
			}
		},
		[items.length],
	);

	const updateSelectedHtmlAlt = useCallback(
		(text: string) => {
			setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, htmlAlt: text } : it)));
		},
		[selectedId],
	);

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
			const next = prev.map((it) => (it.id === selectedId ? { ...it, excludedFromTarget: true, outcome: "pending" as const } : it));
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

	const handlePass = useCallback(() => {
		if (!selectedId) return;
		setItems((prev) => {
			const next = prev.map((it) => (it.id === selectedId ? { ...it, outcome: "pass" as const } : it));
			const idx = prev.findIndex((i) => i.id === selectedId);
			const nextPending = next.findIndex((it, j) => j > idx && !it.excludedFromTarget && it.outcome === "pending");
			if (nextPending >= 0) setSelectedId(next[nextPending].id);
			else {
				const anyPending = next.findIndex((it) => !it.excludedFromTarget && it.outcome === "pending");
				if (anyPending >= 0) setSelectedId(next[anyPending].id);
				else if (idx >= 0 && idx < next.length - 1) setSelectedId(next[idx + 1].id);
			}
			return next;
		});
	}, [selectedId]);

	const handleFail = useCallback(() => {
		if (!selectedId) return;
		setItems((prev) => {
			const next = prev.map((it) => (it.id === selectedId ? { ...it, outcome: "fail" as const } : it));
			const idx = prev.findIndex((i) => i.id === selectedId);
			const nextPending = next.findIndex((it, j) => j > idx && !it.excludedFromTarget && it.outcome === "pending");
			if (nextPending >= 0) setSelectedId(next[nextPending].id);
			else {
				const anyPending = next.findIndex((it) => !it.excludedFromTarget && it.outcome === "pending");
				if (anyPending >= 0) setSelectedId(next[anyPending].id);
				else if (idx >= 0 && idx < next.length - 1) setSelectedId(next[idx + 1].id);
			}
			return next;
		});
	}, [selectedId]);

	const openFilePicker = useCallback(() => {
		inputRef.current?.click();
	}, []);

	const handleClearUploads = useCallback(() => {
		if (itemsRef.current.length === 0 && htmlAssetsRef.current.length === 0 && excelAltByPath.size === 0) return;
		if (!window.confirm("업로드된 ZIP·HTML·엑셀 데이터를 모두 삭제할까요?")) return;
		for (const it of itemsRef.current) {
			URL.revokeObjectURL(it.url);
		}
		setItems([]);
		setHtmlAssets([]);
		setExcelAltByPath(new Map());
		setExcelSourceFileName("");
		setCommentsByImage({});
		setSelectedId(null);
		setSideNotice(null);
	}, [excelAltByPath.size]);

	const getSelectionRangeInContainer = useCallback((container: HTMLElement, range: Range): SelectionRange | null => {
		const preStart = document.createRange();
		preStart.selectNodeContents(container);
		preStart.setEnd(range.startContainer, range.startOffset);

		const preEnd = document.createRange();
		preEnd.selectNodeContents(container);
		preEnd.setEnd(range.endContainer, range.endOffset);

		const start = preStart.toString().length;
		const end = preEnd.toString().length;
		if (end <= start) return null;
		return { start, end };
	}, []);

	const openSelectionTooltip = useCallback(() => {
		if (!selected || selected.excludedFromTarget) return;
		const root = excelAltRef.current;
		if (!root) return;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
			setSelectionTooltip(null);
			setSelectionRange(null);
			return;
		}
		const range = sel.getRangeAt(0);
		const common = range.commonAncestorContainer;
		if (!root.contains(common.nodeType === Node.ELEMENT_NODE ? common : common.parentNode)) {
			setSelectionTooltip(null);
			setSelectionRange(null);
			return;
		}
		const selectedText = sel.toString().trim();
		if (!selectedText) {
			setSelectionTooltip(null);
			setSelectionRange(null);
			return;
		}
		const offsets = getSelectionRangeInContainer(root, range);
		if (!offsets) {
			setSelectionTooltip(null);
			setSelectionRange(null);
			return;
		}
		const rect = range.getBoundingClientRect();
		const tipW = 288;
		const margin = 8;
		const viewportW = window.innerWidth;
		setSelectionRange(offsets);
		setSelectionTooltip({
			selectedText,
			x: Math.max(margin, Math.min(viewportW - tipW - margin, rect.left)),
			y: rect.bottom + 6,
		});
		setCommentDraft("");
	}, [getSelectionRangeInContainer, selected]);

	const handleConfirmComment = useCallback(() => {
		if (!selected || !selectionTooltip) return;
		const note = commentDraft.trim();
		if (!note) return;
		const status: "PASS" | "FAIL" = selected.outcome === "pass" ? "PASS" : "FAIL";
		const next: ReviewComment = {
			id: crypto.randomUUID(),
			imageName: selected.name,
			status,
			selectedText: selectionTooltip.selectedText,
			note,
		};
		setCommentsByImage((prev) => ({
			...prev,
			[selected.id]: [...(prev[selected.id] ?? []), next],
		}));
		setSelectionTooltip(null);
		setSelectionRange(null);
		setCommentDraft("");
		window.getSelection()?.removeAllRanges();
	}, [commentDraft, selected, selectionTooltip]);

	const handleDownloadInspectionReport = useCallback(() => {
		const today = new Date().toISOString().slice(0, 10);
		const reviewItems = items.filter((it) => !it.excludedFromTarget);
		const passItems = reviewItems.filter((it) => it.outcome === "pass");
		const failItems = reviewItems.filter((it) => it.outcome === "fail");
		const pendingItems = reviewItems.filter((it) => it.outcome === "pending");
		const totalCount = reviewItems.length;

		const imageLabelByKey = new Map<string, string>();
		for (const it of items) {
			const label = excelDeliverableImagePathLabel(it.name, itemNames);
			imageLabelByKey.set(pathLabelLookupKey(label), label);
		}
		const imageKeys = new Set(imageLabelByKey.keys());
		const excelKeys = new Set(excelAltByPath.keys());
		// 엑셀 목록에는 있으나 업로드 이미지가 없는 경우: "이미지 행"(alt가 비어있지 않은 행)만 체크
		const excelOnly = [...excelKeys]
			.filter((k) => !imageKeys.has(k))
			.filter((k) => (excelAltByPath.get(k) ?? "").trim().length > 0)
			.map((k) => fileNameOnly(k));
		const imageOnly = [...imageKeys].filter((k) => !excelKeys.has(k)).map((k) => fileNameOnly(imageLabelByKey.get(k) ?? k));

		const lines: string[] = [];
		lines.push("==================================================");
		lines.push(`       ALT-TEXT 검수 결과 보고서 (${today})`);
		lines.push("==================================================");
		lines.push("");
		lines.push("[1] 검수 내역 (이미지별 상세)");
		lines.push("--------------------------------------------------");
		reviewItems.forEach((it, idx) => {
			const seq = String(idx + 1).padStart(2, "0");
			const status = it.outcome === "pass" ? "PASS" : it.outcome === "fail" ? "FAIL" : "PENDING";
			const comments = commentsByImage[it.id] ?? [];
			lines.push(`${seq}. 이미지명: ${fileNameOnly(it.name)}`);
			lines.push(`    상태: [${status}]`);
			if (comments.length === 0) {
				lines.push("    코멘트: -");
			} else {
				lines.push("    코멘트:");
				for (const c of comments) {
					lines.push(`    > 선택 영역: "${c.selectedText}"`);
					lines.push(`    > 수정 사항: ${c.note}`);
				}
			}
			lines.push("");
		});
		lines.push("--------------------------------------------------");
		lines.push("");
		lines.push("[2] FAIL 리스트");
		lines.push("--------------------------------------------------");
		if (failItems.length === 0) {
			lines.push("// fail 리스트만 표출");
		} else {
			failItems.forEach((it, idx) => {
				const seq = String(idx + 1).padStart(2, "0");
				lines.push(`${seq}. 이미지명: ${fileNameOnly(it.name)}`);
				const comments = commentsByImage[it.id] ?? [];
				if (comments.length === 0) {
					lines.push("    코멘트: -");
				} else {
					lines.push("    코멘트:");
					for (const c of comments) {
						lines.push(`    > 선택 영역: "${c.selectedText}"`);
						lines.push(`    > 수정 사항: ${c.note}`);
					}
				}
				lines.push("");
			});
		}
		lines.push("--------------------------------------------------");
		lines.push("");
		lines.push("[3] 파일 불일치 리스트 (데이터 무결성)");
		lines.push("--------------------------------------------------");
		lines.push("※ 엑셀 목록에는 있으나, 업로드된 폴더 내 이미지 파일이 없는 경우:");
		if (excelOnly.length === 0) lines.push("   - 없음");
		else excelOnly.forEach((n) => lines.push(`   - ${n}`));
		lines.push("");
		lines.push("※ 업로드된 이미지 파일은 있으나, 엑셀 목록에는 없는 경우:");
		if (imageOnly.length === 0) lines.push("   - 없음");
		else imageOnly.forEach((n) => lines.push(`   - ${n}`));
		lines.push("");
		lines.push("--------------------------------------------------");
		lines.push(`[검수 완료] 총 ${totalCount}건 중 PASS: ${passItems.length}, FAIL: ${failItems.length}${pendingItems.length > 0 ? `, PENDING: ${pendingItems.length}` : ""}`);
		lines.push("==================================================");

		const excelBase = excelSourceFileName.replace(/\.xlsx$/i, "") || "엑셀";
		const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${excelBase}_검수결과_${today}.txt`;
		a.rel = "noopener";
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}, [commentsByImage, excelAltByPath, excelSourceFileName, itemNames, items]);

	const handleJoyrideEvent = useCallback((data: EventData) => {
		const afterCommit = (fn: () => void) => {
			queueMicrotask(fn);
		};

		if (data.type === EVENTS.TOUR_START) {
			joyrideTutorialActiveRef.current = true;
			if (itemsRef.current.length === 0) {
				const demoId = "inspection-tutorial-1";
				setItems([
					{
						id: demoId,
						name: "tutorial_1.png",
						url: "/tutorial_1.png",
						htmlAlt: INSPECTION_TUTORIAL_DEMO_TEXT,
						excludedFromTarget: false,
						outcome: "pending",
					},
				]);
				setSelectedId(demoId);
				setExcelAltByPath(new Map([[pathLabelLookupKey("tutorial_1.png"), INSPECTION_TUTORIAL_DEMO_TEXT]]));
				setTutorialInjected(true);
			}
			return;
		}

		if (data.type === EVENTS.STEP_BEFORE && tutorialInjected) {
			const demoId = "inspection-tutorial-1";
			if (data.index === 4) {
				// Step 5: 엑셀 ALT에서 드래그 + 코멘트 툴팁 열린 상태
				afterCommit(() => {
					const sample = "대체텍스트";
					const start = INSPECTION_TUTORIAL_DEMO_TEXT.indexOf(sample);
					if (start >= 0) {
						setSelectionRange({ start, end: start + sample.length });
					}
					const rect = excelAltRef.current?.getBoundingClientRect();
					setSelectionTooltip({
						selectedText: sample,
						x: rect ? Math.min(window.innerWidth - 300, rect.left + 24) : 240,
						y: rect ? rect.top + 90 : 220,
					});
					setCommentDraft("해당 문구를 좀 더 구체적으로 보완해 주세요.");
				});
			}
			if (data.index === 5) {
				// Step 6: 검수 코멘트 예시
				afterCommit(() => {
					setSelectionTooltip(null);
					setCommentDraft("");
					setCommentsByImage((prev) => ({
						...prev,
						[demoId]: [
							{
								id: "inspection-tutorial-comment-1",
								imageName: "tutorial_1.png",
								status: "FAIL",
								selectedText: "대체텍스트",
								note: "문맥상 핵심 정보가 부족합니다. 상품 핵심 문구를 포함해 주세요.",
							},
						],
					}));
				});
			}
			if (data.index === 6) {
				// Step 7: 진행률 1건 완료 상태
				afterCommit(() => {
					setItems((prev) => prev.map((it) => (it.id === demoId ? { ...it, outcome: "pass" } : it)));
				});
			}
		}

		if (data.type === EVENTS.TOUR_END || (data.type === EVENTS.TOUR_STATUS && (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED))) {
			joyrideTutorialActiveRef.current = false;
			setRunTutorialJoyride(false);
			if (tutorialInjected) {
				setItems([]);
				setSelectedId(null);
				setExcelAltByPath(new Map());
				setCommentsByImage({});
				setSelectionRange(null);
				setSelectionTooltip(null);
				setCommentDraft("");
				setTutorialInjected(false);
			}
		}
	}, [tutorialInjected]);

	const listRows = useMemo(
		() =>
			items.map((it) => ({
				id: it.id,
				name: it.name,
				url: it.url,
				excludedFromTarget: it.excludedFromTarget,
				outcome: it.outcome,
			})),
		[items],
	);

	const busy = isParsingZip || isParsingExcel;

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
								disabled={(total === 0 && htmlAssets.length === 0 && excelAltByPath.size === 0) || busy}
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
							accept="application/zip,application/x-zip-compressed,.zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
							multiple
							className="sr-only"
							onChange={async (e) => {
								await handleAddFiles(e.target.files);
								e.target.value = "";
							}}
						/>
						<button
							type="button"
							data-tutorial="inspection-upload"
							className={cn("mb-2 flex w-full flex-col items-stretch gap-2 rounded-xl border-2 border-dashed bg-card px-2.5 py-2.5 text-left shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", dropActive ? "border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30" : "border-primary/30 hover:border-primary/50 hover:bg-primary/3")}
							disabled={busy}
							onClick={openFilePicker}
							onDragOver={(e) => {
								e.preventDefault();
								e.stopPropagation();
								if (!busy) setDropActive(true);
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
								if (busy) return;
								await handleAddFiles(e.dataTransfer.files);
							}}
							aria-label="퍼블리싱 ZIP 또는 대체텍스트 엑셀 추가"
						>
							<div className="flex items-center justify-center">
								<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-cyan-400/25 text-primary">{busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}</div>
							</div>
							<div className="text-center">
								<p className="text-[11px] leading-tight font-semibold text-foreground">{busy ? "처리 중…" : "ZIP · 엑셀"}</p>
								<p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">퍼블리싱 ZIP + 산출물 xlsx</p>
							</div>
						</button>
					</div>

					{htmlAssets.length > 0 ? (
						<p className="shrink-0 border-b border-border/80 bg-primary/6 px-3 py-2 text-xs leading-snug text-muted-foreground">
							HTML <strong className="text-foreground">{htmlAssets.length}</strong>개 · alt 매칭용
						</p>
					) : null}
					{excelAltByPath.size > 0 ? (
						<p className="shrink-0 border-b border-border/80 bg-emerald-500/8 px-3 py-2 text-xs leading-snug text-muted-foreground">
							엑셀 행 <strong className="text-foreground">{excelAltByPath.size}</strong>개 로드됨
						</p>
					) : null}
					{sideNotice ? <p className="mx-2 mt-2 shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">{sideNotice}</p> : null}

					<div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-2" data-tutorial="inspection-image-list">
						{items.length === 0 ? (
							<p className="px-1 py-4 text-center text-sm text-muted-foreground">퍼블리싱 ZIP과 대체텍스트 엑셀(xlsx)을 추가하면 목록이 표시됩니다.</p>
						) : (
							<div className="min-h-0 h-full">
								<List rowCount={items.length} rowHeight={LIST_ITEM_HEIGHT} rowComponent={ImageListRow} rowProps={{ items: listRows, itemNames, selectedId, onSelect: setSelectedId, variant: "inspection" }} listRef={listRef} defaultHeight={320} style={{ height: "100%" }} />
							</div>
						)}
					</div>
					<div className="shrink-0 border-t border-border/80 bg-card/90 p-2">
						<Button type="button" data-tutorial="inspection-download-report" variant="secondary" className="w-full gap-2" onClick={handleDownloadInspectionReport} disabled={!canDownloadInspectionReport}>
							<Download className="size-4 shrink-0" aria-hidden />
							검수 결과 다운로드
						</Button>
					</div>
				</aside>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<header className="shrink-0 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
						<div className="min-w-0">
							<h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">ALT 검수</h1>
							<p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-1.5">HTML의 alt와 엑셀 대체텍스트를 비교한 뒤 Pass 또는 Fail로 표시합니다. 텍스트 영역은 textarea가 아닌 편집 가능한 블록·읽기 전용 블록으로 표시됩니다.</p>
							<Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => setRunTutorialJoyride(true)}>
								튜토리얼
							</Button>
						</div>
					</header>

					<div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border/80 bg-card/30 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)_auto] lg:divide-x lg:divide-y-0">
						<div className="flex w-full min-h-[220px] flex-col lg:row-span-2 lg:min-h-0" data-tutorial="inspection-viewer">
							<div className="shrink-0 border-b border-border/80 bg-muted/30 px-3 py-2">
								<div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">이미지 뷰어</div>
								{selected && selectedDeliverableLabel ? (
									<p className="mt-1.5 break-all text-[11px] font-medium leading-snug text-foreground/90" title={selectedDeliverableLabel !== selected.name ? `${selectedDeliverableLabel} — ${selected.name}` : selected.name}>
										{selectedDeliverableLabel}
									</p>
								) : (
									<p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">목록에서 이미지를 선택하면 파일명이 여기 표시됩니다.</p>
								)}
							</div>
							<div className="flex min-h-0 flex-1 flex-col p-4">{selected ? <ImageViewerZoom key={selected.id} src={selected.url} alt={selected.name} /> : <p className="flex flex-1 items-center justify-center px-2 text-center text-sm text-muted-foreground">ZIP을 추가한 뒤 목록에서 항목을 선택해 주세요.</p>}</div>
						</div>
						<div className="flex w-full min-h-[200px] flex-col lg:min-h-0" data-tutorial="inspection-html-alt">
							<div className="shrink-0 border-b border-border/80 bg-muted/30 px-3 py-2">
								<Label htmlFor="html-alt-edit" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
									HTML에 매칭된 img의 alt
								</Label>
							</div>
							<EditablePlainText key={selectedId ?? "none"} id="html-alt-edit" value={selected?.htmlAlt ?? ""} onChange={updateSelectedHtmlAlt} disabled={!selected || selected.excludedFromTarget} placeholder={!selected ? "이미지를 선택하세요." : selected.excludedFromTarget ? "대상에서 제외된 이미지입니다." : "HTML alt가 없으면 직접 입력할 수 있습니다."} className="min-h-[120px] lg:min-h-0" />
						</div>
						<div className="relative flex h-full w-full min-h-[200px] flex-col lg:min-h-0" data-tutorial="inspection-excel-alt">
							<div className="shrink-0 border-b border-border/80 bg-muted/30 px-3 py-2">
								<div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">엑셀 산출물에서 경로로 매칭된 대체텍스트</div>
							</div>
							<div ref={excelAltRef} onMouseUp={openSelectionTooltip} onKeyUp={openSelectionTooltip} className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap wrap-break-word border-0 bg-background/80 p-4 font-mono text-sm leading-relaxed text-foreground selection:bg-amber-200/70 dark:selection:bg-amber-700/40" aria-live="polite">
								{!selected ? (
									<span className="text-muted-foreground">이미지를 선택하세요.</span>
								) : selected.excludedFromTarget ? (
									<span className="text-muted-foreground">대상에서 제외된 이미지입니다.</span>
								) : excelAltByPath.size === 0 ? (
									<span className="text-muted-foreground">대체텍스트 엑셀(xlsx)을 업로드하면 여기에 표시됩니다.</span>
								) : selectedExcelAlt.trim().length === 0 ? (
									<span className="text-muted-foreground">이 경로에 해당하는 엑셀 행이 없거나 alt가 비어 있습니다.</span>
								) : selectionRange && selectionRange.end <= selectedExcelAlt.length ? (
									<>
										{selectedExcelAlt.slice(0, selectionRange.start)}
										<mark className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-700/40">{selectedExcelAlt.slice(selectionRange.start, selectionRange.end)}</mark>
										{selectedExcelAlt.slice(selectionRange.end)}
									</>
								) : (
									selectedExcelAlt
								)}
							</div>
						</div>
						<div className="border-t border-border/80 bg-card/60 p-3 lg:col-span-2 lg:col-start-2 lg:border-t lg:px-4" data-tutorial="inspection-comment">
							<div className="rounded-lg border border-border/80 bg-background/70 p-3">
								<p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">검수 코멘트</p>
								{!selected ? (
									<p className="text-sm text-muted-foreground">작성하신 코멘트가 표시됩니다.</p>
								) : selectedComments.length === 0 ? (
									<p className="text-sm text-muted-foreground">엑셀 대체텍스트 영역에서 문장을 드래그 선택한 뒤 코멘트를 남겨주세요.</p>
								) : (
									<div className="rounded-md border border-border bg-card p-3 text-sm leading-relaxed">
										<p>- 이미지명: {fileNameOnly(selected.name)}</p>
										<p>- 상태: [{selected.outcome === "pass" ? "PASS" : selected.outcome === "fail" ? "FAIL" : "PENDING"}]</p>
										<p>- 코멘트:</p>
										{selectedComments.map((c) => (
											<div key={c.id} className="mt-1.5 pl-3 text-muted-foreground">
												<p>&gt; 선택 영역: &quot;{c.selectedText}&quot;</p>
												<p>&gt; 수정 사항: {c.note}</p>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
					{selectionTooltip ? (
						<div className="fixed z-30 w-72 rounded-lg border border-border bg-popover p-2 shadow-xl" style={{ left: selectionTooltip.x, top: selectionTooltip.y }}>
							<p className="mb-1 text-[11px] leading-snug text-muted-foreground">선택 영역: &quot;{selectionTooltip.selectedText}&quot;</p>
							<textarea
								ref={commentTextareaRef}
								value={commentDraft}
								onChange={(e) => setCommentDraft(e.target.value)}
								placeholder="수정 사항 코멘트 입력"
								className="h-20 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
							/>
							<div className="mt-1.5 flex justify-end gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-7 px-2 text-xs"
									onClick={() => {
										setSelectionTooltip(null);
										setSelectionRange(null);
									}}
								>
									취소
								</Button>
								<Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={handleConfirmComment} disabled={commentDraft.trim().length === 0}>
									확인
								</Button>
							</div>
						</div>
					) : null}

					<footer className="shrink-0 border-t border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm" aria-label="검수 진행">
						<div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<div className="min-w-0 flex-1 space-y-1.5" data-tutorial="inspection-progress">
								<div className="flex items-center justify-between gap-2 text-sm">
									<span className="font-medium text-foreground">전체 진행</span>
									<span className="tabular-nums text-muted-foreground">
										{decidedCount}/{reviewTargetCount || 0} 판정 완료
										{excludedCount > 0 ? <span className="text-muted-foreground/80"> · 제외 {excludedCount}</span> : null}
									</span>
								</div>
								{total > 0 ? (
									<div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={decidedCount} aria-valuemin={0} aria-valuemax={reviewTargetCount} aria-label={`판정 완료 ${decidedCount}개, 검수 대상 ${reviewTargetCount}개`}>
										<div className="h-full bg-linear-to-r from-[#a855f7] to-[#06b6d4] transition-[width] duration-300 ease-out" style={{ width: `${progressPct}%` }} />
									</div>
								) : (
									<div className="h-2 rounded-full bg-muted" aria-hidden />
								)}
							</div>
							<div className="flex shrink-0 flex-wrap items-center justify-end gap-2" data-tutorial="inspection-actions">
								<Button type="button" variant="outline" onClick={handleDeferReview} disabled={items.length === 0}>
									나중에 검수
								</Button>
								<Button type="button" variant="outline" onClick={handleExcludeFromTarget} disabled={!selected || selected.excludedFromTarget}>
									<Ban className="size-4" aria-hidden />
									대상 제외
								</Button>
								<Button type="button" onClick={handlePass} disabled={!selected || selected.excludedFromTarget}>
									<Check className="size-4" aria-hidden />
									Pass
								</Button>
								<Button type="button" variant="destructive" onClick={handleFail} disabled={!selected || selected.excludedFromTarget}>
									<X className="size-4" aria-hidden />
									Fail
								</Button>
							</div>
						</div>
					</footer>
				</div>
			</div>
			<Joyride
				run={runTutorialJoyride}
				steps={tutorialSteps}
				continuous
				scrollToFirstStep
				onEvent={handleJoyrideEvent}
				options={{
					skipBeacon: true,
					scrollOffset: 120,
					overlayColor: "rgba(0,0,0,0.72)",
					spotlightPadding: 10,
					spotlightRadius: 8,
					zIndex: 10050,
					primaryColor: "oklch(0.627 0.248 304)",
					buttons: ["back", "close", "primary", "skip"],
					backgroundColor: "#ffffff",
					textColor: "#000000",
					arrowColor: "#ffffff",
				}}
				styles={{
					tooltipTitle: { fontSize: 16, fontWeight: 600, lineHeight: 1.35 },
					buttonBack: { fontSize: 12 },
					buttonClose: { fontSize: 12 },
					buttonPrimary: { fontSize: 12 },
					buttonSkip: { fontSize: 12 },
				}}
				locale={{
					back: "이전",
					close: "닫기",
					last: "완료",
					next: "다음",
					skip: "건너뛰기",
				}}
			/>
		</div>
	);
}
