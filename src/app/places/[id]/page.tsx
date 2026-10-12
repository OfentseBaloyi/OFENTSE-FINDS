import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, ExternalLink, Globe, Mail, MapPin, Navigation, Pencil, Phone, Store } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { FavouriteButton } from "@/components/favourite-button";
import { OpenBadge } from "@/components/open-badge";
import { PlaceImage } from "@/components/place-image";
import { PlaceMiniMap } from "@/components/place-mini-map";
import { ShareButton } from "@/components/share-button";
import { WeeklyHours } from "@/components/weekly-hours";
import { VerifiedBadge } from "@/components/ui";
import { getCategory, groupOfCategory } from "@/lib/categories";
import { directionsUrl } from "@/lib/geo";
import { getPlaceById } from "@/lib/places";
import { getNearestTown } from "@/lib/towns";
import { displayHost } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^(osm-[nwr]\d{1,15}|sb-[0-9a-f-]{36})$/i.test(id)) return null;
  return getPlaceById(id).catch(() => undefined);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await load((await params).id);
  if (!place) return { title: "Place" };
  const cat = getCategory(place.categorySlug)?.name ?? "Place";
  return { title: place.name, description: `${cat}${place.address ? ` at ${place.address}` : ""} — on OFENTSE-FINDS.` };
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params;
  const place = await load(id);
  if (place === null) notFound();
  if (place === undefined) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold">This place is temporarily unavailable</h1>
        <p className="mt-2 text-muted">Our map data source is busy. Please refresh in a minute.</p>
      </div>
    );
  }

  const category = getCategory(place.categorySlug);
  const group = groupOfCategory(place.categorySlug);
  const town = await getNearestTown(place.latitude, place.longitude);
  const townCrumb = town && town.distanceKm < 15 ? town : null;
  const tel = place.phone?.split(/[;,]/)[0]?.trim();

  return (
    <div className="container-page pt-6 sm:pt-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        {townCrumb ? (
          <>
            <Link href={`/towns/${townCrumb.slug}`} className="hover:text-ink">{townCrumb.name}</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            {category && (
              <>
                <Link href={`/towns/${townCrumb.slug}?category=${category.slug}#explore`} className="hover:text-ink">{category.name}</Link>
                <ChevronRight className="h-3 w-3" aria-hidden />
              </>
            )}
          </>
        ) : null}
        <span className="text-ink">{place.name}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        {/* ── Main ──────────────────────────────────────────── */}
        <div className="min-w-0">
          <PlaceImage src={place.imageUrl} categorySlug={place.categorySlug} alt={place.name} className="aspect-[16/9] w-full rounded-2xl" iconClassName="h-14 w-14" showLabel />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${group?.color ?? "#0F6560"}18`, color: group?.color ?? "#0F6560" }}>
              <CategoryIcon slug={place.categorySlug} className="h-3.5 w-3.5" />
              {category?.name ?? "Place"}
            </span>
            {place.verified && <VerifiedBadge />}
            {place.cuisine && <span className="text-sm capitalize text-muted">{place.cuisine}</span>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-[2.6rem]">{place.name}</h1>
          {place.address && (
            <p className="mt-2 flex items-start gap-1.5 text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {place.address}
            </p>
          )}
          <OpenBadge hours={place.openingHours} className="mt-3 text-sm" />

          <div className="mt-6 flex flex-wrap gap-2">
            <a href={directionsUrl(place.latitude, place.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900">
              <Navigation className="h-4 w-4" aria-hidden /> Directions
            </a>
            {tel && (
              <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-semibold hover:border-ink/30">
                <Phone className="h-4 w-4" aria-hidden /> Call
              </a>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-semibold hover:border-ink/30">
                <Globe className="h-4 w-4" aria-hidden /> Website
              </a>
            )}
            <FavouriteButton place={place} variant="button" />
            <ShareButton title={place.name} />
          </div>

          {place.description && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">About</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-2">{place.description}</p>
            </section>
          )}

          <section className="mt-8 rounded-xl border border-line bg-paper p-5">
            <h2 className="text-lg font-bold">Is this your business?</h2>
            <p className="mt-1 text-sm text-muted">
              {place.verified
                ? "This listing has been verified. To update it, send us the changes and we'll review them."
                : "Claim this place to add photos, hours and contact details, and earn a Verified badge once we've checked it."}
            </p>
            <Link
              href={`/list-your-business?name=${encodeURIComponent(place.name)}${category ? `&category=${category.slug}` : ""}${townCrumb ? `&town=${encodeURIComponent(townCrumb.name)}` : ""}${place.address ? `&address=${encodeURIComponent(place.address)}` : ""}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline"
            >
              <Store className="h-4 w-4" aria-hidden /> {place.verified ? "Suggest an update" : "Claim this listing"}
            </Link>
          </section>
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-line">
            <PlaceMiniMap place={place} />
          </div>

          <div className="rounded-xl border border-line bg-paper p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Clock className="h-4 w-4 text-teal-700" aria-hidden /> Opening hours
            </h2>
            {place.openingHours ? <WeeklyHours hours={place.openingHours} /> : <p className="mt-2 text-sm text-muted">Not published yet. Call ahead before you go.</p>}
          </div>

          <dl className="space-y-3 rounded-xl border border-line bg-paper p-5 text-sm">
            {place.phone && <Detail icon={<Phone className="h-4 w-4" />} label="Phone">{place.phone}</Detail>}
            {place.email && (
              <Detail icon={<Mail className="h-4 w-4" />} label="Email">
                <a href={`mailto:${place.email}`} className="text-teal-700 hover:underline">{place.email}</a>
              </Detail>
            )}
            {place.website && (
              <Detail icon={<Globe className="h-4 w-4" />} label="Website">
                <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" className="text-teal-700 hover:underline">{displayHost(place.website)}</a>
              </Detail>
            )}
            <Detail icon={<MapPin className="h-4 w-4" />} label="Coordinates">
              {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
            </Detail>
          </dl>

          <p className="text-xs leading-relaxed text-muted">
            {place.source === "osm" ? (
              <>
                Information from{" "}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a>. It may be out of date.{" "}
                {place.sourceUrl && (
                  <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-teal-700 hover:underline">
                    <Pencil className="h-3 w-3" aria-hidden /> Fix it on OpenStreetMap <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </>
            ) : place.verified ? (
              "Listed on OFENTSE-FINDS and reviewed by our team."
            ) : (
              "Listed on OFENTSE-FINDS. Not yet verified by our team."
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="mt-0.5 text-teal-700" aria-label={label}>{icon}</dt>
      <dd className="min-w-0 break-words text-ink-2">{children}</dd>
    </div>
  );
}
