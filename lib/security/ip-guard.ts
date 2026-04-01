import { isOpenAccessDev } from "@/lib/dev-access";
import { prisma } from "@/lib/db/prisma";
import { getClientIpFromHeaders, matchesRule } from "@/lib/security/ip";

/**
 * DB의 AllowedIp + 환경변수 ALLOWED_IPS(쉼표 구분)를 함께 봅니다.
 * OPEN_ACCESS_DEV=true 이면 항상 허용합니다.
 * 둘 다 비어 있으면 개발 편의상 허용(운영 배포 전 반드시 제한하세요).
 */
export async function isClientIpAllowedForApp(clientIp: string): Promise<boolean> {
  if (isOpenAccessDev()) {
    return true;
  }
  const envList = (process.env.ALLOWED_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (envList.length > 0) {
    return envList.some((rule) => matchesRule(clientIp, rule));
  }

  const rows = await prisma.allowedIp.findMany({ select: { cidr: true } });
  if (rows.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  return rows.some((row) => matchesRule(clientIp, row.cidr));
}

export async function assertIpAllowed(headers: { get(name: string): string | null }): Promise<void> {
  const ip = getClientIpFromHeaders(headers);
  const ok = await isClientIpAllowedForApp(ip);
  if (!ok) {
    const { redirect } = await import("next/navigation");
    redirect("/forbidden");
  }
}
