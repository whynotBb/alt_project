import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isOpenAccessDev } from "@/lib/dev-access";
import { matchesRule } from "@/lib/security/ip";

/**
 * Edge에서 DB 없이 빠르게 걸러낼 때 사용합니다.
 * OPEN_ACCESS_DEV=true 이면 IP 검사를 건너뜁니다.
 * ALLOWED_IPS가 비어 있으면 이 단계는 통과하고, 보호 레이아웃에서 DB+환경을 다시 검사합니다.
 */
export function middleware(request: NextRequest) {
  if (isOpenAccessDev()) {
    return NextResponse.next();
  }
  const raw = request.headers.get("x-forwarded-for");
  const ip = raw?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";
  const envList = (process.env.ALLOWED_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (envList.length === 0) {
    return NextResponse.next();
  }

  const ok = envList.some((rule) => matchesRule(ip, rule));
  if (!ok) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/upload/:path*", "/admin/:path*"],
};
