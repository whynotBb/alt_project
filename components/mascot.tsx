"use client";

import { cn } from "@/lib/utils";

type Mood = "happy" | "working" | "success";

export function Mascot({
  mood,
  size = "md",
  className,
}: {
  mood: Mood;
  size?: "sm" | "md";
  className?: string;
}) {
  const dim = size === "sm" ? "size-7 text-lg" : "size-9 text-xl";
  const face =
    mood === "working" ? "◔‿◔" : mood === "success" ? "ᵔᴗᵔ" : "◕‿◕";
  return (
    <span
      className={cn(
        "flex select-none items-center justify-center rounded-full bg-linear-to-br from-primary/15 to-cyan-400/20 font-sans",
        dim,
        className,
      )}
      aria-hidden
    >
      {face}
    </span>
  );
}
