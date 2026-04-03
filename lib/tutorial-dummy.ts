/**
 * 튜토리얼용 더미 자산. 이미지 파일은 `public/tutorial_1.png`, `public/tutorial_2.png`에 두세요.
 */
export const TUTORIAL_IMAGE_1_TEXT = `Alt-text Helper 튜토리얼
step 1  이미지를 업로드 하시면, 이미지 내 텍스트를 추출 합니다.
step 2  추출된 이미지를 html 내 img 태그에 alt 값으로 주입 합니다.
step 3  엑셀 산출물로 다운로드 할 수 있습니다.`;

export const TUTORIAL_IMAGE_2_TEXT =
	"텍스트 분석 기술을 활용하여 대체텍스트 입력을 돕습니다.";

export type TutorialDummyImageItem = {
	id: string;
	fileName: string;
	publicPath: string;
	/** OCR 추출 텍스트·검수 ALT에 동일하게 쓰는 더미 문구 */
	extractedText: string;
	finalAlt: string;
};

export const TUTORIAL_DUMMY_IMAGE_ITEMS: readonly TutorialDummyImageItem[] = [
	{
		id: "tutorial-1",
		fileName: "tutorial_1.png",
		publicPath: "/tutorial_1.png",
		extractedText: TUTORIAL_IMAGE_1_TEXT,
		finalAlt: TUTORIAL_IMAGE_1_TEXT,
	},
	{
		id: "tutorial-2",
		fileName: "tutorial_2.png",
		publicPath: "/tutorial_2.png",
		extractedText: TUTORIAL_IMAGE_2_TEXT,
		finalAlt: TUTORIAL_IMAGE_2_TEXT,
	},
];
