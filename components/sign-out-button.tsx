"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut className="mr-1 size-4" aria-hidden />
      로그아웃
    </Button>
  );
}
