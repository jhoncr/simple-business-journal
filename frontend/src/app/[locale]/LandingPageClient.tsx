"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  PackagePlus,
  Settings,
  Circle,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/auth_handler";
import { useTranslations } from "next-intl";

const GoogleIcon = () => (
  <div className="flex items-center justify-center w-6 h-6 rounded-full shadow">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
    >
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  </div>
);

export default function LandingPageClient() {
  const { authUser, signInWithGoogle } = useAuth();
  const t = useTranslations("LandingPage");

  const SignInButton = () => (
    <Button
      variant="outline"
      className="bg-primary text-primary-foreground hover:bg-primary-foreground hover:text-primary"
      size="lg"
      onClick={() => signInWithGoogle()}
    >
      <GoogleIcon />
      <span className="ml-2">{t("signInWithGoogle")}</span>
    </Button>
  );
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <header className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl mb-8">
            {t("subtitle")}
          </p>

          <div className="mt-8">
            <Image
              src="/logo.svg"
              alt="Simple Business Journals App Logo"
              width={120}
              height={120}
              className="mx-auto"
            />
          </div>
          <h3 className="text-2xl font-bold mt-8 mb-4">
            {t("tryForFree")}
          </h3>
          <SignInButton />
        </div>
      </header>

      <Separator className="my-6" />

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t("howItWorksTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Circle className="h-6 w-6" />
              <CardTitle>
                <span className="font-bold">{t("step1Title")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t("step1Description")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Circle className="h-6 w-6" />
              <CardTitle>
                <span className="font-bold">{t("step2Title")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t("step2Description")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Circle className="h-6 w-6" />
              <CardTitle>
                <span className="font-bold">{t("step3Title")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t("step3Description")}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t("whyUseTitle")}
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <li className="flex items-center space-x-4">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">{t("benefit1Title")}</h3>
              <p className="text-muted-foreground">
                {t("benefit1Description")}
              </p>
            </div>
          </li>
          <li className="flex items-center space-x-4">
            <CalendarDays className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">{t("benefit2Title")}</h3>
              <p className="text-muted-foreground">
                {t("benefit2Description")}
              </p>
            </div>
          </li>
          <li className="flex items-center space-x-4">
            <Settings className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">{t("benefit3Title")}</h3>
              <p className="text-muted-foreground">
                {t("benefit3Description")}
              </p>
            </div>
          </li>
          <li className="flex items-center space-x-4">
            <PackagePlus className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">{t("benefit4Title")}</h3>
              <p className="text-muted-foreground">
                {t("benefit4Description")}
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* Final CTA */}
      <section className=" py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">
            {t("finalCtaTitle")}
          </h2>

          <SignInButton />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-muted-foreground">
        <p>{t("footerText", { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}
