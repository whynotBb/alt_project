"use client";

import type { ReactNode } from "react";
import { Check, RotateCcw, Undo2, X } from "lucide-react";
import { type RowComponentProps } from "react-window";
import { cn } from "@/lib/utils";
import { excelDeliverableImagePathLabel } from "@/lib/client/deliverable-image-path-label";

export type ImageListRowVariant = "extract" | "inspection";

export type ImageListRowItem = {
	id: string;
	name: string;
	url: string;
	excludedFromTarget: boolean;
	/** ALT 작성: 검수 완료 */
	reviewed?: boolean;
	/** ALT 검수: pass / fail / 미결정 */
	outcome?: "pending" | "pass" | "fail";
};

export type ImageListRowData = {
	items: ImageListRowItem[];
	itemNames: string[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onUndoExclude?: (id: string) => void;
	/** ALT 작성: 승인·대상 제외 판정 되돌리기 */
	onUndoJudgment?: (id: string) => void;
	variant: ImageListRowVariant;
};

export function ImageListRow({ index, style, ...data }: RowComponentProps<ImageListRowData>) {
	const it = data.items[index];
	const isActive = it.id === data.selectedId;
	const listLabel = excelDeliverableImagePathLabel(it.name, data.itemNames);

	let statusIcon: ReactNode = <span className="size-5 shrink-0" aria-hidden />;
	if (it.excludedFromTarget) {
		statusIcon = (
			<span className="shrink-0 text-base" title="대상 제외" aria-label="대상 제외">
				⊘
			</span>
		);
	} else if (data.variant === "extract") {
		if (it.reviewed) {
			statusIcon = (
				<span className="shrink-0 text-base" title="검수 완료" aria-label="검수 완료">
					✅
				</span>
			);
		}
	} else {
		if (it.outcome === "pass") {
			statusIcon = (
				<span className="flex size-5 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400" title="Pass" aria-label="Pass">
					<Check className="size-4" strokeWidth={2.5} aria-hidden />
				</span>
			);
		} else if (it.outcome === "fail") {
			statusIcon = (
				<span className="flex size-5 shrink-0 items-center justify-center text-red-600 dark:text-red-400" title="Fail" aria-label="Fail">
					<X className="size-4" strokeWidth={2.5} aria-hidden />
				</span>
			);
		}
	}

	const showExtractUndo =
		data.variant === "extract" && data.onUndoJudgment && (Boolean(it.reviewed) || it.excludedFromTarget);

	return (
		<div style={style} className="pb-1">
			<div
				className={cn(
					"flex h-[48px] w-full items-center gap-1.5 rounded-xl border border-transparent px-2 text-left text-sm transition-colors",
					isActive ? "border-primary/25 bg-sky-50 shadow-sm dark:bg-sky-950/40" : it.excludedFromTarget ? "text-muted-foreground opacity-80 hover:bg-muted/70" : "text-foreground hover:bg-muted/70",
				)}
			>
				<button type="button" data-item-id={it.id} onClick={() => data.onSelect(it.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
					<span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted/40" aria-hidden>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={it.url} alt="" className="size-full object-cover" />
					</span>
					<span className="min-w-0 flex-1 truncate font-medium" title={it.name !== listLabel ? `${listLabel} — ${it.name}` : it.name}>
						{listLabel}
					</span>
				</button>
				<div className="flex shrink-0 items-center gap-0.5">
					<span className="flex size-5 items-center justify-center">{statusIcon}</span>
					{showExtractUndo ? (
						<button
							type="button"
							className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onClick={(e) => {
								e.stopPropagation();
								data.onUndoJudgment?.(it.id);
							}}
							aria-label={it.excludedFromTarget ? `${listLabel} 대상 제외 취소` : `${listLabel} 승인 취소`}
							title={it.excludedFromTarget ? "대상 제외 취소" : "승인 취소"}
						>
							<Undo2 className="size-3.5" aria-hidden />
						</button>
					) : null}
					{data.variant === "inspection" && it.excludedFromTarget && data.onUndoExclude ? (
						<button
							type="button"
							className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background/80 px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onClick={(e) => {
								e.stopPropagation();
								data.onUndoExclude?.(it.id);
							}}
							aria-label={`${listLabel} 대상 제외 취소`}
						>
							<RotateCcw className="size-3" aria-hidden />
							취소
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}
