import type { Step } from "react-joyride";

export const INSPECTION_TUTORIAL_DEMO_TEXT = "예시 ALT 텍스트입니다. 이미지와 대체텍스트를 비교해 PASS/FAIL을 선택하세요.";

export function getInspectionTutorialSteps(): Step[] {
	return [
		{
			target: "[data-tutorial='inspection-upload']",
			title: "1) 파일 업로드",
			content: "퍼블리싱 ZIP과 ALT 엑셀(xlsx)을 업로드합니다.",
			placement: "right",
		},
		{
			target: "[data-tutorial='inspection-image-list']",
			title: "2) 이미지 목록",
			content: "업로드된 이미지가 목록으로 표시되고, 클릭해서 검수 대상을 선택합니다.",
			placement: "right",
		},
		{
			target: "[data-tutorial='inspection-viewer']",
			title: "3) 이미지 뷰어",
			content: "선택한 이미지를 확대/축소하면서 원문 포함 여부를 확인합니다.",
			placement: "bottom",
		},
		{
			target: "[data-tutorial='inspection-html-alt']",
			title: "4) HTML ALT",
			content: "HTML에서 추출한 alt 텍스트를 확인합니다.",
			placement: "left",
		},
		{
			target: "[data-tutorial='inspection-excel-alt']",
			title: "5) 엑셀 ALT + 코멘트",
			content: "문장을 드래그해 코멘트를 입력하면 하단 검수 코멘트에 누적됩니다.",
			placement: "left",
		},
		{
			target: "[data-tutorial='inspection-comment']",
			title: "6) 검수 코멘트",
			content: "선택 영역과 수정 사항이 이미지 단위로 정리됩니다.",
			placement: "top",
		},
		{
			target: "[data-tutorial='inspection-progress']",
			title: "7) 진행률",
			content: "PASS/FAIL 판정 완료 건수를 기준으로 진행률이 집계됩니다.",
			placement: "top",
		},
		{
			target: "[data-tutorial='inspection-actions']",
			title: "8) 판정 버튼",
			content: "나중에 검수 / 대상 제외 / PASS / FAIL 로 판정을 진행합니다.",
			placement: "top",
		},
		{
			target: "[data-tutorial='inspection-download-report']",
			title: "9) 결과 다운로드",
			content: "검수 결과 보고서를 txt 파일로 다운로드합니다.",
			placement: "right",
		},
	];
}
