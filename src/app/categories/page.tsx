import type { Metadata } from "next";
import { CategoryLink } from "@/components/category-link";
import { Icon } from "@/components/category-icon";
import { CATEGORY_GROUPS, categoriesInGroup } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Categories",
  description: "Food, automotive, shopping, lifestyle and essential services — browse every category on OFENTSE-FINDS.",
};

export default function CategoriesPage() {
  return (
    <div className="container-page pt-10 sm:pt-14">
      <p className="eyebrow">Categories</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">From kota to car washes.</h1>
      <p className="mt-3 max-w-xl text-muted">Pick a category. We&apos;ll show it in the last town you explored, or ask you where to look.</p>

      <div className="mt-12 space-y-14">
        {CATEGORY_GROUPS.map((g) => (
          <section key={g.slug} id={g.slug} className="scroll-mt-24">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ backgroundColor: g.color }}>
                <Icon name={g.icon} className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-bold">{g.name}</h2>
                <p className="text-sm text-muted">{g.description}</p>
              </div>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <li>
                <CategoryLink value={`group:${g.slug}`} name={`All ${g.shortName.toLowerCase()}`} description={`Everything in ${g.name.toLowerCase()}.`} icon={g.icon} color={g.color} emphasis />
              </li>
              {categoriesInGroup(g.slug).map((c) => (
                <li key={c.slug}>
                  <CategoryLink value={c.slug} name={c.name} description={c.description} icon={c.icon} color={g.color} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
