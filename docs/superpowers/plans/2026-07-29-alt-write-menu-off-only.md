# [ALT 작성] 메뉴 OFF 고정 및 튜토리얼 정비 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `[ALT 작성]` 메뉴(`app/page.tsx` → `components/image-review-workspace.tsx`)에서 "이미지 → 텍스트 추출" 기능(엔진 선택 · 추출 텍스트 편집 · ON/OFF 토글)을 완전히 제거하고 항상 현재의 OFF 상태처럼 동작하도록 고정한 뒤, 서브타이틀과 인앱 튜토리얼(Joyride)을 새 화면 구성에 맞게 갱신한다.

**Architecture:** 이 메뉴는 서버를 거치지 않는 순수 클라이언트 컴포넌트(`components/image-review-workspace.tsx`)이며, OCR 추출 기능은 이 컴포넌트 안에서만 쓰이는 로컬 state(`imageReviewEnabled`, `ocrEngine`, `ocrLoading`, `extractedText` 등)로 구현되어 있다. 이 state와 그에 딸린 UI·핸들러·산출물 로직을 제거하고, 이미 존재하던 "OFF일 때" 분기만 남겨 기본 동작으로 승격시킨다. 인앱 튜토리얼은 `lib/tutorial-joyride-steps.tsx`가 스텝 정의를 담당하고 `image-review-workspace.tsx`의 `handleJoyrideEvent`가 스텝 인덱스에 맞춰 더미 데이터를 갈아끼우는 구조라, 스텝 개수가 8→7로 줄어드는 것에 맞춰 두 파일을 함께 손봐야 한다.

**Tech Stack:** Next.js(App Router) 클라이언트 컴포넌트, React state/effect, react-joyride, Tailwind v4. 테스트 러너가 프로젝트에 없으므로(빌드 스크립트에 test 없음) 각 작업의 검증은 `npm run lint` + `npm run dev`로 브라우저에서 직접 확인하는 방식으로 한다 (AGENTS.md 9절 원칙 2 준수).

## Global Constraints

- 요청 범위를 벗어난 리팩터링·스타일 통일은 하지 않는다 (AGENTS.md 9절). 단, "OCR 추출 기능 제거"가 필연적으로 dead code화시키는 코드(예: ON 모드 전용 ZIP 내보내기 분기)는 이번 요청의 직접적인 결과이므로 함께 정리한다.
- `components/image-review-workspace.tsx`는 탭 들여쓰기 파일이다 — 새로 쓰는 코드도 탭을 유지한다.
- `lib/tutorial-joyride-steps.tsx`도 탭 들여쓰기다 — 동일하게 유지한다.
- 이 메뉴가 실제 서비스 흐름(AGENTS.md 1절)이며, `lib/pipeline/*`(고아 코드)와는 무관하다. 절대 고아 코드 쪽을 건드리지 않는다.
- 코드 주석은 한국어로, 다만 이 파일 컨벤션상 주석은 "WHY가 비자명한 경우만" 최소로 추가한다(기존 파일 스타일 참고).
- 변경 후 반드시 `npm run lint`를 돌리고, UI 변경이므로 `npm run dev`로 브라우저에서 실제 동작을 확인한다.

---

## 사전 조사로 확정한 사실 (구현자가 다시 찾지 않아도 되도록 기록)

- `[ALT 작성]` 메뉴는 `app/page.tsx` → `components/image-review-workspace.tsx` 흐름이 맞다 (site-header.tsx의 `{ href: "/", label: "ALT 작성" }`).
- `imageReviewEnabled`(기본값 `true`)가 켜져 있을 때만 보이는 3개 UI 영역:
  1. 헤더 우측의 "텍스트 추출 엔진" 드롭다운 (`components/image-review-workspace.tsx:894-920`)
  2. "추출 텍스트 (편집)" 패널 전체 (`:940-1006`, 다시추출/클립보드복사/최종ALT로 버튼 포함)
  3. 사이드바 하단의 "이미지 → 텍스트 추출" ON/OFF 토글 버튼 (`:869-877`)
- `ImageItem.extractedText` 필드는 **이 컴포넌트 안에서만** 쓰인다. `lib/build-alt-review-deliverable-excel.ts`와 `lib/client/append-alt-review-excel-to-zip.ts`에도 동명의 `extractedText` 필드가 있지만 이는 완전히 별개의 타입(`AltReviewDeliverableExcelRow.extractedText`)이며 실제로는 "최종 alt 텍스트/이미지 태그 소스"를 담는 용도로, `ImageReviewWorkspace`가 넘기는 `DeliverableExcelItemInput` 타입에는애초에 `extractedText`가 없다(`name/url/finalAlt/excludedFromTarget`만 있음). 즉 **OCR 추출 텍스트는 엑셀 산출물과 무관** — 안전하게 완전히 제거 가능.
- `imageReviewEnabled`가 `false`일 때 `handleExportDeliverables`는 이미 "엑셀 파일만 단독 다운로드"(`downloadAltReviewExcelFile`) 하는 분기를 타고 있다. `true`일 때만 타는 "ZIP(이미지+alt주입 HTML+엑셀) 다운로드" 분기는 이번에 OFF 고정되면서 죽는 코드가 된다 — 사용자가 새로 요청한 서브타이틀 문구("ALT 편집하고 엑셀 산출물을 다운로드")와도 정확히 일치하므로, 이 ZIP 분기를 제거하고 엑셀 단독 다운로드만 남긴다.
- `components/image-list-row.tsx`의 `variant="extract"`는 `it.reviewed`/`excludedFromTarget`만 사용하고 `extractedText`는 쓰지 않는다 — 영향 없음.
- `app/(protected)/tutorial/page.tsx` + `lib/tutorial-dummy.ts`는 어디에서도 링크되지 않는 별개의 더미 프리뷰 페이지로, 사용자가 말하는 "TUTORIAL" 버튼(→ `/?tutorial=1`, `lib/tutorial-joyride-steps.tsx`의 Joyride 투어)과 무관하다. 이번 작업 범위에서 제외한다.
- 인앱 튜토리얼은 `lib/tutorial-joyride-steps.tsx`의 `getTutorialJoyrideSteps()` 8단계 + `image-review-workspace.tsx`의 `handleJoyrideEvent`(스텝 진입 시 더미 데이터 주입)로 구성. 8단계 중 "Step 7. 검수 모드 설정"(`data-tutorial="image-review-toggle"` 타겟)이 이번에 삭제되는 토글 버튼을 가리키므로 반드시 함께 제거해야 투어가 깨지지 않는다.

