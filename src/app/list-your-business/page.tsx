import type { Metadata } from "next";
import { BadgeCheck, ClipboardCheck, MapPinned, ShieldCheck } from "lucide-react";
import { SubmissionForm } from "@/components/submission-form";
import { Notice } from "@/components/ui";
import { getDbStatus } from "@/lib/db";

export const metadata: Metadata = {
  title: "List your business",
  description: "Add your business to OFENTSE-FINDS for free. Every listing is reviewed before it goes live.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ListYourBusinessPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = await getDbStatus();

  return (
    <div className="container-page pt-10 sm:pt-14">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">List your business</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">Get found by the people around you.</h1>
          <p className="mt-4 text-muted">Free for local businesses. Tell us the basics; we&apos;ll check them and put you on the map.</p>
          <ol className="mt-8 space-y-5">
            {[
              [ClipboardCheck, "Tell us about your business", "Name, category, where you are and how to reach you."],
              [ShieldCheck, "We review it", "A person on our team checks every submission. Nothing is published automatically."],
              [MapPinned, "You go live", "Approved listings appear on town maps and in search."],
              [BadgeCheck, "Verified badge", "Approved listings carry a Verified badge so customers know they're real."],
            ].map(([IconC, title, text], i) => {
              const I = IconC as typeof ClipboardCheck;
              return (
                <li key={i} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700">
                    <I className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold">{title as string}</p>
                    <p className="text-sm text-muted">{text as string}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          {status !== "ok" && (
            <Notice tone="warn" className="mb-5">
              {status === "not_migrated"
                ? "Heads up: our listings database is still being set up, so submissions can't be saved yet. Please check back soon."
                : status === "unconfigured"
                  ? "Submissions are disabled because the database isn't configured."
                  : "We can't reach our database right now, so your submission may not save. Please try again shortly."}
            </Notice>
          )}
          <SubmissionForm
            defaults={{
              businessName: sp.name?.slice(0, 120) ?? "",
              categorySlug: sp.category?.slice(0, 60) ?? "",
              townName: sp.town?.slice(0, 80) ?? "",
              address: sp.address?.slice(0, 200) ?? "",
            }}
            uploadsEnabled={status === "ok"}
          />
        </div>
      </div>
    </div>
  );
}
