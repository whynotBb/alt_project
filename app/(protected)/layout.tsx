import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { isOpenAccessDev } from "@/lib/dev-access";
import { assertIpAllowed } from "@/lib/security/ip-guard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!isOpenAccessDev()) {
    const session = await auth();
    if (!session?.user) {
      redirect("/login");
    }
  }
  await assertIpAllowed(await headers());
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
