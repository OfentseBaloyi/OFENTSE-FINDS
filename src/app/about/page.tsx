import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "About our data",
  description: "Where OFENTSE-FINDS gets its information, how listings are verified, and what we will never make up.",
};

const SECTIONS: Array<[string, React.ReactNode]> = [
  [
    "Where places come from",
    <>
      Most places on the map come from{" "}
      <a className="text-teal-700 underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
        OpenStreetMap
      </a>
      , a free map built by volunteers — including many South Africans. Map data is © OpenStreetMap contributors and available under the Open Database Licence. Coverage varies: some
      townships and suburbs are mapped in detail, others barely at all. When something is missing or wrong, you can fix it on OpenStreetMap or tell us about it.
    </>,
  ],
  [
    "Listings from businesses",
    <>
      Businesses can submit their details through <a className="text-teal-700 underline" href="/list-your-business">List your business</a>. Submissions are stored separately and are never
      published automatically. A member of our team checks each one and confirms its location on the map before it goes live.
    </>,
  ],
  [
    "What “Verified” means",
    <>The Verified badge appears only on listings our team has reviewed. Places from OpenStreetMap are not marked as verified, because we haven&apos;t checked them ourselves.</>,
  ],
  [
    "What we will never make up",
    <>
      We don&apos;t invent ratings, review counts, opening hours, coordinates or recommendations. If a place has no rating, we show none. If opening hours aren&apos;t published, we say so. “Recommended”
      ordering simply puts verified listings first, then places with the most complete information, then the closest.
    </>,
  ],
  [
    "Town descriptions and photos",
    <>Town summaries come from Wikipedia, and town photos from Wikimedia Commons, credited with their photographer and licence. Where no suitable photo exists we show an illustration instead of a photo of somewhere else.</>,
  ],
  [
    "Your privacy",
    <>Favourites are stored only in your browser. If you use “Near me”, your location is used for that search and isn&apos;t stored.</>,
  ],
];

export default function AboutPage() {
  return (
    <div className="container-page max-w-3xl pt-10 sm:pt-14">
      <p className="eyebrow">About</p>
      <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">Honest local discovery.</h1>
      <p className="mt-4 text-lg text-muted">OFENTSE-FINDS helps you discover what&apos;s right around you. Here&apos;s exactly where our information comes from.</p>
      <div className="mt-12 space-y-10">
        {SECTIONS.map(([title, body]) => (
          <section key={title}>
            <SectionHeading title={title} className="mb-2" />
            <p className="leading-relaxed text-ink-2">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
