import Link from "next/link";
import { Eye, FileSpreadsheet, GitCompare, Images, Upload } from "lucide-react";
import { auth } from "@/auth";
import { ShortcutSpecialCharMenu } from "@/components/shortcut-special-char-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const links = [
	{ href: "/", label: "ALT 작성", icon: Upload },
	{ href: "/inspection", label: "ALT 검수", icon: Eye },
	// { href: "/comparator", label: "텍스트 대조", icon: GitCompare },
	{ href: "/image-compare", label: "이미지 대조", icon: Images },
	// { href: "/admin/ip-allowlist", label: "IP 관리", icon: Shield },
	// { href: "/admin/audit-logs", label: "활동 로그", icon: LayoutDashboard },
] as const;

type SiteHeaderProps = {
	tutorialHref?: string;
};

export async function SiteHeader({ tutorialHref = "/?tutorial=1" }: SiteHeaderProps) {
	const session = await auth();

	return (
		<header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md">
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
				<Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
					<span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
						<FileSpreadsheet className="size-5" aria-hidden />
					</span>
					<span className="leading-tight">Alt-Text Helper</span>
				</Link>
				<div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
					<nav aria-label="주요 메뉴" className="flex flex-wrap gap-0.5 sm:gap-1">
						{links.map(({ href, label, icon: Icon }) => (
							<Link key={href} href={href} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary sm:px-3">
								<Icon className="size-4 shrink-0 opacity-80" aria-hidden />
								<span className="hidden sm:inline">{label}</span>
							</Link>
						))}
						<ShortcutSpecialCharMenu />
					</nav>
					<div className="mx-0.5 hidden h-6 w-px bg-border sm:block" aria-hidden />
					<ThemeToggle />
					<Link href={tutorialHref} className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 tracking-wide no-underline")}>
						TUTORIAL
					</Link>
					{session?.user ? (
						<SignOutButton />
					) : (
						<Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 no-underline")}>
							로그인
						</Link>
					)}
				</div>
			</div>
		</header>
	);
}
