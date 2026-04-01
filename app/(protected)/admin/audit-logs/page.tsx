import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

export default async function AuditLogsPage() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">검수 로그</h1>
        <p className="text-muted-foreground">
          누가 언제 몇 개 파일을 검수했는지 기록합니다. 기록은 Server Action에서{" "}
          <code className="rounded bg-muted px-1 py-0.5">AuditLog</code>에 쌓도록 연결할 예정입니다.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>최근 100건</CardTitle>
          <CardDescription>스키마는 준비됨 — 파이프라인 완료 시 insert 연동</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>시각 (UTC)</TableHead>
                <TableHead>사용자</TableHead>
                <TableHead>동작</TableHead>
                <TableHead className="text-right">파일 수</TableHead>
                <TableHead>클라이언트 IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    아직 로그가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {r.createdAt.toISOString()}
                    </TableCell>
                    <TableCell>{r.user?.email ?? "—"}</TableCell>
                    <TableCell>{r.action}</TableCell>
                    <TableCell className="text-right">{r.fileCount}</TableCell>
                    <TableCell className="font-mono text-sm">{r.clientIp}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
