"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    const res = await signIn("email", { email, redirect: false });
    if (res?.error) {
      setStatus("error");
      setMessage("로그인 요청에 실패했습니다. 이메일 도메인·IP를 확인하세요.");
      return;
    }
    setStatus("sent");
    setMessage("메일함을 확인하세요. (개발: 서버 콘솔에 링크가 출력될 수 있습니다)");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left">
      <div className="space-y-2">
        <Label htmlFor="email">회사 이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "전송 중…" : "매직 링크 받기"}
      </Button>
      {message ? (
        <p
          className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
