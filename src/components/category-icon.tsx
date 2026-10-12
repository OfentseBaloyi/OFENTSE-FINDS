import {
  Banknote, BedDouble, Briefcase, Building2, CalendarDays, Car, Church, CircleDot, Clapperboard, Coffee, Croissant,
  Drill, Droplets, Dumbbell, Flame, Flower2, Fuel, Gauge, Gem, GraduationCap, Hammer, Landmark, Laptop, MapPin,
  Package, TreePalm, Pill, Pipette, PlugZap, Sandwich, Scissors, Shirt, ShoppingBag, ShoppingCart, Smile, Sparkles,
  Stethoscope, Store, Trees, Utensils, Wifi, Wine, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { categoryIcon } from "@/lib/categories";

export const ICONS: Record<string, LucideIcon> = {
  banknote: Banknote, "bed-double": BedDouble, briefcase: Briefcase, "building-2": Building2, "calendar-days": CalendarDays,
  car: Car, church: Church, "circle-dot": CircleDot, clapperboard: Clapperboard, coffee: Coffee, croissant: Croissant,
  drill: Drill, droplets: Droplets, dumbbell: Dumbbell, flame: Flame, "flower-2": Flower2, fuel: Fuel, gauge: Gauge,
  gem: Gem, "graduation-cap": GraduationCap, hammer: Hammer, landmark: Landmark, laptop: Laptop, "map-pin": MapPin,
  package: Package, palmtree: TreePalm, pill: Pill, pipette: Pipette, "plug-zap": PlugZap, sandwich: Sandwich,
  scissors: Scissors, shirt: Shirt, "shopping-bag": ShoppingBag, "shopping-cart": ShoppingCart, smile: Smile,
  sparkles: Sparkles, stethoscope: Stethoscope, store: Store, trees: Trees, utensils: Utensils, wifi: Wifi, wine: Wine,
  wrench: Wrench, zap: Zap,
};

export function Icon({ name, className, strokeWidth = 2 }: { name: string; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? MapPin;
  return <C className={className} strokeWidth={strokeWidth} aria-hidden />;
}

export function CategoryIcon({ slug, className, strokeWidth }: { slug: string | null | undefined; className?: string; strokeWidth?: number }) {
  return <Icon name={categoryIcon(slug)} className={className} strokeWidth={strokeWidth} />;
}
