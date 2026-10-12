import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <LogoMark className="h-16 w-16 opacity-90" />
      <p className="eyebrow mt-6">404</p>
      <h1 className="mt-2 text-4xl font-extrabold">We couldn&apos;t find that spot.</h1>
      <p className="mt-3 max-w-md text-muted">The page or place may have moved, or the link might be mistyped. There&apos;s plenty more right around you, though.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/towns" variant="secondary">
          Explore towns
        </ButtonLink>
      </div>
    </div>
  );
}
