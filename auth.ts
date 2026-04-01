import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createTransport } from "nodemailer";
import { prisma } from "@/lib/db/prisma";
import { isOpenAccessDev } from "@/lib/dev-access";

const allowedEmailDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  providers: [
    {
      id: "email",
      type: "email" as const,
      name: "Email",
      from: process.env.EMAIL_FROM ?? "Alt 검수 <noreply@localhost>",
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest(params) {
        const { identifier, url } = params;
        if (process.env.SMTP_HOST) {
          const transport = createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
              user: process.env.SMTP_USER ?? "",
              pass: process.env.SMTP_PASSWORD ?? "",
            },
          });
          await transport.sendMail({
            to: identifier,
            from: process.env.EMAIL_FROM,
            subject: "로그인 링크",
            text: `아래 링크로 로그인하세요.\n\n${url}`,
          });
          return;
        }
        console.warn(`[auth] SMTP 미설정 — 개발용 링크 (${identifier}): ${url}`);
      },
    },
  ],
  trustHost: true,
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async signIn({ user }) {
      if (isOpenAccessDev()) {
        return true;
      }
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const domain = email.split("@")[1];
      if (!domain) return false;
      if (allowedEmailDomains.length === 0) {
        console.warn("[auth] ALLOWED_EMAIL_DOMAINS 미설정 — 개발 모드로 도메인 검사 생략");
        return true;
      }
      return allowedEmailDomains.includes(domain);
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
