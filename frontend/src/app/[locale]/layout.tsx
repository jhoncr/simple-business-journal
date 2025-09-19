"use client";
import "../globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthUserProvider } from "@/lib/auth_handler";
import { Toaster } from "@/components/ui/sonner";
import { NextIntlClientProvider, useMessages } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = useMessages();

  return (
    <html lang={locale} suppressHydrationWarning translate="no">
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <header className="container mx-auto px-1 sm:px-6 lg:px-8 py-2 flex justify-end">
              <LocaleSwitcher />
            </header>
            <AuthUserProvider>
              <main className="container mx-auto px-1 sm:px-6 lg:px-8 py-2">
                {children}
              </main>
            </AuthUserProvider>
            <Toaster position="top-center" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
