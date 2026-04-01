export const SPECIAL_CHAR_SHORTCUT_STORAGE_KEY = "alt-inspector-special-char-bindings";

export const DEFAULT_SPECIAL_CHAR_BINDINGS: readonly string[] = [
  "\u2122",
  "\u2120",
  "\u00ae",
  "\u00a9",
  "\u3008",
  "\u3009",
  "\u201c",
  "\u201d",
  "\u203b",
  "\u2018",
  "\u2019",
];

export function loadSpecialCharBindings(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_SPECIAL_CHAR_BINDINGS];
  try {
    const raw = window.localStorage.getItem(SPECIAL_CHAR_SHORTCUT_STORAGE_KEY);
    if (!raw) return [...DEFAULT_SPECIAL_CHAR_BINDINGS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_SPECIAL_CHAR_BINDINGS];
    const out = parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (out.length === 0) return [...DEFAULT_SPECIAL_CHAR_BINDINGS];
    return out.slice(0, 26);
  } catch {
    return [...DEFAULT_SPECIAL_CHAR_BINDINGS];
  }
}

export function saveSpecialCharBindings(bindings: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPECIAL_CHAR_SHORTCUT_STORAGE_KEY, JSON.stringify(bindings));
}

function isTextInput(el: Element): el is HTMLTextAreaElement | HTMLInputElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  const t = el.type;
  return t === "text" || t === "search" || t === "url" || t === "tel" || t === "email" || t === "password";
}

function setNativeInputValue(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  set?.call(el, value);
}

export function insertSpecialCharAtFocusedInput(char: string): boolean {
  const el = document.activeElement;
  if (!el || !isTextInput(el)) return false;

  if (el instanceof HTMLInputElement && (el.readOnly || el.disabled)) return false;
  if (el instanceof HTMLTextAreaElement && (el.readOnly || el.disabled)) return false;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const value = el.value;
  const next = value.slice(0, start) + char + value.slice(end);
  setNativeInputValue(el, next);
  const pos = start + char.length;
  el.setSelectionRange(pos, pos);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function isModifierCombo(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

export function tryHandleSpecialCharShortcut(e: KeyboardEvent, bindings: readonly string[]): boolean {
  if (!isModifierCombo(e) || !e.shiftKey || e.altKey) return false;
  const k = e.key;
  if (k.length !== 1 || !/[a-zA-Z]/.test(k)) return false;

  const idx = k.toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
  if (idx < 0 || idx >= bindings.length) return false;

  const ch = bindings[idx];
  if (!ch) return false;

  const ok = insertSpecialCharAtFocusedInput(ch);
  if (ok) {
    e.preventDefault();
    e.stopPropagation();
  }
  return ok;
}
