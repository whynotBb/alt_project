export function normalizeImportedAltText(text: string): string {
	const normalizedLineBreaks = text.replace(/\r\n?/g, "\n");
	return normalizedLineBreaks.replace(/^[\t \u00a0]+/gm, " ");
}
