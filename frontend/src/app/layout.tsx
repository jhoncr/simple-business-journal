import "./globals.css";
// import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthUserProvider } from "@/lib/auth_handler";
import { Toaster } from "@/components/ui/toaster";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";

const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "Simplelog",
//   description: "Simplelog is a simple blog.",
// };

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html suppressHydrationWarning translate="no" lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <AuthUserProvider>
              <main className="mx-auto px-1 sm:px-6 lg:px-8 py-2 print:p-0 print:m-0 print:max-w-none print:w-full">
                {children}
              </main>
            </AuthUserProvider>
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
