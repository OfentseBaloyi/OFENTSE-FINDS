export type ImageCredit = {
  url: string;
  license: string | null;
  credit: string | null;
  sourceUrl: string | null;
};

export type TownKind = "city" | "town" | "suburb";

export type Town = {
  /** database id when the town exists in Supabase */
  id?: string;
  slug: string;
  name: string;
  province: string | null;
  latitude: number;
  longitude: number;
  kind: TownKind;
  radiusKm: number;
  description: string | null;
  wikiUrl: string | null;
  cover: ImageCredit | null;
  source: "seed" | "database" | "geocoded";
};

export type PlaceSource = "osm" | "supabase";

export type Place = {
  /** URL-safe id: `osm-n123` / `osm-w123` / `osm-r123` for OpenStreetMap, `sb-<uuid>` for Supabase */
  id: string;
  name: string;
  categorySlug: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  openingHours: string | null;
  description: string | null;
  cuisine: string | null;
  imageUrl: string | null;
  source: PlaceSource;
  /** link to the record at its source (e.g. openstreetmap.org/node/123) */
  sourceUrl: string | null;
  /** for Supabase listings that mirror an external record, e.g. `osm-n123` */
  sourcePlaceId?: string | null;
  verified: boolean;
  /** only set when a real rating source exists — never fabricated */
  rating: number | null;
  reviewCount: number | null;
  townSlug: string | null;
  createdAt: string | null;
  /** km from the town centre (or search point), computed server-side */
  distanceKm?: number;
};

export type PlacesResult = {
  places: Place[];
  /** non-fatal problems the UI should surface, e.g. "OpenStreetMap is busy" */
  warnings: string[];
  /** fatal: nothing could be loaded */
  error: string | null;
};
