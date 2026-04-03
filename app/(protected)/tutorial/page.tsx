import Image from "next/image";
import { TUTORIAL_DUMMY_IMAGE_ITEMS } from "@/lib/tutorial-dummy";

export default function TutorialPage() {
	return (
		<div className="flex flex-col gap-8">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">튜토리얼 (더미 데이터)</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					이미지는 <code className="rounded bg-muted px-1 py-0.5 text-xs">public/tutorial_1.png</code>,{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-xs">public/tutorial_2.png</code> 를 사용합니다.
				</p>
			</div>
			<ul className="flex flex-col gap-10">
				{TUTORIAL_DUMMY_IMAGE_ITEMS.map((item) => (
					<li key={item.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
						<p className="mb-3 text-sm font-medium text-muted-foreground">{item.fileName}</p>
						<div className="relative mb-4 aspect-video max-h-64 w-full overflow-hidden rounded-lg border border-border bg-muted/30">
							<Image src={item.publicPath} alt="" fill className="object-contain" sizes="(max-width: 896px) 100vw, 896px" />
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">추출 텍스트 (더미)</h2>
								<pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">{item.extractedText}</pre>
							</div>
							<div>
								<h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">최종 ALT (더미)</h2>
								<pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">{item.finalAlt}</pre>
							</div>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
