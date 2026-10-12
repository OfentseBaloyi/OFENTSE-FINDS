import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/cache";
import { clientIp } from "@/lib/server/request";
import { submissionSchema } from "@/lib/submission-schema";
import { createServerSupabase, isMissingTableError } from "@/lib/supabase/client";

// Public business submissions go into `business_submissions` with status "pending".
// They are never visible on the site until an admin approves them (see /admin).
export async function POST(req: NextRequest) {
  const ip = await clientIp();
  if (!rateLimit(`submit:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many submissions from this connection. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors }, { status: 422 });
  }
  const d = parsed.data;
  if (d.company) return NextResponse.json({ ok: true }); // honeypot: pretend success

  const sb = createServerSupabase();
  if (!sb) return NextResponse.json({ error: "Submissions aren't available: the database isn't configured." }, { status: 503 });

  const { data: cat, error: catError } = await sb.from("categories").select("id").eq("slug", d.categorySlug).maybeSingle();
  if (catError) {
    const missing = isMissingTableError(catError);
    if (!missing) console.error("[submissions] category lookup:", catError.message);
    return NextResponse.json(
      { error: missing ? "Business listings open as soon as our database setup is complete. Please check back soon." : "We couldn't save your submission. Please try again." },
      { status: 503 },
    );
  }

  const { error } = await sb.from("business_submissions").insert({
    business_name: d.businessName,
    category_id: cat?.id ?? null,
    category_slug: d.categorySlug,
    town_name: d.townName,
    address: d.address,
    description: d.description,
    contact_number: d.contactNumber ?? null,
    email: d.email ?? null,
    website_url: d.websiteUrl || null,
    opening_hours: d.openingHours,
    image_paths: d.imagePaths,
    is_owner: d.isOwner,
  });

  if (error) {
    console.error("[submissions] insert:", error.message);
    return NextResponse.json({ error: isMissingTableError(error) ? "Business listings open as soon as our database setup is complete." : "We couldn't save your submission. Please try again." }, { status: 503 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
