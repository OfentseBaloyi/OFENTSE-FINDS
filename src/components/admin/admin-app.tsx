"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { Check, Loader2, LogOut, MapPin, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { EmptyState, Notice } from "@/components/ui";
import { getCategory } from "@/lib/categories";
import { SUBMISSION_IMAGE_BUCKET } from "@/lib/submission-schema";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PinPicker = dynamic(() => import("@/components/admin/pin-picker"), { ssr: false, loading: () => <div className="skeleton h-64" /> });

type Submission = {
  id: string;
  business_name: string;
  category_id: string | null;
  category_slug: string | null;
  town_name: string;
  address: string;
  description: string;
  contact_number: string | null;
  email: string | null;
  website_url: string | null;
  opening_hours: string | null;
  image_paths: string[];
  is_owner: boolean;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
};
type TownRow = { id: string; name: string; slug: string; latitude: number; longitude: number };
type CategoryRow = { id: string; slug: string; name: string; parent_id: string | null };

export function AdminApp() {
  const sb = useMemo(() => getBrowserSupabase(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!sb) {
      setReady(true);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!sb || !session) {
      setIsAdmin(null);
      return;
    }
    sb.rpc("is_admin").then(({ data, error }) => setIsAdmin(error ? false : Boolean(data)));
  }, [sb, session]);

  if (!sb) return <Notice tone="warn">Supabase isn&apos;t configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.</Notice>;
  if (!ready) return <div className="skeleton h-40" />;
  if (!session) return <SignIn sb={sb} />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="mt-1 text-3xl font-extrabold">Submissions</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="truncate">{session.user.email}</span>
          <button type="button" onClick={() => sb.auth.signOut()} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 font-semibold text-ink">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
      {isAdmin === null ? (
        <div className="skeleton mt-6 h-40" />
      ) : !isAdmin ? (
        <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="This account isn't an admin" className="mt-8">
          <p>Ask the project owner to run this in the Supabase SQL Editor:</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-night p-3 text-left text-xs text-mint">
            {`insert into public.admin_users (user_id)\nselect id from auth.users where email = '${session.user.email}';`}
          </pre>
        </EmptyState>
      ) : (
        <Queue sb={sb} />
      )}
    </div>
  );
}

