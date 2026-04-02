"use client";

import { useCallback, useRef } from "react";
import {
	TransformComponent,
	TransformWrapper,
	type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageViewerZoomProps = {
	src: string;
	alt: string;
	className?: string;
};

export function ImageViewerZoom({ src, alt, className }: ImageViewerZoomProps) {
	const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
	const imgRef = useRef<HTMLImageElement | null>(null);

	const fitToViewport = useCallback(() => {
		const img = imgRef.current;
		const api = transformRef.current;
		if (!img?.naturalWidth || !api) return;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				transformRef.current?.zoomToElement(img, undefined, 0);
			});
		});
	}, []);

	const handleReset = useCallback(() => {
		const img = imgRef.current;
		const api = transformRef.current;
		if (!img || !api) return;
		api.zoomToElement(img, undefined, 200);
	}, []);

	return (
		<div className={cn("relative flex min-h-0 w-full flex-1 flex-col", className)}>
			<Button
				type="button"
				variant="secondary"
				size="sm"
				className="absolute top-0 right-0 z-10 h-7 px-2.5 text-xs shadow-sm"
				onClick={handleReset}
			>
				reset
			</Button>
			<div className="min-h-0 flex-1 pt-9">
				<TransformWrapper
					ref={transformRef}
					initialScale={1}
					minScale={0.12}
					maxScale={12}
					limitToBounds
					centerOnInit={false}
					wheel={{ step: 0.12 }}
					pinch={{ step: 5 }}
					doubleClick={{ mode: "zoomIn", step: 0.65, animationTime: 200 }}
				>
					<TransformComponent
						wrapperClass="!size-full !max-h-full"
						wrapperStyle={{ width: "100%", height: "100%", maxHeight: "100%" }}
						contentClass="!flex !size-full !max-h-full !w-full !max-w-full items-center justify-center"
						contentStyle={{
							width: "100%",
							height: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							ref={imgRef}
							src={src}
							alt={alt}
							draggable={false}
							onLoad={fitToViewport}
							className="max-h-full max-w-full rounded-lg object-contain shadow-md ring-1 ring-black/5 select-none"
						/>
					</TransformComponent>
				</TransformWrapper>
			</div>
		</div>
	);
}
