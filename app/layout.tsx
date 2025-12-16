import type { Metadata, Viewport } from "next";
import { SyncManager } from "@/components/sync-manager";
import { DebugListener } from "@/components/debug-listener";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
          "h-[100dvh] w-screen overflow-hidden bg-background font-sans antialiased text-foreground selection:bg-primary/20",
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
          <Toaster richColors position="bottom-center" visibleToasts={1} toastOptions={{
            className: 'mb-12 shadow-lg border-border/20 rounded-full px-6'
          }} />
          <main className="mx-auto h-full max-w-md flex flex-col relative shadow-2xl bg-background border-x border-border/10">
            <div className="flex-1 overflow-y-auto overscroll-contain p-6 pb-32 scrollbar-hide">
              {children}
            </div>
            <VoiceAgent />
            {/* Invisible Debug Interceptor */}
            <DebugListener />
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
