import { notFound } from "next/navigation";
import React from "react";
import { RectangleViewer, RectangleData } from "@/components/RectangleViewer";
import { RectangleInputForm } from "@/components/RectangleInputForm";

export default function WipPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-8">Work In Progress Component Testing</h1>
      <div className="w-full max-w-4xl p-6 border rounded-lg shadow-sm bg-card text-card-foreground">
        <p className="text-muted-foreground text-center mb-8">
          Render your components here for testing. This page is only accessible in development mode.
        </p>

        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Rectangle Input Form</h2>
          <RectangleInputForm />
        </div>
      </div>
    </div>
  );
}