## File Structure

- Modify: `components/image-review-workspace.tsx` — OCR 추출 기능(state/effect/handler/JSX) 제거, 헤더 문구 교체, 레이아웃 2단 고정, 산출물 내보내기 로직 단순화, Joyride 핸들러 인덱스 조정.
- Modify: `lib/tutorial-joyride-steps.tsx` — 스텝 목록을 7단계로 재구성하고 문구를 새 화면에 맞게 갱신.

---

### Task 1: `image-review-workspace.tsx` — 이미지→텍스트 추출 기능 완전 제거 및 OFF 고정

**Files:**
- Modify: `components/image-review-workspace.tsx`
- Modify: `lib/tutorial-joyride-steps.tsx` (Joyride가 깨지지 않도록 `reviewModeToggle` 스텝만 최소 제거 — 문구 정비는 Task 2)

**Interfaces:**
- Consumes: 기존 `ImageItem`, `HtmlAsset`, `DeliverableExportSortKind`, `getTutorialJoyrideSteps()`, `TUTORIAL_EXAMPLE_EXTRACTED_TEXT`(이 태스크에서는 이름 그대로 유지, Task 2에서 개명)
- Produces: `ImageItem`에서 `extractedText` 필드가 사라진 형태. `handleExportDeliverables(exportSortKind: DeliverableExportSortKind): Promise<void>`는 시그니처 동일, 내부 구현만 단순화. Task 2가 참조할 `TUTORIAL_JOYRIDE_STEP_IDS`(더 이상 `reviewModeToggle` 키 없음)와 스텝 배열(7개, 마지막 인덱스는 6).

- [ ] **Step 1: import 정리**

`components/image-review-workspace.tsx` 상단 import에서 더 이상 쓰지 않을 것들을 제거한다.

```tsx
// 제거
import { requestOcrForImageItem, type OcrEngineId } from "@/lib/client/ocr-image-fetch";
```

```tsx
// 기존
import {
	DELIVERABLE_EXPORT_SORT_OPTIONS,
	shouldUseHtmlAssetForDeliverableExport,
	sortItemsForDeliverableExport,
} from "@/lib/client/deliverable-export-sort";
```
→
```tsx
// 변경 후 (ZIP 빌드용 사전 정렬 로직을 통째로 제거하므로 나머지 두 named import는 더 이상 쓰이지 않음)
import { DELIVERABLE_EXPORT_SORT_OPTIONS } from "@/lib/client/deliverable-export-sort";
```

`JSZip`, `appendAltReviewExcelToJsZip`도 ZIP 빌드 분기 제거 후 쓰이지 않으므로 제거한다.

```tsx
// 제거
import JSZip from "jszip";
```
```tsx
// 기존
import { appendAltReviewExcelToJsZip, downloadAltReviewExcelFile, type DeliverableExportSortKind } from "@/lib/client/append-alt-review-excel-to-zip";
```
→
```tsx
// 변경 후
import { downloadAltReviewExcelFile, type DeliverableExportSortKind } from "@/lib/client/append-alt-review-excel-to-zip";
```

`injectReviewedAltsIntoHtmlMarkup`은 `handleApprove`/`handleExcludeFromTarget`/`handleApproveAll`/`handleUndoJudgment`/`handleSpellApply`에서 계속 쓰이므로 **그대로 둔다** (지우지 말 것 — 엑셀 산출물은 HTML의 실제 `alt` 속성에서 행을 만들기 때문에 승인/제외 시 HTML 갱신이 여전히 필요함).

- [ ] **Step 2: OCR 엔진 관련 상수/함수 제거**

파일 상단의 아래 블록을 통째로 삭제한다.

```tsx
const OCR_ENGINE_OPTIONS: { value: OcrEngineId; label: string }[] = [
	{ value: "google-vision", label: "구글 비전" },
	{ value: "ocr-space", label: "OCR.space" },
	{ value: "tesseract", label: "Tesseract(로컬전용)" },
];

function ocrEngineLabel(id: OcrEngineId): string {
	return OCR_ENGINE_OPTIONS.find((o) => o.value === id)?.label ?? id;
}
```

- [ ] **Step 3: `ImageItem` 타입에서 `extractedText` 제거**

```tsx
// 기존
type ImageItem = {
	id: string;
	name: string;
	url: string;
	extractedText: string;
	finalAlt: string;
	reviewed: boolean;
	excludedFromTarget: boolean;
};
```
→
```tsx
// 변경 후
type ImageItem = {
	id: string;
	name: string;
	url: string;
	finalAlt: string;
	reviewed: boolean;
	excludedFromTarget: boolean;
};
```

`tutorialDummyToImageItems()`에서도 `extractedText: ""` 줄을 삭제한다.

```tsx
// 기존
function tutorialDummyToImageItems(): ImageItem[] {
	return TUTORIAL_DUMMY_IMAGE_ITEMS.map((d) => ({
		id: d.id,
		name: d.fileName,
		url: d.publicPath,
		extractedText: "",
		finalAlt: "",
		reviewed: false,
		excludedFromTarget: false,
	}));
}
```
→
```tsx
// 변경 후
function tutorialDummyToImageItems(): ImageItem[] {
	return TUTORIAL_DUMMY_IMAGE_ITEMS.map((d) => ({
		id: d.id,
		name: d.fileName,
		url: d.publicPath,
		finalAlt: "",
		reviewed: false,
		excludedFromTarget: false,
	}));
}
```

- [ ] **Step 4: state 선언 정리**

```tsx
// 기존
const [ocrLoading, setOcrLoading] = useState(false);
const [spellLoading, setSpellLoading] = useState(false);
const [spellHits, setSpellHits] = useState<SpellHit[]>([]);
const [spellBaseline, setSpellBaseline] = useState<string | null>(null);
const [exportLoading, setExportLoading] = useState(false);
const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);
const [deliverableSortKind, setDeliverableSortKind] = useState<DeliverableExportSortKind>("filename");
const [imageReviewEnabled, setImageReviewEnabled] = useState(true);
const [ocrEngine, setOcrEngine] = useState<OcrEngineId>("google-vision");
const [spellPreviewHeightPx, setSpellPreviewHeightPx] = useState(SPELL_PREVIEW_DEFAULT_H);
```
→
```tsx
// 변경 후
const [spellLoading, setSpellLoading] = useState(false);
const [spellHits, setSpellHits] = useState<SpellHit[]>([]);
const [spellBaseline, setSpellBaseline] = useState<string | null>(null);
const [exportLoading, setExportLoading] = useState(false);
const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);
const [deliverableSortKind, setDeliverableSortKind] = useState<DeliverableExportSortKind>("filename");
const [spellPreviewHeightPx, setSpellPreviewHeightPx] = useState(SPELL_PREVIEW_DEFAULT_H);
```

