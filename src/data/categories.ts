// Category registry — the single source of truth for categories.
//
// Each category maps to one or more OpenStreetMap tag filters. The same definition is used
// to build Overpass queries (server) and to classify returned places (shared), so adding a
// category is a data change only. The Supabase `categories` table mirrors these slugs so
// listings and submissions can reference them (see supabase/migrations).
//
// This file must stay self-contained (no imports) — scripts/build-seed-sql.ts reads it directly.

/** All conditions in a filter must match (AND). A category matches if ANY of its filters match (OR). */
export type OsmFilter = {
  /** key -> allowed exact values, or `true` for "key present" */
  tags: Record<string, string[] | true>;
  /** key -> case-insensitive regex applied to the tag value */
  regex?: Record<string, string>;
};

export type CategoryGroupSlug = "food" | "automotive" | "shopping" | "lifestyle" | "services";

export type CategoryGroup = {
  slug: CategoryGroupSlug;
  name: string;
  shortName: string;
  description: string;
  icon: string; // lucide icon name (see src/components/category-icon.tsx)
  color: string; // marker + accent colour
};

export type Category = {
  slug: string;
  name: string;
  group: CategoryGroupSlug;
  icon: string;
  description: string;
  /** words people type that should map to this category */
  keywords: string[];
  osm: OsmFilter[];
};

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { slug: "food", name: "Food & Restaurants", shortName: "Food", description: "Kota spots, restaurants, cafés and street food.", icon: "utensils", color: "#E2711D" },
  { slug: "automotive", name: "Automotive", shortName: "Automotive", description: "Mechanics, car washes, tyres and panel beaters.", icon: "car", color: "#2563A8" },
  { slug: "shopping", name: "Shopping", shortName: "Shopping", description: "Malls, spaza shops, clothing and hardware.", icon: "shopping-bag", color: "#1E9E5A" },
  { slug: "lifestyle", name: "Lifestyle & Entertainment", shortName: "Lifestyle", description: "Nightlife, parks, attractions and hidden gems.", icon: "palmtree", color: "#B23A6F" },
  { slug: "services", name: "Professional & Essential Services", shortName: "Services", description: "Pharmacies, doctors, salons, banks and more.", icon: "briefcase", color: "#0F6E68" },
];

const FOOD_AMENITIES = ["restaurant", "fast_food", "food_court"];

