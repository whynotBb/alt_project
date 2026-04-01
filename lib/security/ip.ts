/**
 * 프록시 뒤에서는 x-forwarded-for 첫 구간을 우선 사용합니다.
 * 운영 환경에서는 신뢰할 프록시 범위를 반드시 문서화하세요.
 */
export function getClientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "";
}

/** 단순 IPv4 매칭 (학습용 스켈레톤). CIDR은 후속 단계에서 netmask 라이브러리로 확장 */
export function matchesRule(clientIp: string, rule: string): boolean {
  const r = rule.trim();
  if (!clientIp || !r) return false;
  if (r.includes("/")) {
    const [base] = r.split("/");
    return clientIp === base.trim() || clientIp.startsWith(base.trim() + ".");
  }
  return clientIp === r;
}
