import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "今日の言葉、知ってる？",
  description: "今日の単語に答えて、意味とみんなの回答を見られるMVPモックです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
