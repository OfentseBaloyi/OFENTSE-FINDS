import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow, title, description, action, className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-[1.65rem] font-bold leading-tight text-ink sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className="shrink-0 text-sm font-semibold text-teal-700 underline-offset-4 hover:underline">
          {action.label} →
        </Link>
      )}
    </div>
  );
}

export function VerifiedBadge({ className, label = "Verified" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-orange-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-600", className)}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function EmptyState({
  icon, title, children, actions, className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-line bg-paper px-6 py-10 text-center", className)}>
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-sand text-teal-700">{icon}</div>}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function ButtonLink({
  href, children, variant = "primary", className, external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "orange";
  className?: string;
  external?: boolean;
}) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]",
    variant === "primary" && "bg-teal-800 text-white hover:bg-teal-900",
    variant === "orange" && "bg-orange text-teal-950 hover:bg-[#f39a33]",
    variant === "secondary" && "border border-line bg-paper text-ink hover:border-ink/30",
    variant === "ghost" && "text-teal-700 hover:bg-teal-100/60",
    className,
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function CardSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-line bg-paper">
          <div className="skeleton aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn"; children: React.ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        tone === "warn" ? "border-orange/40 bg-orange-soft text-[#7a4100]" : "border-teal-100 bg-teal-100/50 text-teal-900",
        className,
      )}
    >
      {children}
    </div>
  );
}