`copyFlash`(복사됨 표시용)도 "클립보드 복사" 버튼과 함께 제거된다.

```tsx
// 제거
const [copyFlash, setCopyFlash] = useState(false);
```

- [ ] **Step 5: 파생값(`canExportDeliverables` 등) 단순화**

```tsx
// 기존
const allReviewComplete = reviewTargetCount > 0 && reviewedCount === reviewTargetCount;
const hasOnlyHtml = items.length === 0 && htmlAssets.length > 0;
const canExportDeliverables = htmlAssets.length > 0 && (!imageReviewEnabled || allReviewComplete || hasOnlyHtml);
const canClickExportDeliverables = !exportLoading && !isParsingZip && canExportDeliverables;
```
→
```tsx
// 변경 후 (OFF 고정이므로 승인 완료 여부와 무관하게 HTML만 있으면 내보내기 가능 — 기존 OFF 분기 동작 그대로 승격)
const canExportDeliverables = htmlAssets.length > 0;
const canClickExportDeliverables = !exportLoading && !isParsingZip && canExportDeliverables;
```

(`allReviewComplete`/`hasOnlyHtml`는 다른 곳에서 쓰이지 않으므로 완전히 삭제한다. `reviewTargetCount`/`reviewedCount`/`excludedCount`/`progressPct`는 하단 진행률 바에서 계속 쓰이므로 그대로 둔다.)

- [ ] **Step 6: 자동 OCR 추출 `useEffect` 삭제**

`selectedId`가 바뀔 때 자동으로 OCR을 호출하던 이펙트를 통째로 삭제한다.

```tsx
// 삭제 대상 전체
useEffect(() => {
	if (!selectedId) {
		setOcrLoading(false);
		return;
	}

	if (!imageReviewEnabled) {
		setOcrLoading(false);
		return;
	}

	let cancelled = false;

	const run = async () => {
		if (joyrideTutorialActiveRef.current) {
			setOcrLoading(false);
			return;
		}

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
}, [selectedId, ocrEngine, imageReviewEnabled]);
```

이 이펙트 바로 아래에 있는, 선택 변경 시 맞춤법 검사 상태를 초기화하는 이펙트는 OCR과 무관하므로 그대로 둔다:

```tsx
useEffect(() => {
	setSpellHits([]);
	setSpellBaseline(null);
	setSpellLoading(false);
}, [selectedId]);
```

- [ ] **Step 7: `handleAddFiles`에서 `extractedText: ""` 초기화 3곳 제거**

ZIP 내 이미지, 단독 HTML 업로드, 단독 이미지 업로드 각 분기에서 아이템을 생성하는 아래 3개 리터럴에서 `extractedText: ""` 줄만 지운다 (다른 필드는 그대로).

```tsx
newImages.push({
	id: crypto.randomUUID(),
	name: `${base}/${img.relativePath}`,
	url: URL.createObjectURL(img.blob),
	finalAlt: "",
	reviewed: false,
	excludedFromTarget: false,
});
```

```tsx
newImages.push({
	id: crypto.randomUUID(),
	name: file.name,
	url: URL.createObjectURL(file),
	finalAlt: "",
	reviewed: false,
	excludedFromTarget: false,
});
```

(HTML 단독 업로드 분기는 이미지 아이템을 만들지 않으므로 해당 없음 — 실제로 `extractedText: ""`가 있는 곳은 이 두 곳과 `tutorialDummyToImageItems`뿐이다.)

- [ ] **Step 8: `handleReExtract`, `copyExtractedText`, `applyExtractedToFinalAlt` 삭제**

세 콜백을 통째로 삭제한다.

```tsx
// 삭제
const handleReExtract = useCallback(async () => {
	if (!imageReviewEnabled) return;
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
}, [selectedId, ocrEngine, imageReviewEnabled]);

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
```

`updateSelectedText`(추출 텍스트 textarea의 onChange 핸들러)도 패널 삭제와 함께 쓸모가 없으므로 삭제한다.

```tsx
// 삭제
const updateSelectedText = useCallback(
	(text: string) => {
		setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, extractedText: text } : it)));
	},
	[selectedId],
);
```

`applyExtractedToFinalAlt`도 삭제한다 (이 텍스트를 "최종 ALT로" 복사하는 버튼용이었음).

```tsx
// 삭제
const applyExtractedToFinalAlt = useCallback(() => {
	if (!selectedId || !selected) return;
	setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, finalAlt: selected.extractedText } : it)));
	setSpellHits([]);
	setSpellBaseline(null);
}, [selectedId, selected]);
```

`updateSelectedFinalAlt`, `refreshFinalAltFromHtmlSource`, `handleSpellCheck`, `handleSpellApply`, spell-preview 리사이즈 관련 콜백들은 최종 ALT 편집·맞춤법 검사 기능이라 **그대로 둔다**.

- [ ] **Step 9: `handleExportDeliverables` — ZIP 분기 제거, 엑셀 단독 다운로드만 남김**