// Order matters within a group: more specific categories come first, because a place is
// assigned to the first category it matches (e.g. a kota spot before generic fast food).
export const CATEGORIES: Category[] = [
  // ── Food & Restaurants ───────────────────────────────────────────────
  {
    slug: "kota-spots", name: "Kota spots", group: "food", icon: "sandwich",
    description: "Places known for kota — the township quarter-loaf classic.",
    keywords: ["kota", "kotas", "skhambane", "bunny chow", "bunny"],
    osm: [
      { tags: { amenity: FOOD_AMENITIES }, regex: { name: "kota|bunny" } },
      { tags: { amenity: FOOD_AMENITIES }, regex: { cuisine: "kota|bunny" } },
    ],
  },
  {
    slug: "street-food", name: "Street food", group: "food", icon: "flame",
    description: "Street vendors, food stalls and markets.",
    keywords: ["street food", "food stall", "shisanyama", "braai", "chisa nyama", "market"],
    osm: [
      { tags: { street_vendor: ["yes"] } },
      { tags: { amenity: ["marketplace"] } },
      { tags: { amenity: FOOD_AMENITIES }, regex: { name: "shisa|chisa|braai|shisanyama" } },
    ],
  },
  {
    slug: "bakeries", name: "Bakeries", group: "food", icon: "croissant",
    description: "Fresh bread, vetkoek and pastries.",
    keywords: ["bakery", "bakeries", "bread", "vetkoek", "pastry", "cake"],
    osm: [{ tags: { shop: ["bakery", "pastry", "confectionery"] } }],
  },
  {
    slug: "cafes", name: "Cafés", group: "food", icon: "coffee",
    description: "Coffee, breakfast and somewhere to sit.",
    keywords: ["cafe", "café", "cafes", "coffee", "coffee shop", "breakfast"],
    osm: [{ tags: { amenity: ["cafe"] } }],
  },
  {
    slug: "takeaways", name: "Takeaways", group: "food", icon: "package",
    description: "Grab-and-go meals.",
    keywords: ["takeaway", "takeaways", "take away", "take-away"],
    osm: [{ tags: { amenity: ["restaurant", "fast_food"], takeaway: ["yes", "only"] } }],
  },
  {
    slug: "fast-food", name: "Fast food", group: "food", icon: "sandwich",
    description: "Chicken, burgers, pizza and quick bites.",
    keywords: ["fast food", "burger", "burgers", "chicken", "pizza", "chips", "fries"],
    osm: [{ tags: { amenity: ["fast_food", "food_court"] } }],
  },
  {
    slug: "restaurants", name: "Restaurants", group: "food", icon: "utensils",
    description: "Sit-down meals from local favourites to fine dining.",
    keywords: ["restaurant", "restaurants", "food", "eat", "dinner", "lunch", "places to eat"],
    osm: [{ tags: { amenity: ["restaurant"] } }],
  },

  // ── Automotive ───────────────────────────────────────────────────────
  {
    slug: "car-washes", name: "Car washes", group: "automotive", icon: "droplets",
    description: "Hand washes, valets and drive-throughs.",
    keywords: ["car wash", "carwash", "car washes", "valet", "wash"],
    osm: [{ tags: { amenity: ["car_wash"] } }],
  },
  {
    slug: "tyre-shops", name: "Tyre shops", group: "automotive", icon: "circle-dot",
    description: "Tyres, wheel alignment and balancing.",
    keywords: ["tyre", "tyres", "tire", "tires", "wheel alignment", "puncture"],
    osm: [{ tags: { shop: ["tyres"] } }],
  },
  {
    slug: "auto-electricians", name: "Auto electricians", group: "automotive", icon: "zap",
    description: "Vehicle electrical faults, batteries and wiring.",
    keywords: ["auto electrician", "auto electricians", "auto electrical", "car battery", "battery"],
    osm: [
      { tags: { shop: ["car_repair"], "service:vehicle:electrical": ["yes"] } },
      { tags: { shop: ["car_repair", "car_parts"] }, regex: { name: "auto ?elec|electrical" } },
      { tags: { shop: ["car_parts"], "service:vehicle:batteries": ["yes"] } },
    ],
  },
  {
    slug: "panel-beaters", name: "Panel beaters", group: "automotive", icon: "hammer",
    description: "Body repair, dents and spray painting.",
    keywords: ["panel beater", "panel beaters", "panelbeater", "body repair", "spray paint", "dent"],
    osm: [
      { tags: { shop: ["car_repair"], "service:vehicle:body_repair": ["yes"] } },
      { tags: { craft: ["panel_beater"] } },
      { tags: { shop: ["car_repair"] }, regex: { name: "panel|body ?works|body ?repair|spray" } },
    ],
  },
  {
    slug: "vehicle-servicing", name: "Vehicle servicing", group: "automotive", icon: "gauge",
    description: "Services, oil changes and roadworthy tests.",
    keywords: ["service", "servicing", "oil change", "roadworthy", "vehicle service"],
    osm: [
      { tags: { shop: ["car_repair"], "service:vehicle:oil_change": ["yes"] } },
      { tags: { amenity: ["vehicle_inspection"] } },
      { tags: { shop: ["car_repair"] }, regex: { name: "servic|fitment|roadworthy" } },
    ],
  },
  {
    slug: "mechanics", name: "Mechanics", group: "automotive", icon: "wrench",
    description: "General vehicle repair and maintenance.",
    keywords: ["mechanic", "mechanics", "car repair", "garage", "workshop", "motor repair"],
    osm: [{ tags: { shop: ["car_repair"] } }, { tags: { craft: ["mechanic"] } }],
  },

  // ── Shopping ─────────────────────────────────────────────────────────
  {
    slug: "shopping-centres", name: "Shopping centres", group: "shopping", icon: "building-2",
    description: "Malls and shopping complexes.",
    keywords: ["mall", "malls", "shopping centre", "shopping center", "plaza", "shopping"],
    osm: [{ tags: { shop: ["mall", "department_store"] } }],
  },
  {
    slug: "supermarkets", name: "Supermarkets", group: "shopping", icon: "shopping-cart",
    description: "Groceries and household essentials.",
    keywords: ["supermarket", "supermarkets", "groceries", "grocery", "shoprite", "spar", "pick n pay", "checkers", "boxer"],
    osm: [{ tags: { shop: ["supermarket", "wholesale"] } }],
  },
  {
    slug: "clothing-stores", name: "Clothing stores", group: "shopping", icon: "shirt",
    description: "Clothes, shoes and fashion.",
    keywords: ["clothing", "clothes", "fashion", "shoes", "boutique"],
    osm: [{ tags: { shop: ["clothes", "shoes", "boutique", "fashion_accessories"] } }],
  },
  {
    slug: "hardware-stores", name: "Hardware stores", group: "shopping", icon: "drill",
    description: "Building supplies, tools and DIY.",
    keywords: ["hardware", "building supplies", "tools", "diy", "build it", "cashbuild"],
    osm: [{ tags: { shop: ["hardware", "doityourself", "trade"] } }],
  },
  {
    slug: "local-shops", name: "Local shops", group: "shopping", icon: "store",
    description: "Spaza shops, convenience stores and corner shops.",
    keywords: ["spaza", "spaza shop", "convenience", "corner shop", "tuck shop", "shop", "shops"],
    osm: [{ tags: { shop: ["convenience", "general", "kiosk", "variety_store"] } }],
  },

  // ── Lifestyle & Entertainment ────────────────────────────────────────
  {
    slug: "bars-nightlife", name: "Bars & nightlife", group: "lifestyle", icon: "wine",
    description: "Taverns, lounges, pubs and clubs.",
    keywords: ["bar", "bars", "pub", "tavern", "shebeen", "lounge", "club", "nightclub", "nightlife", "chill spot"],
    osm: [{ tags: { amenity: ["bar", "pub", "nightclub", "biergarten"] } }],
  },
  {
    slug: "events", name: "Event venues", group: "lifestyle", icon: "calendar-days",
    description: "Venues and community halls that host events. (Event listings are not available yet.)",
    keywords: ["event", "events", "venue", "hall", "conference"],
    osm: [{ tags: { amenity: ["events_venue", "conference_centre", "community_centre", "exhibition_centre"] } }],
  },
  {
    slug: "entertainment", name: "Entertainment", group: "lifestyle", icon: "clapperboard",
    description: "Cinemas, theatres, stadiums and fun days out.",
    keywords: ["entertainment", "cinema", "movies", "theatre", "theater", "bowling", "stadium", "fun"],
    osm: [
      { tags: { amenity: ["cinema", "theatre", "arts_centre"] } },
      { tags: { leisure: ["bowling_alley", "amusement_arcade", "stadium", "water_park", "escape_game", "trampoline_park"] } },
    ],
  },
  {
    slug: "hidden-gems", name: "Hidden gems", group: "lifestyle", icon: "gem",
    description: "Heritage sites, viewpoints, memorials and public art worth seeking out.",
    keywords: ["hidden gem", "hidden gems", "heritage", "history", "historic", "viewpoint", "monument", "memorial", "art"],
    osm: [
      { tags: { tourism: ["viewpoint", "artwork"] } },
      { tags: { historic: ["monument", "memorial", "ruins", "archaeological_site", "building", "fort", "battlefield"] } },
      { tags: { natural: ["waterfall", "cave_entrance", "peak"] }, regex: { name: "." } },
    ],
  },
  {
    slug: "tourist-attractions", name: "Tourist attractions", group: "lifestyle", icon: "landmark",
    description: "Museums, galleries, zoos and must-sees.",
    keywords: ["attraction", "attractions", "things to do", "tourist", "museum", "gallery", "zoo", "sightseeing", "what to do"],
    osm: [{ tags: { tourism: ["attraction", "museum", "gallery", "zoo", "theme_park", "aquarium"] } }],
  },
  {
    slug: "parks", name: "Parks", group: "lifestyle", icon: "trees",
    description: "Parks, gardens and nature reserves.",
    keywords: ["park", "parks", "garden", "gardens", "nature reserve", "picnic"],
    osm: [{ tags: { leisure: ["park", "garden", "nature_reserve"] }, regex: { name: "." } }],
  },

  // ── Professional & Essential Services ────────────────────────────────
  {
    slug: "pharmacies", name: "Pharmacies", group: "services", icon: "pill",
    description: "Pharmacies and chemists.",
    keywords: ["pharmacy", "pharmacies", "chemist", "dischem", "clicks", "medicine"],
    osm: [{ tags: { amenity: ["pharmacy"] } }, { tags: { shop: ["chemist"] } }],
  },
  {
    slug: "dentists", name: "Dentists", group: "services", icon: "smile",
    description: "Dental practices.",
    keywords: ["dentist", "dentists", "dental", "teeth"],
    osm: [{ tags: { amenity: ["dentist"] } }, { tags: { healthcare: ["dentist"] } }],
  },
  {
    slug: "doctors", name: "Doctors & clinics", group: "services", icon: "stethoscope",
    description: "GPs, clinics and hospitals.",
    keywords: ["doctor", "doctors", "gp", "clinic", "clinics", "hospital", "medical"],
    osm: [{ tags: { amenity: ["doctors", "clinic", "hospital"] } }],
  },
  {
    slug: "barbers", name: "Barbers", group: "services", icon: "scissors",
    description: "Cuts, fades and shaves.",
    keywords: ["barber", "barbers", "barbershop", "haircut", "fade", "cut"],
    osm: [
      { tags: { shop: ["hairdresser"], hairdresser: ["barber"] } },
      { tags: { shop: ["hairdresser", "barber"] }, regex: { name: "barb" } },
    ],
  },
  {
    slug: "hair-salons", name: "Hair salons", group: "services", icon: "sparkles",
    description: "Braids, weaves, styling and hair care.",
    keywords: ["hair", "hair salon", "salon", "braids", "hairdresser", "weave"],
    osm: [{ tags: { shop: ["hairdresser"] } }],
  },
  {
    slug: "beauty-salons", name: "Beauty salons", group: "services", icon: "flower-2",
    description: "Nails, lashes, spas and skincare.",
    keywords: ["beauty", "beauty salon", "nails", "nail", "spa", "lashes", "massage"],
    osm: [{ tags: { shop: ["beauty", "massage"] } }, { tags: { leisure: ["spa"] } }],
  },
  {
    slug: "gyms", name: "Gyms", group: "services", icon: "dumbbell",
    description: "Gyms and fitness centres.",
    keywords: ["gym", "gyms", "fitness", "workout", "training"],
    osm: [{ tags: { leisure: ["fitness_centre"] } }, { tags: { amenity: ["gym"] } }],
  },
  {
    slug: "plumbers", name: "Plumbers", group: "services", icon: "pipette",
    description: "Plumbing installs and repairs.",
    keywords: ["plumber", "plumbers", "plumbing", "geyser", "leak"],
    osm: [{ tags: { craft: ["plumber"] } }],
  },
  {
    slug: "electricians", name: "Electricians", group: "services", icon: "plug-zap",
    description: "Electrical installations and repairs.",
    keywords: ["electrician", "electricians", "electrical", "wiring", "coc"],
    osm: [{ tags: { craft: ["electrician"] } }],
  },
  {
    slug: "computer-repair", name: "Computer & phone repair", group: "services", icon: "laptop",
    description: "Laptop, PC and cellphone repairs.",
    keywords: ["computer repair", "laptop repair", "phone repair", "cellphone repair", "computer", "laptop", "it"],
    osm: [
      { tags: { craft: ["electronics_repair", "computer"] } },
      { tags: { shop: ["computer", "electronics_repair", "mobile_phone_repair"] } },
    ],
  },
  {
    slug: "internet-cafes", name: "Internet cafés", group: "services", icon: "wifi",
    description: "Printing, copies, Wi-Fi and internet access.",
    keywords: ["internet cafe", "internet café", "printing", "copies", "print", "wifi"],
    osm: [{ tags: { amenity: ["internet_cafe"] } }, { tags: { shop: ["copyshop"] } }],
  },
  {
    slug: "petrol-stations", name: "Petrol stations", group: "services", icon: "fuel",
    description: "Fuel, garages and forecourt shops.",
    keywords: ["petrol", "petrol station", "garage", "fuel", "filling station", "engen", "sasol", "shell", "bp", "total"],
    osm: [{ tags: { amenity: ["fuel"] } }],
  },
  {
    slug: "atms", name: "ATMs", group: "services", icon: "banknote",
    description: "Cash machines.",
    keywords: ["atm", "atms", "cash", "cash machine"],
    osm: [{ tags: { amenity: ["atm"] } }],
  },
  {
    slug: "banks", name: "Banks", group: "services", icon: "landmark",
    description: "Bank branches.",
    keywords: ["bank", "banks", "capitec", "fnb", "absa", "standard bank", "nedbank", "tyme"],
    osm: [{ tags: { amenity: ["bank"] } }],
  },
  {
    slug: "schools", name: "Schools", group: "services", icon: "graduation-cap",
    description: "Schools, colleges and universities.",
    keywords: ["school", "schools", "college", "university", "tvet", "creche", "education"],
    osm: [{ tags: { amenity: ["school", "college", "university"] } }],
  },
  {
    slug: "accommodation", name: "Accommodation", group: "services", icon: "bed-double",
    description: "Hotels, guest houses, lodges and B&Bs.",
    keywords: ["accommodation", "hotel", "hotels", "guest house", "guesthouse", "lodge", "bnb", "b&b", "stay"],
    osm: [{ tags: { tourism: ["hotel", "guest_house", "hostel", "motel", "apartment", "chalet"] } }],
  },
  {
    slug: "places-of-worship", name: "Places of worship", group: "services", icon: "church",
    description: "Churches, mosques, temples and more.",
    keywords: ["church", "churches", "mosque", "temple", "synagogue", "worship", "zcc"],
    osm: [{ tags: { amenity: ["place_of_worship"] } }],
  },
];
