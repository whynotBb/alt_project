import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">접근이 제한되었습니다</h1>
      <p className="max-w-md text-muted-foreground">
        허용된 IP가 아니거나 관리자가 등록한 규칙과 일치하지 않습니다. 네트워크 담당자에게 문의하세요.
      </p>
      <Link
        href="/login"
        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        로그인 화면으로
      </Link>
    </div>
  );
}
