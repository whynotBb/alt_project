import type { Step } from "react-joyride";

/** `ImageReviewWorkspace` 안에서 `controls.next()`로 바로 진행할 때 쓰는 step id */
export const TUTORIAL_JOYRIDE_STEP_IDS = {
	upload: "tutorial-upload",
	imageList: "tutorial-image-list",
	imageViewer: "tutorial-image-viewer",
	finalAlt: "tutorial-final-alt",
	reviewActions: "tutorial-review-actions",
	progress: "tutorial-progress",
	exportDeliverables: "tutorial-export",
} as const;

const demo = (s: string) => <p className="m-0 text-xs leading-relaxed text-pretty">{s}</p>;

export function getTutorialJoyrideSteps(): Step[] {
	return [
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.upload,
			target: '[data-tutorial="upload"]',
			title: "Step 1. 데이터 업로드",
			content: demo("이미지·HTML·ZIP 파일을 업로드하세요. HTML이 있으면 img alt와 목록이 서로 맞게 자동 매칭됩니다."),
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
			id: TUTORIAL_JOYRIDE_STEP_IDS.imageViewer,
			target: '[data-tutorial="image-viewer"]',
			title: "Step 3. 이미지 뷰어",
			content: demo("이미지를 확대/축소하며 자세히 확인하세요."),
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
		{
			id: TUTORIAL_JOYRIDE_STEP_IDS.reviewActions,
			target: '[data-tutorial="review-actions"]',
			title: "Step 5. 검수 의사결정 (승인/제외)",
			content: demo("버튼 순서는 나중에 검수 → 대상 제외 → 승인입니다. 미룰 때는 '나중에 검수', 제외할 이미지는 '대상 제외', 확정 시 '승인'을 누르세요."),
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
			id: TUTORIAL_JOYRIDE_STEP_IDS.exportDeliverables,
			target: '[data-tutorial="export-deliverables"]',
			title: "Step 7. 최종 산출물",
			content: demo("ALT 작성이 끝난 항목을 승인한 뒤, 엑셀 산출물을 다운로드하세요!"),
			placement: "right",
			skipBeacon: true,
			scrollOffset: 120,
		},
	];
}

/** Step 4 진입 시 최종 ALT 칸에 넣는 예시 문구 */
export const TUTORIAL_EXAMPLE_ALT_TEXT = "예시 대체텍스트입니다";
