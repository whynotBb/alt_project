import { Suspense } from "react";
import { ImageReviewWorkspace } from "@/components/image-review-workspace";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
	return (
		<div className="flex min-h-full flex-1 flex-col">
			<SiteHeader tutorialHref="/?tutorial=1" />
			<main className="mx-auto flex h-[calc(100vh-64px)] w-full flex-1 flex-col px-4 py-6">
				<Suspense fallback={<div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">작업 화면을 불러오는 중…</div>}>
					<ImageReviewWorkspace />
				</Suspense>
			</main>
		</div>
	);
}
