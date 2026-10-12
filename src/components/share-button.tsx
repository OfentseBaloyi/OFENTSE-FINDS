"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} · OFENTSE-FINDS`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  }
  return (
    <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-semibold hover:border-ink/30">
      {copied ? <Check className="h-4 w-4 text-emerald" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
