import { AddIpForm } from "@/components/add-ip-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

export default async function IpAllowlistPage() {
  const rows = await prisma.allowedIp.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IP 허용 목록</h1>
        <p className="text-muted-foreground">
          DB에 저장된 규칙과 환경변수 <code className="rounded bg-muted px-1 py-0.5">ALLOWED_IPS</code>를 함께
          사용합니다. CIDR 정확 매칭은 후속 단계에서 보강합니다.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>등록된 IP 규칙</CardTitle>
          <CardDescription>아래 폼으로 추가합니다. 삭제·권한 분리는 이후 단계에서 보강합니다.</CardDescription>
        </CardHeader>
        <CardContent className="border-b pb-6">
          <AddIpForm />
        </CardContent>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>규칙 (CIDR 또는 단일 IP)</TableHead>
                <TableHead>메모</TableHead>
                <TableHead className="text-right">등록일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    아직 등록된 규칙이 없습니다. 개발 모드에서는 비어 있어도 접근이 허용됩니다.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.cidr}</TableCell>
                    <TableCell>{r.note ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.createdAt.toISOString().slice(0, 10)}
                    </TableCell>
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
