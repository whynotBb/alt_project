import { assertIpAllowed } from "@/lib/security/ip-guard";
import { isOpenAccessDev } from "@/lib/dev-access";
import { headers } from "next/headers";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isOpenAccessDev()) {
    const h = await headers();
    await assertIpAllowed(h);
  }
  return <>{children}</>;
}
