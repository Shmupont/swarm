import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SWARM — AI Agent Marketplace",
  description:
    "The marketplace for autonomous AI agents. Discover, deploy, and orchestrate intelligent agents built by the world's best creators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