```tsx
// 기존 전체
const handleExportDeliverables = useCallback(
	async (exportSortKind: DeliverableExportSortKind) => {
		const snapshotItems = itemsRef.current;
		const snapshotHtml = htmlAssetsRef.current;
		const targets = snapshotItems.filter((i) => !i.excludedFromTarget);
		if (snapshotHtml.length === 0) {
			const reviewReady = !imageReviewEnabled || (targets.length > 0 && targets.every((i) => i.reviewed));
			if (snapshotItems.length > 0 && reviewReady) {
				setSideNotice("산출물을 만들려면 HTML이 필요합니다. HTML 파일을 추가하거나 ZIP으로 업로드해 주세요.");
			}
			return;
		}
		const sortedHtml = sortItemsForDeliverableExport(
			snapshotHtml
				.filter((h) => shouldUseHtmlAssetForDeliverableExport(h.relativePath, exportSortKind))
				.map((x) => ({ name: h.relativePath, asset: h })),
			exportSortKind,
		).map((x) => x.asset);
		const sortedImages = sortItemsForDeliverableExport(snapshotItems, exportSortKind);
		const excelOptions = { exportSortKind };

		if (!imageReviewEnabled) {
			setExportLoading(true);
			setSideNotice(null);
			try {
				await downloadAltReviewExcelFile(snapshotItems, snapshotHtml, {
					preferHtmlTagRows: true,
					...excelOptions,
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

			for (const h of sortedHtml) {
				const markup = injectReviewedAltsIntoHtmlMarkup(h.originalContent ?? h.content, snapshotItems, h.relativePath);
				zip.file(h.relativePath.replace(/\\/g, "/"), markup);
			}

			for (const it of sortedImages) {
				const path = it.name.replace(/\\/g, "/");
				const res = await fetch(it.url);
				if (!res.ok) throw new Error(`이미지를 읽지 못했습니다: ${path}`);
				const buf = await res.arrayBuffer();
				zip.file(path, buf);
			}

			await appendAltReviewExcelToJsZip(zip, snapshotItems, snapshotHtml, excelOptions);

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
	},
	[imageReviewEnabled],
);
```
→
```tsx
// 변경 후
const handleExportDeliverables = useCallback(async (exportSortKind: DeliverableExportSortKind) => {
	const snapshotItems = itemsRef.current;
	const snapshotHtml = htmlAssetsRef.current;
	if (snapshotHtml.length === 0) {
		if (snapshotItems.length > 0) {
			setSideNotice("산출물을 만들려면 HTML이 필요합니다. HTML 파일을 추가하거나 ZIP으로 업로드해 주세요.");
		}
		return;
	}

	setExportLoading(true);
	setSideNotice(null);
	try {
		await downloadAltReviewExcelFile(snapshotItems, snapshotHtml, {
			preferHtmlTagRows: true,
			exportSortKind,
		});
	} catch (e) {
		setSideNotice(e instanceof Error ? e.message : "엑셀 추출에 실패했습니다.");
	} finally {
		setExportLoading(false);
	}
}, []);
```

- [ ] **Step 10: Joyride 이벤트 핸들러 — extractedText 데모 브랜치를 finalAlt로 교체, 인덱스 조정**

```tsx
// 기존
if (data.index === 3) {
	const firstId = TUTORIAL_DUMMY_IMAGE_ITEMS[0].id;
	afterCommit(() => {
		setSpellHits([]);
		setSpellBaseline(null);
		setItems((prev) => prev.map((it) => (it.id === firstId ? { ...it, extractedText: TUTORIAL_EXAMPLE_EXTRACTED_TEXT } : it)));
	});
}
```
→
```tsx
// 변경 후 — 추출 텍스트 패널이 사라졌으므로, "최종 ALT" 칸에 바로 예시 문구를 채워 보여준다
if (data.index === 3) {
	const firstId = TUTORIAL_DUMMY_IMAGE_ITEMS[0].id;
	afterCommit(() => {
		setSpellHits([]);
		setSpellBaseline(null);
		setItems((prev) => prev.map((it) => (it.id === firstId ? { ...it, finalAlt: TUTORIAL_EXAMPLE_EXTRACTED_TEXT } : it)));
	});
}
```

("Step 6 진행률" 브랜치인 `data.index === 5`는 그대로 둔다.)

```tsx
// 기존 — "Step 8 산출물" 브랜치, reviewModeToggle 스텝이 있던 8단계 기준 인덱스 7
if (data.index === 7) {
	const demoHtml = '<!DOCTYPE html><html><body><img src="tutorial_1.png" alt="" /></body></html>';
	afterCommit(() => {
		setItems((prev) => prev.map((it) => (!it.excludedFromTarget ? { ...it, reviewed: true } : it)));
		setHtmlAssets([
			{
				id: crypto.randomUUID(),
				relativePath: "tutorial-demo.html",
				content: demoHtml,
				originalContent: demoHtml,
			},
		]);
	});
}
```
→
```tsx
// 변경 후 — reviewModeToggle 스텝 제거로 7단계가 되면서 마지막 스텝 인덱스가 6으로 당겨짐
if (data.index === 6) {
	const demoHtml = '<!DOCTYPE html><html><body><img src="tutorial_1.png" alt="" /></body></html>';
	afterCommit(() => {
		setItems((prev) => prev.map((it) => (!it.excludedFromTarget ? { ...it, reviewed: true } : it)));
		setHtmlAssets([
			{
				id: crypto.randomUUID(),
				relativePath: "tutorial-demo.html",
				content: demoHtml,
				originalContent: demoHtml,
			},
		]);
	});
}
```

- [ ] **Step 11: `lib/tutorial-joyride-steps.tsx`에서 `reviewModeToggle` 스텝 제거 (Joyride가 존재하지 않는 타겟을 찾다 깨지는 것 방지)**

`TUTORIAL_JOYRIDE_STEP_IDS`에서 키 삭제:

```tsx
// 기존
export const TUTORIAL_JOYRIDE_STEP_IDS = {
	upload: "tutorial-upload",
	imageList: "tutorial-image-list",
	viewerExtract: "tutorial-viewer-extract",
	finalAlt: "tutorial-final-alt",
	reviewActions: "tutorial-review-actions",
	progress: "tutorial-progress",
	reviewModeToggle: "tutorial-review-toggle",
	exportDeliverables: "tutorial-export",
} as const;
```
→
```tsx
// 변경 후
export const TUTORIAL_JOYRIDE_STEP_IDS = {
	upload: "tutorial-upload",
	imageList: "tutorial-image-list",
	viewerExtract: "tutorial-viewer-extract",
	finalAlt: "tutorial-final-alt",
	reviewActions: "tutorial-review-actions",
	progress: "tutorial-progress",
	exportDeliverables: "tutorial-export",
} as const;
```

`getTutorialJoyrideSteps()` 배열에서 "Step 7. 검수 모드 설정" 스텝 객체를 통째로 삭제한다:

```tsx
// 삭제
{
	id: TUTORIAL_JOYRIDE_STEP_IDS.reviewModeToggle,
	target: '[data-tutorial="image-review-toggle"]',
	title: "Step 7. 검수 모드 설정",
	content: demo("이미지 검수 없이 엑셀 산출물만 필요하다면 ON/OFF 스위치를 활용하세요."),
	placement: "right",
	skipBeacon: true,
	scrollOffset: 120,
},
```

