import type { Metadata } from "next";
import { SyncManager } from "@/components/sync-manager";
import { Toaster } from 'sonner';
import { Inter } from "next/font/google"; // Industrial standard
import "./globals.css";
import { cn } from "@/lib/utils";
import { VoiceAgent } from "@/components/voice-agent";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Joe's Tool & Part Assistant",
  description: "AI-powered inventory management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      {/* Forcing .dark class here for the Industrial Dark Mode preference */}
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased text-foreground",
          inter.className
        )}
      >
        <SyncManager />
        <Toaster richColors position="top-center" />
        <main className="max-w-md mx-auto min-h-screen p-6 relative shadow-2xl bg-background border-x border-border/10 pb-32">
          {/* We limit max-width to mobile size for the 'pwa' feel on desktop too */}
          {children}
          <VoiceAgent />
        </main>
      </body>
    </html>
  );
}
