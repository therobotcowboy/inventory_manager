import type { Metadata } from "next";
import { SyncManager } from "@/components/sync-manager";
import { ThemeProvider } from "@/components/theme-provider";
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased text-foreground",
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SyncManager />
          <Toaster richColors position="bottom-center" toastOptions={{
            className: 'mb-12 shadow-lg border-border/20 rounded-full px-6'
          }} />
          <main className="max-w-md mx-auto min-h-screen p-6 relative shadow-2xl bg-background border-x border-border/10 pb-32">
            {children}
            <VoiceAgent />
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
