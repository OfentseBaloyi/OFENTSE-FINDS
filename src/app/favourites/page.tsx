import type { Metadata } from "next";
import { FavouritesView } from "@/components/favourites-view";

export const metadata: Metadata = { title: "Favourites", robots: { index: false } };

export default function FavouritesPage() {
  return (
    <div className="container-page pt-10 sm:pt-14">
      <p className="eyebrow">Favourites</p>
      <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Your saved places</h1>
      <p className="mt-3 max-w-xl text-muted">Saved on this device only — no account needed. Clearing your browser data will clear them.</p>
      <FavouritesView />
    </div>
  );
}
