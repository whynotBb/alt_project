import type { Step } from "react-joyride";

/** `ImageReviewWorkspace` 안에서 `controls.next()`로 바로 진행할 때 쓰는 step id */
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

const demo = (s: string) => <p className="m-0 text-xs leading-relaxed text-pretty">{s}</p>;

export function getTutorialJoyrideSteps(): Step[] {
	return [
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.upload,
			target: '[data-tutorial="upload"]',
			title: "Step 1. 데이터 업로드",
			content: demo("이미지나 ZIP 파일을 업로드하세요. HTML 파일이 포함되면 자동으로 매칭됩니다."),
			placement: "right",
			skipBeacon: true,
			scrollOffset: 120,
		},
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.imageList,
			target: '[data-tutorial="image-list"]',
			title: "Step 2. 이미지 리스트",
			content: demo("업로드된 파일들이 목록에 나타납니다. 여기서 검수할 이미지를 선택하세요."),
			placement: "right",
			skipBeacon: true,
			scrollOffset: 120,
		},
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.viewerExtract,
			target: '[data-tutorial="viewer-extract"]',
			title: "Step 3. 워크스페이스 (뷰어 & 추출)",
			content: demo("이미지를 확대/축소하며 상세히 확인하고, AI가 추출한 텍스트를 바로 편집해 보세요."),
			/** 타겟 기준 우측 + 세로는 타겟 중앙 정렬(Floating UI `right` 기본) */
			placement: "right",
			skipBeacon: true,
			scrollOffset: 120,
			offset: 12,
			floatingOptions: {
				shiftOptions: { padding: 16 },
				flipOptions: { padding: 16, fallbackPlacements: ["left", "top", "bottom"] },
			},
		},
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
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.reviewActions,
			target: '[data-tutorial="review-actions"]',
			title: "Step 5. 검수 의사결정 (승인/제외)",
			content: demo("검수가 끝나면 '승인'을, 제외할 이미지는 '대상 제외'를 클릭하세요."),
			placement: "top",
			skipBeacon: true,
			scrollOffset: 100,
		},
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.progress,
			target: '[data-tutorial="progress-bar"]',
			title: "Step 6. 진행률 체크",
			content: demo("상단 바에서 전체 작업 진행 상황을 실시간으로 확인하세요."),
			placement: "top",
			skipBeacon: true,
			scrollOffset: 100,
		},
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.reviewModeToggle,
			target: '[data-tutorial="image-review-toggle"]',
			title: "Step 7. 검수 모드 설정",
			content: demo("이미지 검수 없이 엑셀 산출물만 필요하다면 ON/OFF 스위치를 활용하세요."),
			placement: "right",
			skipBeacon: true,
			scrollOffset: 120,
		},
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.exportDeliverables,
			target: '[data-tutorial="export-deliverables"]',
			title: "Step 8. 최종 산출물",
			content: demo("작업이 완료된 HTML과 엑셀을 한 번에 다운로드하세요!"),
			placement: "right",
			skipBeacon: true,
			scrollOffset: 120,
		},
	];
}

/** Step 4 진입 시 추출 텍스트 칸에 넣는 예시 문구 */
export const TUTORIAL_EXAMPLE_EXTRACTED_TEXT = "추출된 텍스트입니다";
