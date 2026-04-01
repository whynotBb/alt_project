"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SPECIAL_CHAR_BINDINGS,
  SPECIAL_CHAR_SHORTCUT_STORAGE_KEY,
  loadSpecialCharBindings,
  tryHandleSpecialCharShortcut,
} from "@/lib/client/special-char-shortcuts";

export function ShortcutSpecialCharMenu() {
  const [bindings, setBindings] = React.useState<string[]>(() => [...DEFAULT_SPECIAL_CHAR_BINDINGS]);

  React.useEffect(() => {
    setBindings(loadSpecialCharBindings());
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === SPECIAL_CHAR_SHORTCUT_STORAGE_KEY) {
        setBindings(loadSpecialCharBindings());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      tryHandleSpecialCharShortcut(e, bindings);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindings]);

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-label="특수문자 붙여넣기 단축키"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3",
        )}
      >
        <Keyboard className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="hidden sm:inline">단축키</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup
            className={cn(
              "w-[min(100vw-1rem,20rem)] rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none",
            )}
          >
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
              텍스트 입력란에 포커스일 때{" "}
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>{" "}
              또는{" "}
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘</kbd>+
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Shift</kbd>
              + 영문 알파벳 순서(
              <span className="font-mono">A…</span>)로 아래 문자를 넣습니다.
            </p>
            <ul className="max-h-72 space-y-0.5 overflow-y-auto overscroll-contain" role="list">
              {bindings.map((ch, i) => {
                const letter = String.fromCharCode(65 + i);
                return (
                  <li
                    key={`${i}-${letter}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/70"
                  >
                    <span className="flex flex-wrap items-center gap-0.5 text-[11px] text-muted-foreground">
                      <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">Ctrl</kbd>
                      <span aria-hidden>+</span>
                      <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">Shift</kbd>
                      <span aria-hidden>+</span>
                      <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono font-semibold text-foreground">
                        {letter}
                      </kbd>
                    </span>
                    <span className="select-all text-lg font-medium tracking-tight">{ch}</span>
                  </li>
                );
              })}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