(문구·번호 정비는 Task 2에서 한다. 이 스텝의 삭제만으로 배열이 8→7개가 된다.)

- [ ] **Step 12: 헤더 JSX — 타이틀/서브타이틀 고정 문구, 엔진 드롭다운 삭제**

```tsx
// 기존
<header className="shrink-0 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
	<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
		<div className="min-w-0">
			<h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">대체텍스트 추출 및 편집</h1>
			<p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-1.5">{imageReviewEnabled ? "왼쪽 목록에서 파일을 추가한 뒤, 추출 텍스트와 최종 ALT를 편집·승인합니다." : "이미지 검수 OFF: 텍스트 추출 없이 최종 ALT만 편집합니다. (ZIP·HTML이 있으면 alt는 자동 반영됩니다.)"}</p>
		</div>
		{imageReviewEnabled ? (
			<div className="flex shrink-0 flex-col gap-1 sm:items-end">
				<Label id="ocr-engine-label" className="text-[10px] font-medium text-muted-foreground">
					텍스트 추출 엔진
				</Label>
				<DropdownMenu>
					<DropdownMenuTrigger type="button" disabled={ocrLoading || isParsingZip} aria-labelledby="ocr-engine-label" title={"구글 비전 : 무료 1,000장/월\nOCR.space : 무료 25,000장/월\nTesseract : 로컬 전용"} className={cn(buttonVariants({ variant: "outline", size: "default" }), "h-8 min-w-42 justify-between gap-1.5 px-2.5 text-xs font-normal shadow-sm", "data-disabled:pointer-events-none data-disabled:opacity-50")}>
							<span className="min-w-0 truncate">{ocrEngineLabel(ocrEngine)}</span>
							<ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-42">
							<DropdownMenuRadioGroup
								value={ocrEngine}
								onValueChange={(v) => {
									if (v === "tesseract" || v === "google-vision" || v === "ocr-space") setOcrEngine(v);
								}}
							>
								{OCR_ENGINE_OPTIONS.map((opt) => (
									<DropdownMenuRadioItem key={opt.value} value={opt.value} closeOnClick className="text-xs">
										{opt.label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			) : null}
		</div>
	</header>
```
→
```tsx
// 변경 후 — Task 2에서 문구를 다시 다듬지만, 여기서는 임시로 사용자 요청 문구를 바로 반영한다
<header className="shrink-0 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
	<div className="min-w-0">
		<h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">대체텍스트(ALT) 편집</h1>
		<p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-1.5">왼쪽 목록에서 이미지·HTML·ZIP을 추가한 뒤 최종 ALT를 편집하고, 완료되면 엑셀 산출물을 다운로드하세요.</p>
	</div>
</header>
```

이제 `Label`, `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuTrigger`, `ChevronDown`, `buttonVariants` import 중 다른 곳에서 안 쓰는 것이 있는지 확인한다 — `Label`은 "최종 ALT" 패널(`<Label htmlFor="final-alt-text">`)에서 계속 쓰이므로 유지, `buttonVariants`도 Dialog 버튼 등에서 쓰이는지 확인 후 안 쓰이면 제거. `DropdownMenu*`, `ChevronDown`은 이 드롭다운이 유일한 사용처이므로 제거한다.

- [ ] **Step 13: 뷰어/추출 패널 JSX 재구성 — 2단 레이아웃으로 단순화**

```tsx
// 기존
<div className="min-h-0 flex-1">
	<div className={cn("grid h-full min-h-[min(45vh,380px)] grid-cols-1 divide-y divide-border/80 bg-card/30 lg:min-h-0 lg:grid-rows-1 lg:divide-x lg:divide-y-0 lg:items-stretch", imageReviewEnabled ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
		<div data-tutorial="viewer-extract" className={cn("col-span-1 flex w-full min-h-[200px] flex-col divide-y divide-border/80 lg:h-full lg:min-h-0", imageReviewEnabled ? "lg:col-span-2 lg:flex-row lg:divide-x lg:divide-y-0" : "lg:col-span-1")}>
			<div className="flex w-full min-h-[200px] flex-1 flex-col lg:min-h-0">
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
				<div className="flex min-h-0 flex-1 flex-col p-4">{selected ? <ImageViewerZoom key={selected.id} src={selected.url} alt={selected.name} /> : <p className="flex flex-1 items-center justify-center px-2 text-center text-sm text-muted-foreground">왼쪽에서 이미지·ZIP을 추가한 뒤, 목록에서 항목을 선택해 주세요.</p>}</div>
			</div>
			{imageReviewEnabled ? (
				<div className="flex w-full min-h-[200px] flex-1 flex-col lg:min-h-0">
					{/* ... 추출 텍스트 패널 헤더/버튼/textarea 전체 ... */}
				</div>
			) : null}
		</div>
		<div data-tutorial="final-alt" className="flex h-full w-full min-h-[200px] flex-col lg:min-h-0">
			{/* ... 최종 ALT 패널 (Step 14에서 별도 정리) ... */}
		</div>
	</div>
</div>
```
→
```tsx
// 변경 후 — 항상 2단, 추출 텍스트 패널·바깥 wrapper div 제거
// data-tutorial="viewer-extract"는 이름은 그대로 두되(더 이상 "추출"은 없지만, 이 attribute는
// Joyride 타겟 셀렉터일 뿐 사용자에게 보이지 않으므로 Task 1에서는 굳이 개명하지 않는다 —
// 개명하면 lib/tutorial-joyride-steps.tsx의 셀렉터도 같은 커밋에서 함께 바꿔야 하는데,
// 그 파일의 문구 정비는 Task 2 몫이라 두 작업 사이에 셀렉터 불일치가 생기는 걸 피하기 위함)
<div className="min-h-0 flex-1">
	<div className="grid h-full min-h-[min(45vh,380px)] grid-cols-1 divide-y divide-border/80 bg-card/30 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-1 lg:divide-x lg:divide-y-0 lg:items-stretch">
		<div data-tutorial="viewer-extract" className="flex w-full min-h-[200px] flex-col lg:h-full lg:min-h-0">
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
			<div className="flex min-h-0 flex-1 flex-col p-4">{selected ? <ImageViewerZoom key={selected.id} src={selected.url} alt={selected.name} /> : <p className="flex flex-1 items-center justify-center px-2 text-center text-sm text-muted-foreground">왼쪽에서 이미지·ZIP을 추가한 뒤, 목록에서 항목을 선택해 주세요.</p>}</div>
		</div>
		<div data-tutorial="final-alt" className="flex h-full w-full min-h-[200px] flex-col lg:min-h-0">
			{/* 최종 ALT 패널 — Step 14에서 내부만 수정, 구조는 그대로 */}
		</div>
	</div>
</div>
```

