import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSessionProvider } from "@/components/providers/session-provider";

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Alt-Text Helper",
	description: "이미지·ZIP 기반 대체텍스트 작성 및 검수 도구",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
			<body className="flex min-h-full flex-col">
				<AppSessionProvider>{children}</AppSessionProvider>
			</body>
		</html>
	);
}
