"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "alt-inspector-theme";

let themeNotifyEpoch = 0;
const themeSubscribers = new Set<() => void>();

function notifyThemeSubscribers() {
	themeNotifyEpoch += 1;
	themeSubscribers.forEach((fn) => fn());
}

function readTheme(): boolean {
	const saved = window.localStorage.getItem(STORAGE_KEY);
	if (saved === "dark") return true;
	if (saved === "light") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDark(dark: boolean) {
	document.documentElement.classList.toggle("dark", dark);
}

function subscribeTheme(onChange: () => void) {
	themeSubscribers.add(onChange);
	const mql = window.matchMedia("(prefers-color-scheme: dark)");
	const onStorage = (e: StorageEvent) => {
		if (e.key === STORAGE_KEY || e.key === null) onChange();
	};
	mql.addEventListener("change", onChange);
	window.addEventListener("storage", onStorage);
	return () => {
		themeSubscribers.delete(onChange);
		mql.removeEventListener("change", onChange);
		window.removeEventListener("storage", onStorage);
	};
}

function getThemeSnapshot() {
	void themeNotifyEpoch;
	return readTheme();
}

export function ThemeToggle() {
	const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => false);

	useEffect(() => {
		applyDark(dark);
	}, [dark]);

	const toggle = useCallback(() => {
		const next = !readTheme();
		window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
		applyDark(next);
		notifyThemeSubscribers();
	}, []);

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className="text-muted-foreground"
			aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
			onClick={toggle}
		>
			{dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
		</Button>
	);
}
