"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type EditablePlainTextProps = {
	id?: string;
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	"aria-busy"?: boolean;
};

/**
 * textarea 대신 contenteditable div — 줄바꿈·공백은 `whitespace-pre-wrap`으로 유지
 */
export function EditablePlainText({ id, value, onChange, disabled, placeholder, className, "aria-busy": ariaBusy }: EditablePlainTextProps) {
	const ref = useRef<HTMLDivElement>(null);
	const showPlaceholder = Boolean(placeholder) && !disabled && value.trim().length === 0;

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (document.activeElement === el) return;
		if (el.textContent !== value) {
			el.textContent = value;
		}
	}, [value]);

	return (
		<div className="relative min-h-0 flex-1">
			{showPlaceholder ? (
				<p className="pointer-events-none absolute inset-0 z-0 overflow-hidden p-4 text-left font-mono text-sm leading-relaxed text-muted-foreground select-none">{placeholder}</p>
			) : null}
			<div
				ref={ref}
				id={id}
				role="textbox"
				aria-multiline
				aria-busy={ariaBusy}
				contentEditable={!disabled}
				suppressContentEditableWarning
				onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
				onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
				className={cn(
					"relative z-10 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap wrap-break-word border-0 bg-background/80 p-4 font-mono text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset",
					disabled && "cursor-not-allowed opacity-60",
					className,
				)}
			/>
		</div>
	);
}
