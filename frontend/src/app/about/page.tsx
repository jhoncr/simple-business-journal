'use client'  
import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function About() {
  

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen m-4">
        <h1 className="text-4xl font-bold">About SimpleJ</h1>

        <p className="mt-3 text-2xl">
          SimpleJ is a simple daily logging app
        </p>

        <Link href="/" className="mt-8">
          <Button className="px-4 py-2 text-white bg-blue-500 rounded-md">
            Try it 
          </Button>
        </Link>

      </main>
      <footer className="flex items-center justify-center w-full h-24 border-t">
        <h2>
          {" "}
          Made with ❤️ by <a href="https://twitter.com/J3Cordeiro">Jhon</a>
        </h2>
      </footer>
    </>
  );
}