`data-tutorial="viewer-extract"` attribute 이름 자체는 이번 Task에서 바꾸지 않는다 (위 주석 참고 — Task 2에서 문구와 함께 한 번에 정리).

`ArrowRight`, `Copy`, `FileCode2`... 중 `FileCode2`는 "최종 ALT" 패널의 "원본 alt" 버튼에서 계속 쓰이므로 유지. `ArrowRight`, `Copy`, `RefreshCw`는 삭제되는 추출 텍스트 패널에서만 쓰였으므로, 다른 곳에서 쓰이지 않는다면 import에서 제거한다.

- [ ] **Step 14: "최종 ALT" 패널 — `ocrLoading` 잔재 제거**

버튼 3개와 textarea의 `disabled`에서 `ocrLoading ||`를 제거하고, textarea의 `aria-busy`와 `placeholder` 삼항연산을 단순화한다.

```tsx
// 기존 (원본 alt 버튼)
disabled={!selected || ocrLoading || selected?.excludedFromTarget || htmlAssets.length === 0}
```
→
```tsx
// 변경 후
disabled={!selected || selected?.excludedFromTarget || htmlAssets.length === 0}
```

```tsx
// 기존 (맞춤법 검사 버튼)
disabled={!selected || ocrLoading || spellLoading || selected?.excludedFromTarget}
```
→
```tsx
// 변경 후
disabled={!selected || spellLoading || selected?.excludedFromTarget}
```

```tsx
// 기존 (맞춤법 적용 버튼)
disabled={!selected || ocrLoading || spellLoading || selected?.excludedFromTarget || !spellPreviewActive || spellHits.length === 0}
```
→
```tsx
// 변경 후
disabled={!selected || spellLoading || selected?.excludedFromTarget || !spellPreviewActive || spellHits.length === 0}
```

```tsx
// 기존 (textarea)
disabled={!selected || ocrLoading || selected?.excludedFromTarget}
placeholder={
	!selected
		? "이미지를 선택하세요."
		: selected?.excludedFromTarget
			? "대상에서 제외된 이미지입니다."
			: !imageReviewEnabled
				? htmlAssets.length === 0
					? "검수 OFF: 최종 ALT를 직접 입력하세요. HTML·이미지 ZIP을 넣으면 매칭 alt가 여기 채워집니다."
					: "HTML에 매칭된 img의 alt가 있으면 표시됩니다. 없으면 직접 입력하세요."
				: htmlAssets.length === 0
					? "HTML과 함께 ZIP을 넣으면 img alt가 있을 때 여기에 먼저 채워집니다. 승인 시 빈 alt에 주입됩니다."
					: "HTML에 매칭된 img의 alt가 있으면 표시됩니다. 없으면 직접 입력하세요."
}
aria-busy={imageReviewEnabled && ocrLoading}
```
→
```tsx
// 변경 후
disabled={!selected || selected?.excludedFromTarget}
placeholder={
	!selected
		? "이미지를 선택하세요."
		: selected?.excludedFromTarget
			? "대상에서 제외된 이미지입니다."
			: htmlAssets.length === 0
				? "최종 ALT를 직접 입력하세요. HTML·이미지 ZIP을 넣으면 매칭 alt가 여기 채워집니다."
				: "HTML에 매칭된 img의 alt가 있으면 표시됩니다. 없으면 직접 입력하세요."
}
```

(`aria-busy`는 더 이상 로딩 상태가 없으므로 속성 자체를 삭제한다.)

- [ ] **Step 15: 사이드바 하단 — 토글 버튼 삭제, 안내 문구 단순화**

```tsx
// 기존
<div className="shrink-0 border-t border-border/80 bg-card/90 p-2">
	<button type="button" data-tutorial="image-review-toggle" role="switch" aria-checked={imageReviewEnabled} aria-label="이미지 검수 사용 여부" className="mb-2 flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors" disabled={exportLoading || isParsingZip} onClick={() => setImageReviewEnabled((prev) => !prev)}>
		<span className="font-medium text-foreground">이미지 → 텍스트 추출</span>
		<span className="flex items-center gap-2">
			<span className="text-xs text-muted-foreground">{imageReviewEnabled ? "ON" : "OFF"}</span>
			<span className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", imageReviewEnabled ? "bg-primary" : "bg-muted")}>
				<span className={cn("inline-block size-4 transform rounded-full bg-white transition-transform", imageReviewEnabled ? "translate-x-4" : "translate-x-0.5")} />
			</span>
		</span>
	</button>
	<Button type="button" data-tutorial="export-deliverables" variant="secondary" className="w-full gap-2 disabled:opacity-40" disabled={!canClickExportDeliverables} onClick={onClickExportDeliverables}>
		{exportLoading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <FolderOutput className="size-4 shrink-0" aria-hidden />}
		산출물보내기
	</Button>
	{items.length > 0 && imageReviewEnabled && !canExportDeliverables ? <p className="mt-1.5 px-0.5 text-center text-[10px] leading-snug text-muted-foreground">{!allReviewComplete ? "검수 대상을 모두 승인해야 합니다." : "HTML 파일을 추가하거나 ZIP으로 업로드해 주세요."}</p> : null}
	{items.length > 0 && !imageReviewEnabled && htmlAssets.length === 0 ? <p className="mt-1.5 px-0.5 text-center text-[10px] leading-snug text-muted-foreground">산출물 반영을 위해 HTML을 추가해 주세요.</p> : null}
</div>
```
→
```tsx
// 변경 후
<div className="shrink-0 border-t border-border/80 bg-card/90 p-2">
	<Button type="button" data-tutorial="export-deliverables" variant="secondary" className="w-full gap-2 disabled:opacity-40" disabled={!canClickExportDeliverables} onClick={onClickExportDeliverables}>
		{exportLoading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <FolderOutput className="size-4 shrink-0" aria-hidden />}
		산출물보내기
	</Button>
	{items.length > 0 && htmlAssets.length === 0 ? <p className="mt-1.5 px-0.5 text-center text-[10px] leading-snug text-muted-foreground">산출물 반영을 위해 HTML을 추가해 주세요.</p> : null}
</div>
```

