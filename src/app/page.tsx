import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, Gem, Landmark, MapPinned, Sparkles, Store, Utensils } from "lucide-react";
import { LogoArtwork } from "@/components/brand/logo";
import { CategoryIcon, Icon } from "@/components/category-icon";
import { PlaceCard } from "@/components/place-card";
import { SearchBar } from "@/components/search-bar";
import { TownCard } from "@/components/town-card";
import { ButtonLink, CardSkeletonRow, EmptyState, SectionHeading } from "@/components/ui";
import { CATEGORY_GROUPS, categoriesInGroup, parseSelection } from "@/lib/categories";
import { getDbBusinesses } from "@/lib/db";
import { getPlaces } from "@/lib/places";
import { topPlaces } from "@/lib/ranking";
import { getFeaturedTowns, getKnownTowns, getTownBySlug } from "@/lib/towns";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [known, featured] = await Promise.all([getKnownTowns(), getFeaturedTowns()]);
  const townOptions = known.map((t) => ({ slug: t.slug, name: t.name, province: t.province })).sort((a, b) => a.name.localeCompare(b.name));
  const featuredSlug = process.env.FEATURED_TOWN || "pretoria";

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-teal-950 text-white">
        <Image
          src="/images/hero-johannesburg.jpg"
          alt="The Johannesburg skyline"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[50%_60%]"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(6_35_33/0.55)_0%,rgb(6_35_33/0.72)_55%,rgb(6_35_33/0.92)_100%)]" />
        <div className="container-page pb-14 pt-16 sm:pb-20 sm:pt-24 lg:pt-28">
          <p className="eyebrow animate-fade-up !text-mint">Made for South African neighbourhoods</p>
          <h1 className="mt-4 max-w-3xl animate-fade-up text-[2.6rem] font-extrabold leading-[1.02] [animation-delay:60ms] sm:text-6xl lg:text-7xl">
            Your town has more to&nbsp;offer.
          </h1>
          <p className="mt-5 max-w-xl animate-fade-up text-lg leading-relaxed text-white/85 [animation-delay:120ms] sm:text-xl">
            Discover the places, people and experiences that make every neighbourhood special.
          </p>
          <div className="mt-9 max-w-5xl animate-fade-up [animation-delay:180ms]">
            <SearchBar towns={townOptions} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-white/75">
            <span className="mr-1">Try:</span>
            {[
              ["Kota in Mabopane", "/search?q=Kota+in+Mabopane"],
              ["Mechanic in Soshanguve", "/search?q=Mechanic+in+Soshanguve"],
              ["Car wash near Ga-Rankuwa", "/search?q=Car+wash+near+Ga-Rankuwa"],
              ["Things to do in Pretoria", "/search?q=Things+to+do+in+Pretoria"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="rounded-full border border-white/25 px-3 py-1 transition hover:border-white/60 hover:bg-white/10">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <a
          href="https://commons.wikimedia.org/wiki/File:Johannesburg_skyline_2017.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-3 text-[10px] text-white/45 hover:text-white/80"
        >
          Photo: Mark Hillary · CC BY 2.0
        </a>
      </section>

      {/* ── Popular towns ───────────────────────────────────────────── */}
      <section className="container-page pt-16 sm:pt-20">
        <SectionHeading eyebrow="Popular towns" title="Start with a town you know" description="Pick a town to see its food spots, services and hidden corners on one map." action={{ href: "/towns", label: "All towns" }} />
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {featured.slice(0, 6).map((t, i) => (
            <TownCard key={t.slug} town={t} size={i < 2 ? "lg" : "md"} className={i < 2 ? "w-[72%] shrink-0 snap-start sm:w-auto lg:row-span-2 lg:aspect-auto" : "w-[60%] shrink-0 snap-start sm:w-auto"} />
          ))}
        </div>
      </section>

      {/* ── Categories ──────────────────────────────────────────────── */}
      <section className="container-page pt-20">
        <SectionHeading eyebrow="Explore by category" title="What are you looking for?" action={{ href: "/categories", label: "All categories" }} />
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORY_GROUPS.map((g) => (
            <div key={g.slug} className="flex flex-col bg-paper p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ backgroundColor: g.color }}>
                <Icon name={g.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{g.shortName}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{g.description}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {categoriesInGroup(g.slug)
                  .slice(0, 5)
                  .map((c) => (
                    <li key={c.slug}>
                      <Link href={`/search?category=${c.slug}`} className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink-2 transition hover:bg-ink hover:text-white">
                        <CategoryIcon slug={c.slug} className="h-3 w-3" />
                        {c.name}
                      </Link>
                    </li>
                  ))}
              </ul>
              <Link href={`/categories#${g.slug}`} className="mt-auto pt-4 text-sm font-semibold text-teal-700 hover:underline">
                See all →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Data-driven rails ──────────────────────────────────────── */}
      <Suspense fallback={<RailSkeleton eyebrow="Food spots" />}>
        <PlacesRail townSlug={featuredSlug} selection="group:food" eyebrow="Food spots" icon={<Utensils className="h-4 w-4" />} title={(t) => `Where ${t} eats`} description={(t) => `Restaurants, kota spots, cafés and takeaways mapped around ${t}.`} />
      </Suspense>

      <Suspense fallback={<RailSkeleton eyebrow="Trusted local services" />}>
        <VerifiedServicesRail />
      </Suspense>

      <Suspense fallback={<RailSkeleton eyebrow="Hidden gems" />}>
        <PlacesRail townSlug={featuredSlug} selection="hidden-gems" eyebrow="Hidden gems" icon={<Gem className="h-4 w-4" />} title={(t) => `Hidden gems around ${t}`} description={() => "Heritage sites, viewpoints, memorials and public art that are easy to walk past."} />
      </Suspense>

      <Suspense fallback={<RailSkeleton eyebrow="Popular attractions" />}>
        <PlacesRail townSlug={featuredSlug} selection="tourist-attractions" eyebrow="Popular attractions" icon={<Landmark className="h-4 w-4" />} title={(t) => `Things to do in ${t}`} description={() => "Museums, galleries and landmarks worth the trip."} />
      </Suspense>

      <Suspense fallback={<RailSkeleton eyebrow="Recently added" />}>
        <RecentlyAddedRail />
      </Suspense>

      {/* ── Business promotion ─────────────────────────────────────── */}
      <section className="container-page pt-20">
        <div className="relative overflow-hidden rounded-3xl bg-night px-6 py-12 text-white sm:px-12 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
          <div className="relative z-10">
            <p className="eyebrow !text-mint">For local businesses</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Put your business on the map — free.</h2>
            <p className="mt-4 max-w-lg text-white/75">
              Kota spot, car wash, salon or spaza? Tell us about it. Our team checks every submission before it goes live, and approved listings carry a <span className="font-semibold text-orange">Verified</span> badge.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
              {["Show up on town maps and search", "Share hours, photos and contact details", "Stand out with a Verified badge", "Free while we grow"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-mint" aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/list-your-business" variant="orange">
                List your business <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/about" className="border border-white/20 text-white hover:bg-white/10" variant="ghost">
                How listings work
              </ButtonLink>
            </div>
          </div>
          <div className="pointer-events-none mt-10 flex justify-center lg:mt-0">
            <LogoArtwork className="w-full max-w-md" />
          </div>
        </div>
      </section>
    </>
  );
}

// ── Rails ───────────────────────────────────────────────────────────────

async function PlacesRail({
  townSlug, selection, eyebrow, icon, title, description,
}: {
  townSlug: string;
  selection: string;
  eyebrow: string;
  icon: React.ReactNode;
  title: (town: string) => string;
  description: (town: string) => string;
}) {
  const town = await getTownBySlug(townSlug);
  if (!town) return null;
  const result = await getPlaces({ latitude: town.latitude, longitude: town.longitude, radiusKm: town.radiusKm, townSlug: town.slug }, parseSelection(selection));
  const places = topPlaces(result.places, 8);
  const href = `/towns/${town.slug}?category=${encodeURIComponent(selection)}`;

  return (
    <section className="container-page pt-20">
      <SectionHeading eyebrow={eyebrow} title={title(town.name)} description={description(town.name)} action={places.length ? { href, label: "See them on the map" } : undefined} />
      {result.error ? (
        <EmptyState icon={icon} title="This section is taking a break" actions={<ButtonLink href={href} variant="secondary">Open the map</ButtonLink>}>
          {result.error}
        </EmptyState>
      ) : places.length === 0 ? (
        <EmptyState icon={icon} title="Nothing mapped here yet" actions={<ButtonLink href="/list-your-business" variant="secondary">Suggest a place</ButtonLink>}>
          Know a spot that belongs here? Add it and help your neighbours find it.
        </EmptyState>
      ) : (
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {places.map((p) => (
            <div key={p.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <PlaceCard place={p} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function VerifiedServicesRail() {
  const places = await getDbBusinesses({ verifiedOnly: true, order: "recent", limit: 8 });
  return (
    <section className="container-page pt-20">
      <SectionHeading
        eyebrow="Trusted local services"
        title="Verified by our team"
        description="Businesses whose details we've checked. We only show the Verified badge when we've actually reviewed a listing."
      />
      {places.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="h-5 w-5" />}
          title="Verified listings are on their way"
          actions={<ButtonLink href="/list-your-business">Be one of the first</ButtonLink>}
        >
          We&apos;re reviewing our first business submissions now. Rather than pretend, this space stays empty until real, checked listings are live.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {places.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </div>
      )}
    </section>
  );
}

async function RecentlyAddedRail() {
  const places = await getDbBusinesses({ order: "recent", limit: 8 });
  return (
    <section className="container-page pt-20">
      <SectionHeading eyebrow="Recently added" title="New on OFENTSE-FINDS" description="The latest places added by local businesses and our team." />
      {places.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No new listings yet" actions={<ButtonLink href="/list-your-business" variant="secondary"><Store className="h-4 w-4" /> Add your business</ButtonLink>}>
          New listings appear here as soon as they&apos;re approved.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {places.map((p) => (
            <PlaceCard key={p.id} place={p} distanceLabel="away" />
          ))}
        </div>
      )}
    </section>
  );
}

function RailSkeleton({ eyebrow }: { eyebrow: string }) {
  return (
    <section className="container-page pt-20">
      <div className="mb-6">
        <p className="eyebrow mb-2 flex items-center gap-1.5">
          <MapPinned className="h-3.5 w-3.5" /> {eyebrow}
        </p>
        <div className="skeleton h-8 w-72 max-w-full" />
      </div>
      <CardSkeletonRow />
    </section>
  );
}
