import { Suspense } from "react";
import { AltInspectionWorkspace } from "@/components/alt-inspection-workspace";
import { SiteHeader } from "@/components/site-header";

export default function InspectionPage() {
	return (
		<div className="flex min-h-full flex-1 flex-col">
			<SiteHeader tutorialHref="/inspection?tutorial=1" />
			<main className="mx-auto flex h-[calc(100vh-64px)] w-full flex-1 flex-col px-4 py-6">
				<Suspense fallback={<div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">검수 화면을 불러오는 중…</div>}>
					<AltInspectionWorkspace />
				</Suspense>
			</main>
		</div>
	);
}
