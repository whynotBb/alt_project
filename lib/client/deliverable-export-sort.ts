/**
 * 산출물 보내기 시 행·파일 정렬 기준 (ALT 작성 화면)
 */

export type DeliverableExportSortKind =
  | "daldal"
  | "customer_reply"
  | "bluebottle"
  | "culture_more"
  | "filename";

export const DELIVERABLE_EXPORT_SORT_OPTIONS: ReadonlyArray<{
  kind: DeliverableExportSortKind;
  label: string;
}> = [
  { kind: "daldal", label: "달달혜택" },
  { kind: "customer_reply", label: "고객보답" },
  { kind: "bluebottle", label: "블루보틀" },
  { kind: "culture_more", label: "컬처앤모어" },
  { kind: "filename", label: "파일명" },
];

function normPath(path: string): string {
  return path.replace(/\\/g, "/").trim();
}

function basenameKey(path: string): string {
  const n = normPath(path);
  const seg = n.split("/").pop() ?? n;
  return seg;
}

function daldalHtmlRank(path: string): number {
  const base = basenameKey(path).toLowerCase();
  if (base.includes("daldal_app")) return 99;
  if (base.startsWith("daldal_web")) return 0;
  if (base.startsWith("daldal_m")) return 1;
  if (base.startsWith("choice")) return 2;
  if (base.startsWith("special_")) return 3;
  return 4;
}

export function shouldUseHtmlAssetForDeliverableExport(path: string, kind: DeliverableExportSortKind): boolean {
  if (kind !== "daldal") return true;
  const base = basenameKey(path).toLowerCase();
  return !base.includes("daldal_app");
}

/** 선택한 종류에 해당하는 경로면 정렬 시 앞쪽으로 모읍니다. (`filename` 제외) */
export function pathMatchesDeliverableSortKind(path: string, kind: DeliverableExportSortKind): boolean {
  const p = normPath(path).toLowerCase();
  switch (kind) {
    case "daldal":
      return p.includes("달달") || p.includes("daldal");
    case "customer_reply":
      return p.includes("고객보답") || p.includes("gokam") || p.includes("customer_reply");
    case "bluebottle":
      return p.includes("블루보틀") || p.includes("bluebottle") || p.includes("blue-bottle") || p.includes("blue_bottle");
    case "culture_more":
      return (
        p.includes("컬처앤모어") ||
        p.includes("culture") ||
        p.includes("앤모어") ||
        p.includes("andmore") ||
        p.includes("and_more")
      );
    case "filename":
      return false;
    default:
      return false;
  }
}

export function sortItemsForDeliverableExport<T extends { name: string }>(items: T[], kind: DeliverableExportSortKind): T[] {
  if (kind === "daldal") {
    return [...items].sort((a, b) => {
      const ra = daldalHtmlRank(a.name);
      const rb = daldalHtmlRank(b.name);
      if (ra !== rb) return ra - rb;
      return normPath(a.name).localeCompare(normPath(b.name), "ko");
    });
  }
  if (kind === "filename") {
    return [...items].sort((a, b) => {
      const c = basenameKey(a.name).localeCompare(basenameKey(b.name), "ko");
      return c !== 0 ? c : normPath(a.name).localeCompare(normPath(b.name), "ko");
    });
  }
  return [...items].sort((a, b) => {
    const ma = pathMatchesDeliverableSortKind(a.name, kind);
    const mb = pathMatchesDeliverableSortKind(b.name, kind);
    if (ma !== mb) return ma ? -1 : 1;
    return normPath(a.name).localeCompare(normPath(b.name), "ko");
  });
}

export type DeliverableSortableRow = {
  name: string;
  pathLabel?: string;
};

export function sortDeliverableExcelRows<R extends DeliverableSortableRow>(rows: R[], kind: DeliverableExportSortKind): R[] {
  const labelOf = (r: R) => r.pathLabel ?? r.name;
  if (kind === "filename") {
    return [...rows].sort((a, b) => {
      const c = basenameKey(labelOf(a)).localeCompare(basenameKey(labelOf(b)), "ko");
      return c !== 0 ? c : normPath(a.name).localeCompare(normPath(b.name), "ko");
    });
  }
  return [...rows].sort((a, b) => {
    const la = labelOf(a);
    const lb = labelOf(b);
    const ma = pathMatchesDeliverableSortKind(a.name, kind) || pathMatchesDeliverableSortKind(la, kind);
    const mb = pathMatchesDeliverableSortKind(b.name, kind) || pathMatchesDeliverableSortKind(lb, kind);
    if (ma !== mb) return ma ? -1 : 1;
    return normPath(a.name).localeCompare(normPath(b.name), "ko");
  });
}
