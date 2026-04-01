"use client";

import { useState } from "react";
import { addAllowedIp } from "@/actions/ip-allowlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddIpForm() {
  const [cidr, setCidr] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await addAllowedIp(cidr, note);
    if (!res.ok) {
      setMessage(res.error ?? "저장 실패");
      return;
    }
    setCidr("");
    setNote("");
    setMessage("저장했습니다.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="cidr">IP 또는 CIDR</Label>
          <Input
            id="cidr"
            name="cidr"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="203.0.113.10 또는 10.0.0.0/24"
            required
          />
        </div>
        <div className="grid flex-1 gap-2">
          <Label htmlFor="note">메모 (선택)</Label>
          <Input id="note" name="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="submit">추가</Button>
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
