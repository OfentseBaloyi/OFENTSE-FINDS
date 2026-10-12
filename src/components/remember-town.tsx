"use client";

import { useEffect } from "react";
import { rememberTown } from "@/lib/client-store";

export function RememberTown({ slug, name }: { slug: string; name: string }) {
  useEffect(() => rememberTown({ slug, name }), [slug, name]);
  return null;
}
