// frontend/src/app/page.tsx (Landing Page)
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
export default function LandingPage() {
  const { authUser, signInWithGoogle } = useAuth();

  const SignInButton = () => (
    <Button
      variant="outline"
      className="bg-primary text-primary-foreground hover:bg-primary-foreground hover:text-primary"
      size="lg"
      onClick={() => signInWithGoogle()}
    >
      <GoogleIcon />
      <span className="ml-2">Sign in with Google</span>
    </Button>
  );
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <header className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Create Professional Quotes in Minutes
          </h1>
          <p className="text-lg md:text-xl mb-8">
            Simple Quotes helps you generate, customize, and print/share
            business quotes effortlessly.
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
            Try it for free today!
          </h3>
          <SignInButton />
        </div>
      </header>

      <Separator className="my-6" />

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Creating Quotes is as Easy as 1-2-3
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Circle className="h-6 w-6" />
              <CardTitle>
                <span className="font-bold">1. Add Items</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Quickly add items to your quote, from your inventory or create
                new ones on the fly.c cashflow entriss, inventrory, quotes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Circle className="h-6 w-6" />
              <CardTitle>
                <span className="font-bold">2. Customize</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Set prices, add discounts, include taxes, and personalize with
                your company logo and contact information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Circle className="h-6 w-6" />
              <CardTitle>
                <span className="font-bold">3. Print or Share</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Generate a professional PDF quote to print, or share directly
                with your client via a unique link.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why Use Simple Business Journals?
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <li className="flex items-center space-x-4">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">Stay Organized</h3>
              <p className="text-muted-foreground">
                Stop wasting time with spreadsheets. Create quotes in a
                fraction of the time.
              </p>
            </div>
          </li>
          <li className="flex items-center space-x-4">
            <CalendarDays className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">Look Professional</h3>
              <p className="text-muted-foreground">
                Impress clients with polished, branded quotes.
              </p>
            </div>
          </li>
          <li className="flex items-center space-x-4">
            <Settings className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">Easy to Use</h3>
              <p className="text-muted-foreground">
                No complicated software to learn. Get started instantly.
              </p>
            </div>
          </li>
          <li className="flex items-center space-x-4">
            <PackagePlus className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">Inventory</h3>
              <p className="text-muted-foreground">
                Keep track of your inventory and prices
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* Final CTA */}
      <section className=" py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">
            Sign up now and start creating professional quotes in minutes!{" "}
          </h2>

          <SignInButton />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-muted-foreground">
        <p>Simple Business Journals © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
