/** ZIP/아카이브 기준 첫 경로 세그먼트(보통 압축 파일명) 제거 */
function stripArchivePrefix(name: string): string {
	const n = name.replace(/\\/g, "/").trim();
	const i = n.indexOf("/");
	if (i === -1) return n;
	return n.slice(i + 1);
}

function packageHasImgFolder(names: string[]): boolean {
	return names.some((name) => {
		const rel = stripArchivePrefix(name).toLowerCase();
		return rel.startsWith("img/") || rel.includes("/img/");
	});
}

/**
 * C3 규칙: 패키지에 img 폴더가 있으면 `img/파일명`, 이미 경로에 img/가 있으면 그 이하만,
 * 없으면 파일명만.
 */
export function excelDeliverableImagePathLabel(name: string, allNames: string[]): string {
	const rel = stripArchivePrefix(name);
	const hasImg = packageHasImgFolder(allNames);
	const lower = rel.toLowerCase();
	const idx = lower.indexOf("img/");
	if (idx !== -1) return rel.slice(idx);
	const file = rel.split("/").pop() ?? rel;
	if (hasImg) return `img/${file}`;
	return file;
}