- [ ] **Step 16: `npm run lint` 실행, 에러 0건 확인**

```bash
npm run lint
```

미사용 import(`Label`이 실제로 다른 곳에서 쓰이는지, `buttonVariants`/`ChevronDown`/`DropdownMenu*`/`ArrowRight`/`Copy`/`RefreshCw` 등)가 남아 있으면 ESLint의 `no-unused-vars`가 잡아준다 — 이 시점에 지워야 할 import를 한 번 더 확인한다.

- [ ] **Step 17: `npm run dev`로 브라우저 수동 확인**

```bash
npm run dev
```

`http://localhost:3000` 접속 후:
- 헤더에 "대체텍스트(ALT) 편집" 타이틀과 새 서브타이틀만 보이고, 텍스트 추출 엔진 드롭다운이 없는지 확인.
- 이미지 1장 업로드 → 화면이 "이미지 뷰어 | 최종 ALT" 2단으로만 보이고, 추출 텍스트 패널·ON/OFF 토글이 전혀 없는지 확인.
- 최종 ALT를 직접 입력 → 승인 → HTML 포함 ZIP 업로드 후 "산출물보내기" 클릭 → 엑셀 파일이 다운로드되는지 확인 (더 이상 ZIP이 아니라 `.xlsx` 단일 파일이어야 함).
- "TUTORIAL" 버튼을 눌러 7단계까지 오류 없이 진행되는지 확인 (문구는 아직 정비 전이라 다소 안 맞을 수 있음 — Task 2에서 고침. 여기서는 **크래시 없이 끝까지 진행되는지**만 확인).

- [ ] **Step 18: 커밋**

```bash
git add components/image-review-workspace.tsx lib/tutorial-joyride-steps.tsx
git commit -m "ALT 작성 메뉴에서 이미지→텍스트 추출 기능(엔진 선택/추출 텍스트 편집/ON-OFF 토글) 제거, OFF 고정 동작으로 정리"
```

---

### Task 2: 인앱 튜토리얼(`lib/tutorial-joyride-steps.tsx`) 문구 정비

**Files:**
- Modify: `lib/tutorial-joyride-steps.tsx`
- Modify: `components/image-review-workspace.tsx` (`data-tutorial` attribute 개명 + 상수 import 이름 동기화)

**Interfaces:**
- Consumes: Task 1이 남긴 7단계 스텝 배열(`reviewModeToggle` 삭제됨), `data-tutorial="viewer-extract"`(Task 1에서 이름을 그대로 유지해 둔 타겟)
- Produces: `TUTORIAL_EXAMPLE_ALT_TEXT`(개명된 export, 기존 `TUTORIAL_EXAMPLE_EXTRACTED_TEXT`를 대체), `data-tutorial="image-viewer"`(이 Task에서 최종 개명)

- [ ] **Step 1: Step 3(이미지 뷰어) — 타겟/문구 갱신 (DOM attribute 개명도 이 Step에서 함께 처리)**

먼저 `components/image-review-workspace.tsx`에서 Task 1이 그대로 남겨둔 attribute 이름을 이제 개명한다 (더 이상 추출 패널이 없으므로 실체에 맞는 이름으로):

```tsx
// 기존
<div data-tutorial="viewer-extract" className="flex w-full min-h-[200px] flex-col lg:h-full lg:min-h-0">
```
→
```tsx
// 변경 후
<div data-tutorial="image-viewer" className="flex w-full min-h-[200px] flex-col lg:h-full lg:min-h-0">
```

그다음 `lib/tutorial-joyride-steps.tsx`의 해당 스텝을 같은 커밋에서 맞춰 갱신한다:

```tsx
// 기존
{
	id: TUTORIAL_JOYRIDE_STEP_IDS.viewerExtract,
	target: '[data-tutorial="viewer-extract"]',
	title: "Step 3. 워크스페이스 (뷰어 & 추출)",
	content: demo("이미지를 확대/축소하며 상세히 확인하고, AI가 추출한 텍스트를 바로 편집해 보세요."),
	placement: "right",
	skipBeacon: true,
	scrollOffset: 120,
	offset: 12,
	floatingOptions: {
		shiftOptions: { padding: 16 },
		flipOptions: { padding: 16, fallbackPlacements: ["left", "top", "bottom"] },
	},
},
```
→
```tsx
// 변경 후
{
	id: TUTORIAL_JOYRIDE_STEP_IDS.imageViewer,
	target: '[data-tutorial="image-viewer"]',
	title: "Step 3. 이미지 뷰어",
	content: demo("이미지를 확대/축소하며 자세히 확인하세요."),
	placement: "right",
	skipBeacon: true,
	scrollOffset: 120,
	offset: 12,
	floatingOptions: {
		shiftOptions: { padding: 16 },
		flipOptions: { padding: 16, fallbackPlacements: ["left", "top", "bottom"] },
	},
},
```

`TUTORIAL_JOYRIDE_STEP_IDS`의 키도 함께 개명한다.

```tsx
// 기존
viewerExtract: "tutorial-viewer-extract",
```
→
```tsx
// 변경 후
imageViewer: "tutorial-image-viewer",
```

- [ ] **Step 2: Step 4(최종 ALT 확정) — "추출 텍스트를 보낸다"는 흐름을 "직접 입력"으로 수정**

```tsx
// 기존
{
	id: TUTORIAL_JOYRIDE_STEP_IDS.finalAlt,
	target: '[data-tutorial="final-alt"]',
	title: "Step 4. 최종 ALT 확정",
	content: demo("편집된 텍스트를 '최종 ALT'로 보내세요. 맞춤법 검사기로 완벽한 문장을 만들 수 있습니다."),
	placement: "auto",
	skipBeacon: true,
	scrollOffset: 100,
	offset: 14,
	floatingOptions: {
		shiftOptions: { padding: 16 },
		flipOptions: { padding: 20, fallbackPlacements: ["left", "top", "bottom", "right"] },
	},
},
```
→
```tsx
// 변경 후
{
	id: TUTORIAL_JOYRIDE_STEP_IDS.finalAlt,
	target: '[data-tutorial="final-alt"]',
	title: "Step 4. 최종 ALT 확정",
	content: demo("이미지를 보고 대체텍스트를 직접 입력하세요. 맞춤법 검사기로 완벽한 문장을 만들 수 있습니다."),
	placement: "auto",
	skipBeacon: true,
	scrollOffset: 100,
	offset: 14,
	floatingOptions: {
		shiftOptions: { padding: 16 },
		flipOptions: { padding: 20, fallbackPlacements: ["left", "top", "bottom", "right"] },
	},
},
```

