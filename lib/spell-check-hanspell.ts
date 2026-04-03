import { decode } from "html-entities";
import type { SpellHit } from "@/types/spell-hit";

const DAUM_URL = "https://dic.daum.net/grammar_checker.do";
const DAUM_MAX_CHARS = 1000;
const DAUM_MIN_INTERVAL_MS = 400;
const VALID_BODY_MARKER = '="screen_out">맞춤법 검사기 본문</h2>';

/** 서버리스·데이터센터 IP에서도 차단이 덜하도록 일반 브라우저에 가깝게 요청합니다. */
const DAUM_REQUEST_HEADERS: Record<string, string> = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
	Referer: `${DAUM_URL}`,
	Origin: "https://dic.daum.net",
};

function indexOfAny(str: string, separator: string, from: number): number {
	const founds = separator
		.split("")
		.map((s) => str.indexOf(s, from))
		.filter((s) => s > -1)
		.sort((a, b) => a - b);
	return founds.length === 0 ? -1 : founds[0]!;
}

/** hanspell `split-string.byLength` 와 동일 (다음 API 1000자 제한) */
function splitSentenceByLength(str: string, separator: string, limit: number): string[] {
	let found = -1;
	let lastFound = -1;
	let lastSplitted = -1;
	const splitted: string[] = [];

	for (;;) {
		found = indexOfAny(str, separator, lastFound + 1);
		if (found === -1) break;
		if (found - lastSplitted > limit) {
			splitted.push(str.slice(lastSplitted + 1, lastFound + 1));
			lastSplitted = lastFound;
		}
		lastFound = found;
	}

	if (lastSplitted + 1 !== str.length) {
		if (str.length - lastSplitted - 1 <= limit) {
			splitted.push(str.slice(lastSplitted + 1));
		} else {
			if (lastSplitted !== lastFound) {
				splitted.push(str.slice(lastSplitted + 1, lastFound + 1));
			}
			splitted.push(str.slice(lastFound + 1));
		}
	}

	return splitted;
}

function getAttr(html: string, key: string): string {
	const found = html.indexOf(key);
	const firstQuote = html.indexOf('"', found + 1);
	const secondQuote = html.indexOf('"', firstQuote + 1);
	return html.slice(firstQuote + 1, secondQuote);
}

type RawTypo = { token: string; suggestions: string[] };

function parseDaumGrammarHtml(response: string): RawTypo[] {
	const typos: RawTypo[] = [];
	let found = -1;

	for (;;) {
		found = response.indexOf("data-error-type", found + 1);
		if (found === -1) break;

		const end = response.indexOf(">", found + 1);
		const line = response.slice(found, end);
		const token = decode(getAttr(line, "data-error-input="));
		const output = decode(getAttr(line, "data-error-output="));
		if (token) {
			typos.push({ token, suggestions: output ? [output] : [] });
		}
	}

	return typos;
}

function alignTyposToText(text: string, raw: RawTypo[]): SpellHit[] {
	let from = 0;
	const hits: SpellHit[] = [];
	for (const t of raw) {
		if (!t.token) continue;
		const rep = t.suggestions[0];
		if (rep === undefined || rep === "") continue;
		const idx = text.indexOf(t.token, from);
		if (idx === -1) continue;
		hits.push({
			start: idx,
			end: idx + t.token.length,
			token: t.token,
			replacement: rep,
		});
		from = idx + t.token.length;
	}
	return hits;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function fetchDaumChunk(sentence: string, timeoutMs: number): Promise<RawTypo[]> {
	const body = sentence.replace(/<[^ㄱ-ㅎㅏ-ㅣ가-힣>]+>/g, "");
	if (body.length === 0) return [];

	const res = await fetch(DAUM_URL, {
		method: "POST",
		headers: {
			...DAUM_REQUEST_HEADERS,
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		},
		body: new URLSearchParams({ sentence: body }).toString(),
		signal: AbortSignal.timeout(timeoutMs),
		redirect: "follow",
		cache: "no-store",
	});

	const html = await res.text();
	if (!res.ok) {
		throw new Error(`다음 맞춤법 서버 응답 ${res.status}. 배포 환경에서 IP·WAF 제한일 수 있습니다.`);
	}
	if (!html.includes(VALID_BODY_MARKER)) {
		console.error("[spell-check] unexpected Daum HTML (no marker), length=", html.length);
		throw new Error(
			"다음 맞춤법 페이지 형식이 예상과 다릅니다. (차단·리다이렉트·페이지 변경 가능) 배포 서버 IP에서 접근이 제한됐을 수 있습니다.",
		);
	}
	return parseDaumGrammarHtml(html);
}

/**
 * 다음 dic 맞춤법 검사 (네트워크 필요).
 * 구 `hanspell`+`request` 대신 `fetch`를 쓰면 Vercel 등 서버리스·Node 20+에서 안정적입니다.
 */
export async function runHanspellDaum(text: string, timeoutMs = 15000): Promise<SpellHit[]> {
	if (text.length === 0) return [];

	const cleaned = text.replace(/<[^ㄱ-ㅎㅏ-ㅣ가-힣>]+>/g, "");
	const chunks = splitSentenceByLength(cleaned, ".,\n", DAUM_MAX_CHARS);
	const raw: RawTypo[] = [];
	const perChunkTimeout = Math.max(5000, Math.min(timeoutMs, 45_000));

	for (let i = 0; i < chunks.length; i++) {
		if (i > 0) await sleep(DAUM_MIN_INTERVAL_MS);
		const part = await fetchDaumChunk(chunks[i]!, perChunkTimeout);
		raw.push(...part);
	}

	return alignTyposToText(text, raw);
}
