"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/brand/logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <LogoMark className="h-16 w-16 grayscale" />
      <h1 className="mt-6 text-3xl font-extrabold">Something went off-route.</h1>
      <p className="mt-3 max-w-md text-muted">We hit an unexpected problem loading this page. It&apos;s usually temporary.</p>
      <button type="button" onClick={reset} className="mt-8 rounded-lg bg-teal-800 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-900">
        Try again
      </button>
    </div>
  );
}
