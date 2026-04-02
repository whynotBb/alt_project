import { ImageReviewWorkspace } from "@/components/image-review-workspace";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
	return (
		<div className="flex min-h-full flex-1 flex-col">
			<SiteHeader />
			<main className="mx-auto flex w-full flex-1 flex-col px-4 py-6 h-[calc(100vh-64px)]">
				<ImageReviewWorkspace />
			</main>
		</div>
	);
}
