"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/categories";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, SUBMISSION_IMAGE_BUCKET } from "@/lib/submission-schema";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Defaults = { businessName: string; categorySlug: string; townName: string; address: string };
type Photo = { file: File; preview: string };

const field = "mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

export function SubmissionForm({ defaults, uploadsEnabled }: { defaults: Defaults; uploadsEnabled: boolean }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "sending" | "done">("idle");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_IMAGES) break;
      if (!IMAGE_TYPES.includes(file.type)) {
        setErrors((e) => ({ ...e, imagePaths: "Photos must be JPG, PNG or WebP." }));
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setErrors((e) => ({ ...e, imagePaths: "Each photo must be under 5 MB." }));
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setPhotos(next);
  }

  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return [];
    const sb = getBrowserSupabase();
    if (!sb) throw new Error("Photo uploads are unavailable.");
    const folder = `pending/${crypto.randomUUID()}`;
    const paths: string[] = [];
    for (const [i, p] of photos.entries()) {
      const ext = p.file.type === "image/png" ? "png" : p.file.type === "image/webp" ? "webp" : "jpg";
      const path = `${folder}/photo-${i + 1}.${ext}`;
      const { error } = await sb.storage.from(SUBMISSION_IMAGE_BUCKET).upload(path, p.file, { contentType: p.file.type, upsert: false });
      if (error) throw new Error("A photo failed to upload. Try a smaller image, or submit without photos.");
      paths.push(path);
    }
    return paths;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");

    try {
      setState("uploading");
      const imagePaths = await uploadPhotos();
      setState("sending");
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: get("businessName"),
          categorySlug: get("categorySlug"),
          townName: get("townName"),
          address: get("address"),
          description: get("description"),
          contactNumber: get("contactNumber"),
          email: get("email"),
          websiteUrl: get("websiteUrl"),
          openingHours: get("openingHours"),
          imagePaths,
          isOwner: fd.get("isOwner") === "on",
          consent: fd.get("consent") === "on",
          company: get("company"),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok) {
        setErrors(json.fieldErrors ?? {});
        setFormError(json.error ?? "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError((err as Error).message || "Something went wrong. Please try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="animate-fade-up rounded-2xl border border-emerald/30 bg-emerald-soft/50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald" aria-hidden />
        <h2 className="mt-4 text-2xl font-bold">Thanks, we&apos;ve got it!</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">Your submission is in our review queue. Once someone on our team has checked the details, it&apos;ll appear on the map with a Verified badge.</p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/">Back to home</ButtonLink>
          <button type="button" onClick={() => { setPhotos([]); setState("idle"); }} className="rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-semibold">
            Submit another
          </button>
        </div>
      </div>
    );
  }

  const busy = state === "uploading" || state === "sending";

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-line bg-paper p-5 shadow-card sm:p-8">
      {formError && (
        <div role="alert" className="mb-6 rounded-lg border border-[#b4452b]/30 bg-[#b4452b]/5 px-4 py-3 text-sm text-[#8a3320]">
          {formError}
        </div>
      )}

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={busy}>
        <legend className="mb-1 text-lg font-bold sm:col-span-2">Business details</legend>
        <Field label="Business name" name="businessName" error={errors.businessName} className="sm:col-span-2">
          <input id="businessName" name="businessName" defaultValue={defaults.businessName} required maxLength={120} className={field} autoComplete="organization" />
        </Field>
        <Field label="Category" name="categorySlug" error={errors.categorySlug}>
          <select id="categorySlug" name="categorySlug" defaultValue={defaults.categorySlug} required className={field}>
            <option value="" disabled>
              Choose a category
            </option>
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.slug} label={g.name}>
                {CATEGORIES.filter((c) => c.group === g.slug).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Town or suburb" name="townName" error={errors.townName}>
          <input id="townName" name="townName" defaultValue={defaults.townName} required maxLength={80} placeholder="e.g. Mabopane" className={field} />
        </Field>
        <Field label="Street address or directions" name="address" error={errors.address} className="sm:col-span-2" hint="Be specific — we use this to place you on the map.">
          <input id="address" name="address" defaultValue={defaults.address} required maxLength={200} placeholder="e.g. 1234 Block X, next to the taxi rank" className={field} autoComplete="street-address" />
        </Field>
        <Field label="Description" name="description" error={errors.description} className="sm:col-span-2">
          <textarea id="description" name="description" required minLength={20} maxLength={1000} rows={4} placeholder="What do you offer? What makes you worth the visit?" className={field} />
        </Field>
        <Field label="Opening hours" name="openingHours" error={errors.openingHours} optional className="sm:col-span-2">
          <input id="openingHours" name="openingHours" maxLength={200} placeholder="e.g. Mon–Fri 08:00–17:00, Sat 09:00–14:00" className={field} />
        </Field>
      </fieldset>

      <fieldset className="mt-8 grid gap-5 sm:grid-cols-2" disabled={busy}>
        <legend className="mb-1 text-lg font-bold sm:col-span-2">Contact details</legend>
        <p className="-mt-3 text-sm text-muted sm:col-span-2">These are shown publicly on your listing once it&apos;s approved.</p>
        <Field label="Phone number" name="contactNumber" error={errors.contactNumber} optional>
          <input id="contactNumber" name="contactNumber" type="tel" inputMode="tel" maxLength={20} placeholder="071 234 5678" className={field} autoComplete="tel" />
        </Field>
        <Field label="Email" name="email" error={errors.email} optional>
          <input id="email" name="email" type="email" maxLength={160} className={field} autoComplete="email" />
        </Field>
        <Field label="Website or social page" name="websiteUrl" error={errors.websiteUrl} optional className="sm:col-span-2">
          <input id="websiteUrl" name="websiteUrl" type="url" maxLength={300} placeholder="https://" className={field} autoComplete="url" />
        </Field>
      </fieldset>

      <fieldset className="mt-8" disabled={busy || !uploadsEnabled}>
        <legend className="text-lg font-bold">Photos <span className="text-sm font-normal text-muted">(optional, up to {MAX_IMAGES})</span></legend>
        <p className="mt-1 text-sm text-muted">Real photos of your shopfront, products or work. JPG, PNG or WebP, under 5 MB each.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative h-24 w-24 overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_IMAGES && (
            <button type="button" onClick={() => fileRef.current?.click()} className="grid h-24 w-24 place-items-center rounded-lg border-2 border-dashed border-line text-muted transition hover:border-teal-600 hover:text-teal-700 disabled:opacity-50">
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <ImagePlus className="h-6 w-6" aria-hidden /> Add photo
              </span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        {errors.imagePaths && <p className="mt-2 text-sm text-[#b4452b]">{errors.imagePaths}</p>}
      </fieldset>

      {/* honeypot */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-8 space-y-3 border-t border-line pt-6">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="isOwner" className="mt-0.5 h-4 w-4 accent-teal-700" />
          <span>I own or manage this business</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-teal-700" />
          <span>
            The information is accurate and I&apos;m allowed to share it. I understand it will be reviewed before it&apos;s published.
            {errors.consent && <span className="mt-1 block text-[#b4452b]">{errors.consent}</span>}
          </span>
        </label>
      </div>

      <button type="submit" disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-4 text-base font-bold text-teal-950 transition hover:bg-[#f39a33] disabled:opacity-70 sm:w-auto">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {state === "uploading" ? "Uploading photos…" : state === "sending" ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}

function Field({ label, name, error, hint, optional, className, children }: { label: string; name: string; error?: string; hint?: string; optional?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(className)}>
      <label htmlFor={name} className="text-sm font-semibold text-ink">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-sm text-[#b4452b]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