- [ ] **Step 3: Step 7(구 Step 8, 최종 산출물) — 번호와 문구를 엑셀 중심으로 수정**

```tsx
// 기존
{
	id: TUTORIAL_JOYRIDE_STEP_IDS.exportDeliverables,
	target: '[data-tutorial="export-deliverables"]',
	title: "Step 8. 최종 산출물",
	content: demo("작업이 완료된 HTML과 엑셀을 한 번에 다운로드하세요!"),
	placement: "right",
	skipBeacon: true,
	scrollOffset: 120,
},
```
→
```tsx
// 변경 후
{
	id: TUTORIAL_JOYRIDE_STEP_IDS.exportDeliverables,
	target: '[data-tutorial="export-deliverables"]',
	title: "Step 7. 최종 산출물",
	content: demo("ALT 작성이 끝난 항목을 승인한 뒤, 엑셀 산출물을 다운로드하세요!"),
	placement: "right",
	skipBeacon: true,
	scrollOffset: 120,
},
```

- [ ] **Step 4: 예시 텍스트 상수 개명**

```tsx
// 기존
/** Step 4 진입 시 추출 텍스트 칸에 넣는 예시 문구 */
export const TUTORIAL_EXAMPLE_EXTRACTED_TEXT = "추출된 텍스트입니다";
```
→
```tsx
// 변경 후
/** Step 4 진입 시 최종 ALT 칸에 넣는 예시 문구 */
export const TUTORIAL_EXAMPLE_ALT_TEXT = "예시 대체텍스트입니다";
```

- [ ] **Step 5: `components/image-review-workspace.tsx`에서 개명된 이름으로 동기화**

```tsx
// 기존
import { getTutorialJoyrideSteps, TUTORIAL_EXAMPLE_EXTRACTED_TEXT } from "@/lib/tutorial-joyride-steps";
```
→
```tsx
// 변경 후
import { getTutorialJoyrideSteps, TUTORIAL_EXAMPLE_ALT_TEXT } from "@/lib/tutorial-joyride-steps";
```

```tsx
// 기존 (Task 1 Step 10에서 finalAlt로 바꿔둔 부분)
setItems((prev) => prev.map((it) => (it.id === firstId ? { ...it, finalAlt: TUTORIAL_EXAMPLE_EXTRACTED_TEXT } : it)));
```
→
```tsx
// 변경 후
setItems((prev) => prev.map((it) => (it.id === firstId ? { ...it, finalAlt: TUTORIAL_EXAMPLE_ALT_TEXT } : it)));
```

- [ ] **Step 6: Step 1(업로드) 문구 재확인 — OCR 언급이 없으므로 변경 불필요**

현재 문구("이미지·HTML·ZIP 파일을 업로드하세요. HTML이 있으면 img alt와 목록이 서로 맞게 자동 매칭됩니다.")는 추출 기능을 언급하지 않으므로 그대로 둔다. Step 2(이미지 리스트), Step 5(검수 의사결정), Step 6(진행률 체크)도 추출 기능과 무관하므로 변경하지 않는다.

- [ ] **Step 7: `npm run lint` 실행**

```bash
npm run lint
```

- [ ] **Step 8: `npm run dev`로 브라우저에서 튜토리얼 재생 확인**

```bash
npm run dev
```

"TUTORIAL" 버튼 클릭 → 7단계 모두 다음 내용으로 자연스럽게 이어지는지 확인:
1. 업로드 → 2. 이미지 리스트 → 3. 이미지 뷰어(확대/축소만 언급) → 4. 최종 ALT 확정(직접 입력 + 예시 문구 "예시 대체텍스트입니다"가 최종 ALT 칸에 채워짐) → 5. 검수 의사결정 → 6. 진행률 체크 → 7. 최종 산출물(엑셀 언급).

토글 관련 스텝이 더 이상 나타나지 않는지, 각 스텝의 타겟 하이라이트가 올바른 요소를 가리키는지 시각적으로 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add components/image-review-workspace.tsx lib/tutorial-joyride-steps.tsx
git commit -m "ALT 작성 인앱 튜토리얼 문구를 추출 기능 제거 이후 화면 구성에 맞게 갱신"
```

---

### Task 3: 최종 통합 검증

**Files:** 없음 (검증 전용, 코드 변경 없음)

- [ ] **Step 1: 전체 lint 재확인**

```bash
npm run lint
```

- [ ] **Step 2: 개발 서버로 전체 시나리오 재확인**

```bash
npm run dev
```

- 첫 진입 화면: 타이틀 "대체텍스트(ALT) 편집" + 새 서브타이틀만 보이고 ON/OFF·엔진 선택 UI가 전혀 없음.
- 이미지+HTML이 포함된 ZIP 업로드 → 여러 항목을 "최종 ALT" 직접 입력 → 맞춤법 검사·적용 → 승인/대상 제외/나중에 검수 버튼 정상 동작 → 진행률 바 갱신 확인.
- 모든 대상 승인 완료(또는 미완료 상태에서도 — OFF 고정이므로 승인 여부와 무관하게) "산출물보내기" 클릭 시 `.xlsx` 파일이 다운로드되고, 엑셀 안의 `alt` 값이 방금 입력한 최종 ALT와 일치하는지 셀 내용을 열어 확인.
- "TUTORIAL" 버튼으로 7단계 투어를 끝까지 재생 — 중간에 콘솔 에러나 타겟 미스매치(스텝이 하이라이트할 요소를 못 찾아 화면 중앙에 뜨는 현상)가 없는지 확인.
- 다른 메뉴(`ALT 검수`, `이미지 대조`)가 이번 변경으로 영향받지 않았는지 가볍게 클릭해 확인 (이번 변경은 `image-review-workspace.tsx`/`tutorial-joyride-steps.tsx`에 한정되어 있어 원칙적으로 무관해야 함).

- [ ] **Step 3: 회귀 없음을 최종 확인 후 작업 종료 보고**

문제가 없으면 완료로 표시. 문제가 있으면(예: 엑셀 다운로드 실패, 투어 크래시) 어느 Task/Step에서 재현되는지 기록하고 해당 Step으로 돌아가 수정한다.
