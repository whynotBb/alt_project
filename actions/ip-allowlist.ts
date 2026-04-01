"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function addAllowedIp(cidr: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "로그인이 필요합니다." };
  }
  const trimmed = cidr.trim();
  if (!trimmed) {
    return { ok: false, error: "규칙을 입력하세요." };
  }
  try {
    await prisma.allowedIp.create({ data: { cidr: trimmed, note: note?.trim() || null } });
    revalidatePath("/admin/ip-allowlist");
    return { ok: true };
  } catch {
    return { ok: false, error: "중복이거나 저장에 실패했습니다." };
  }
}
