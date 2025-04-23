"use client";
import "./globals.css";
// import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthUserProvider } from "@/lib/auth_handler";

const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "Simplelog",
//   description: "Simplelog is a simple blog.",
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning translate="no">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthUserProvider>{children}</AuthUserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