function SignIn({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/admin`, shouldCreateUser: false } });
    if (error) {
      setError(error.message);
      setState("idle");
    } else setState("sent");
  }
  return (
    <div className="mx-auto max-w-md py-10">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-3xl font-extrabold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">We&apos;ll email you a one-time sign-in link. Only existing team accounts can sign in.</p>
      {state === "sent" ? (
        <Notice className="mt-6">Check {email} for your sign-in link.</Notice>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label htmlFor="admin-email" className="text-sm font-semibold">Email</label>
          <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3.5 py-3 outline-none focus:border-teal-600" />
          {error && <p className="text-sm text-[#b4452b]">{error}</p>}
          <button disabled={state === "sending"} className="w-full rounded-lg bg-teal-800 py-3 font-semibold text-white disabled:opacity-60">
            {state === "sending" ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </div>
  );
}

function Queue({ sb }: { sb: SupabaseClient }) {
  const [status, setStatus] = useState<Submission["status"]>("pending");
  const [items, setItems] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [towns, setTowns] = useState<TownRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    const { data, error } = await sb.from("business_submissions").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100);
    if (error) setError(error.message);
    else setItems(data as Submission[]);
  }, [sb, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    sb.from("towns").select("id,name,slug,latitude,longitude").order("name").then(({ data }) => setTowns((data as TownRow[]) ?? []));
    sb.from("categories").select("id,slug,name,parent_id").order("sort_order").then(({ data }) => setCategories((data as CategoryRow[]) ?? []));
  }, [sb]);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-full px-4 py-2 text-sm font-semibold capitalize", status === s ? "bg-ink text-white" : "bg-sand text-ink-2")}>
            {s}
          </button>
        ))}
        <button type="button" onClick={load} aria-label="Refresh" className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-sand">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {error && <Notice tone="warn" className="mt-4">{error}</Notice>}
      {items === null && !error ? (
        <div className="mt-4 space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      ) : items?.length === 0 ? (
        <EmptyState title={`No ${status} submissions`} className="mt-6" />
      ) : (
        <ul className="mt-4 space-y-4">
          {items?.map((s) => (
            <SubmissionCard key={s.id} sb={sb} s={s} towns={towns} categories={categories.filter((c) => c.parent_id)} onDone={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmissionCard({ sb, s, towns, categories, onDone }: { sb: SupabaseClient; s: Submission; towns: TownRow[]; categories: CategoryRow[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const guessTown = towns.find((t) => t.name.toLowerCase() === s.town_name.trim().toLowerCase());
  const [townId, setTownId] = useState(guessTown?.id ?? "");
  const [categoryId, setCategoryId] = useState(s.category_id ?? categories.find((c) => c.slug === s.category_slug)?.id ?? "");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"geo" | "approve" | "reject" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const town = towns.find((t) => t.id === townId);

  useEffect(() => {
    if (!open || s.image_paths.length === 0) return;
    sb.storage.from(SUBMISSION_IMAGE_BUCKET).createSignedUrls(s.image_paths, 600).then(({ data }) => setImages((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]));
  }, [open, sb, s.image_paths]);

  async function findAddress() {
    setBusy("geo");
    setMsg(null);
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(`${s.address}, ${s.town_name}`)}`);
    const json = await res.json();
    if (res.ok) setPin({ lat: json.latitude, lng: json.longitude });
    else setMsg(json.error ?? "No match — click the map to place the pin.");
    setBusy(null);
  }

  async function approve() {
    if (!pin || !townId || !categoryId) {
      setMsg("Choose a town and category, and confirm the pin on the map.");
      return;
    }
    setBusy("approve");
    setMsg(null);
    let imageUrl: string | null = null;
    if (usePhoto && s.image_paths[0]) {
      const { data: blob } = await sb.storage.from(SUBMISSION_IMAGE_BUCKET).download(s.image_paths[0]);
      if (blob) {
        const ext = s.image_paths[0].split(".").pop();
        const path = `${s.id}/cover.${ext}`;
        const up = await sb.storage.from("business-images").upload(path, blob, { contentType: blob.type, upsert: false });
        if (!up.error) imageUrl = sb.storage.from("business-images").getPublicUrl(path).data.publicUrl;
      }
    }
    const { error } = await sb.rpc("approve_submission", {
      p_submission_id: s.id, p_town_id: townId, p_category_id: categoryId, p_latitude: pin.lat, p_longitude: pin.lng,
      p_image_url: imageUrl, p_notes: notes || null,
    });
    setBusy(null);
    if (error) setMsg(error.message);
    else onDone();
  }

  async function reject() {
    setBusy("reject");
    const { error } = await sb.rpc("reject_submission", { p_submission_id: s.id, p_notes: notes || null });
    setBusy(null);
    if (error) setMsg(error.message);
    else onDone();
  }

  return (
    <li className="rounded-xl border border-line bg-paper">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-4 p-4 text-left" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-teal-700">
            {getCategory(s.category_slug)?.name ?? "Uncategorised"} · {s.town_name}
            {s.is_owner && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-[10px] uppercase text-ink-2">Owner</span>}
          </p>
          <p className="mt-0.5 font-display text-lg font-bold">{s.business_name}</p>
          <p className="truncate text-sm text-muted">{s.address}</p>
        </div>
        <time className="shrink-0 text-xs text-muted" dateTime={s.created_at}>{new Date(s.created_at).toLocaleDateString("en-ZA")}</time>
      </button>
      {open && (
        <div className="grid gap-6 border-t border-line p-4 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-line text-ink-2">{s.description}</p>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
              {s.contact_number && <><dt className="text-muted">Phone</dt><dd>{s.contact_number}</dd></>}
              {s.email && <><dt className="text-muted">Email</dt><dd className="break-all">{s.email}</dd></>}
              {s.website_url && <><dt className="text-muted">Website</dt><dd className="break-all"><a href={s.website_url} target="_blank" rel="noopener noreferrer nofollow" className="text-teal-700 underline">{s.website_url}</a></dd></>}
              {s.opening_hours && <><dt className="text-muted">Hours</dt><dd>{s.opening_hours}</dd></>}
              {s.review_notes && <><dt className="text-muted">Notes</dt><dd>{s.review_notes}</dd></>}
            </dl>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URLs
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="" className="h-24 w-24 rounded-lg object-cover" /></a>
                ))}
              </div>
            )}
          </div>

          {s.status === "pending" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">
                  Town
                  <select value={townId} onChange={(e) => setTownId(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-2 text-sm">
                    <option value="">Choose…</option>
                    {towns.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Category
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-2 text-sm">
                    <option value="">Choose…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={findAddress} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold">
                  {busy === "geo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find address
                </button>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <MapPin className="h-3.5 w-3.5" />
                  {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Click the map to place the pin"}
                </span>
              </div>
              <PinPicker value={pin} center={town ? { lat: town.latitude, lng: town.longitude } : { lat: -25.75, lng: 28.19 }} onChange={setPin} />
              {s.image_paths.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} className="accent-teal-700" /> Publish first photo as the listing image
                </label>
              )}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review notes (internal)" rows={2} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
              {msg && <p className="text-sm text-[#b4452b]">{msg}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={approve} disabled={busy !== null} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-800 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve &amp; verify
                </button>
                <button type="button" onClick={reject} disabled={busy !== null} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                  {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
