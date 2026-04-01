import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
          <p className="text-sm text-muted-foreground">
            회사 이메일로 매직 링크를 받습니다. 허용된 IP에서만 접속할 수 있습니다.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
