import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { SiteShell } from "@/components/site-shell";
import {
  attributesQuery,
  formatPrice,
  productsQuery,
  siteSettingsQuery,
  sortedImages,
  type Product,
} from "@/lib/catalog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catálogo Virtual — Produtos, preços e disponibilidade" },
      {
        name: "description",
        content:
          "Explore o catálogo completo: fotos, preços, estoque e opções de cor, número e tamanho. Monte seu pedido em poucos cliques.",
      },
      { property: "og:title", content: "Catálogo Virtual — Produtos e preços" },
      {
        property: "og:description",
        content: "Fotos, preços, estoque e opções de cor, número e tamanho.",
      },
    ],
  }),
  component: CatalogPage,
});

function ProductCard({ product }: { product: Product }) {
  const image = sortedImages(product)[0];
  return (
    <Link
      to="/produto/$slug"
      params={{ slug: product.slug }}
      className="group surface-panel flex flex-col overflow-hidden transition-colors hover:border-primary/60"
    >
      <div className="aspect-square w-full overflow-hidden bg-secondary">
        {image ? (
          <img
            src={image.url}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
            Sem foto
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category && (
          <span className="text-[11px] uppercase tracking-widest text-primary">
            {product.category}
          </span>
        )}
        <h3 className="font-display text-base leading-snug text-balance-tight">{product.title}</h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-lg font-semibold">{formatPrice(product.price)}</span>
          <Badge variant={product.stock > 0 ? "secondary" : "outline"}>
            {product.stock > 0 ? `${product.stock} em estoque` : "Esgotado"}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

function CatalogPage() {
  const { data: settings } = useQuery(siteSettingsQuery);
  const { data: products, isLoading } = useQuery(productsQuery());
  const { data: attributes } = useQuery(attributesQuery);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [valueFilter, setValueFilter] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      Array.from(
        new Set((products ?? []).map((p) => p.category).filter((c): c is string => Boolean(c))),
      ).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      const matchTerm =
        !t ||
        p.title.toLowerCase().includes(t) ||
        (p.description ?? "").toLowerCase().includes(t);
      const matchCat = !category || p.category === category;
      const matchValue =
        !valueFilter ||
        (p.product_attribute_values ?? []).some((v) => v.attribute_value_id === valueFilter);
      return matchTerm && matchCat && matchValue;
    });
  }, [products, term, category, valueFilter]);

  return (
    <SiteShell>
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Catálogo</p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl leading-tight text-balance-tight sm:text-5xl">
            {settings?.tagline ?? "Peças selecionadas, entrega rápida"}
          </h1>
          {settings?.about && (
            <p className="mt-4 max-w-xl text-sm text-muted-foreground text-balance-tight sm:text-base">
              {settings.about}
            </p>
          )}
          <div className="mt-8 h-px w-full gold-line" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-9"
              aria-label="Buscar produto"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={category === null ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(null)}
              >
                Todas
              </Button>
              {categories.map((c) => (
                <Button
                  key={c}
                  variant={category === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          )}

          {(attributes ?? []).map((attr) => (
            <div key={attr.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {attr.name}
              </span>
              {attr.attribute_values.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setValueFilter(valueFilter === v.id ? null : v.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    valueFilter === v.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/60"
                  }`}
                >
                  {v.value}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-xl" />
            ))}
          {!isLoading && filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="surface-panel mt-8 p-10 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </div>
        )}
      </section>
    </SiteShell>
  );
}
