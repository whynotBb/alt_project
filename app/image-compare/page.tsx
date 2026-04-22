import { Suspense } from "react";
import { ImageComparatorWorkspace } from "@/components/image-comparator-workspace";
import { SiteHeader } from "@/components/site-header";

export default function ImageComparePage() {
	return (
		<div className="flex min-h-full flex-1 flex-col">
			<SiteHeader tutorialHref="/image-compare" />
			<main className="mx-auto flex h-[calc(100vh-64px)] w-full flex-1 flex-col px-4 py-6">
				<Suspense fallback={<div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">이미지 대조 화면을 불러오는 중…</div>}>
					<ImageComparatorWorkspace />
				</Suspense>
			</main>
		</div>
	);
}

