"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getClientIpFromHeaders } from "@/lib/security/ip";
import { headers } from "next/headers";

/**
 * 파이프라인 완료 시점에서 호출해 검수 건수를 남깁니다.
 */
export async function recordAuditEvent(action: string, fileCount: number): Promise<void> {
  const session = await auth();
  const h = await headers();
  const clientIp = getClientIpFromHeaders(h) || "unknown";
  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id ?? null,
      action,
      fileCount,
      clientIp,
    },
  });
}
