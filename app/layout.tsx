import type { Metadata } from "next";
import { SyncManager } from "@/components/sync-manager";
import { Toaster } from 'sonner';
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { VoiceAgent } from "@/components/voice-agent";

const fontSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

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
          fontSans.variable
        )}
      >
        <SyncManager />
        <Toaster richColors position="bottom-center" toastOptions={{
          className: 'mb-12 shadow-lg border-border/20 rounded-full px-6' // Add some custom styling to make it "float" nicely above the bottom nav/mic
        }} />
        <main className="max-w-md mx-auto min-h-screen p-6 relative shadow-2xl bg-background border-x border-border/10 pb-32">
          {/* We limit max-width to mobile size for the 'pwa' feel on desktop too */}
          {children}
          <VoiceAgent />
        </main>
      </body>
    </html>
  );
}
