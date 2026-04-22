import { Suspense } from "react";
import { TextComparatorWorkspace } from "@/components/text-comparator-workspace";
import { SiteHeader } from "@/components/site-header";

export default function ComparatorPage() {
	return (
		<div className="flex min-h-full flex-1 flex-col">
			<SiteHeader tutorialHref="/comparator?tutorial=1" />
			<main className="mx-auto flex h-[calc(100vh-64px)] w-full flex-1 flex-col px-4 py-6">
				<Suspense fallback={<div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">텍스트 대조 화면을 불러오는 중…</div>}>
					<TextComparatorWorkspace />
				</Suspense>
			</main>
		</div>
	);
}
