import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, X, Sparkles } from "lucide-react";

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
  const inStock = product.stock > 0;

  return (
    <Link
      to="/produto/$slug"
      params={{ slug: product.slug }}
      className="group surface-panel flex flex-col overflow-hidden transition-all duration-300 hover:border-primary/60 hover:shadow-lg"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
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
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {product.is_featured && (
            <span className="flex items-center gap-1 rounded-full bg-primary/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              <Sparkles className="h-2.5 w-2.5" /> Destaque
            </span>
          )}
          {!inStock && (
            <span className="rounded-full bg-destructive/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
              Esgotado
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category && (
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary truncate">
            {product.category}
          </span>
        )}
        <h3 className="font-display text-base font-semibold leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {product.title}
        </h3>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50">
          <span className="text-lg font-bold text-foreground">{formatPrice(product.price)}</span>
          <Badge variant={inStock ? "secondary" : "outline"} className="text-[11px]">
            {inStock ? `${product.stock} disponíveis` : "Esgotado"}
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

  const hasActiveFilters = Boolean(term || category || valueFilter);

  const clearFilters = () => {
    setTerm("");
    setCategory(null);
    setValueFilter(null);
  };

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      const matchTerm =
        !t ||
        p.title.toLowerCase().includes(t) ||
        (p.description ?? "").toLowerCase().includes(t) ||
        (p.category ?? "").toLowerCase().includes(t);
      const matchCat = !category || p.category === category;
      const matchValue =
        !valueFilter ||
        (p.product_attribute_values ?? []).some((v) => v.attribute_value_id === valueFilter);
      return matchTerm && matchCat && matchValue;
    });
  }, [products, term, category, valueFilter]);

  return (
    <SiteShell>
      {/* BANNER / HERO */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            {settings?.site_name ?? "Catálogo Virtual"}
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl leading-tight sm:text-5xl">
            {settings?.tagline ?? "Peças selecionadas, entrega rápida"}
          </h1>
          {settings?.about && (
            <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed sm:text-base">
              {settings.about}
            </p>
          )}
          <div className="mt-6 h-px w-full gold-line" />
        </div>
      </section>

      {/* FILTROS E PRODUTOS */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-5">
          {/* BUSCA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar por nome, modelo ou descrição..."
                className="pl-9 bg-card"
                aria-label="Buscar produto"
              />
              {term && (
                <button
                  type="button"
                  onClick={() => setTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground self-start sm:self-center"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Limpar Filtros
              </Button>
            )}
          </div>

          {/* CATEGORIAS (ROLAGEM HORIZONTAL SUAVE NO MOBILE) */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
              <Button
                variant={category === null ? "default" : "outline"}
                size="sm"
                className="rounded-full shrink-0 text-xs"
                onClick={() => setCategory(null)}
              >
                Todas as Categorias
              </Button>
              {categories.map((c) => (
                <Button
                  key={c}
                  variant={category === c ? "default" : "outline"}
                  size="sm"
                  className="rounded-full shrink-0 text-xs"
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          )}

          {/* FILTRO POR ATRIBUTOS (TAMANHO, COR, NÚMERO) */}
          {(attributes ?? []).length > 0 && (
            <div className="flex flex-col gap-2.5 pt-1">
              {(attributes ?? []).map((attr) => (
                <div key={attr.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[65px]">
                    {attr.name}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.attribute_values.map((v) => {
                      const isActive = valueFilter === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setValueFilter(isActive ? null : v.id)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
                            isActive
                              ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "border-border bg-card/60 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                          }`}
                        >
                          {v.color_hex && (
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-border"
                              style={{ backgroundColor: v.color_hex }}
                            />
                          )}
                          {v.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GRID DE PRODUTOS */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-xl" />
            ))}
          {!isLoading && filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>

        {/* SEM RESULTADOS */}
        {!isLoading && filtered.length === 0 && (
          <div className="surface-panel mt-8 p-12 text-center">
            <h3 className="font-display text-lg font-semibold">Nenhum produto encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tente alterar os termos da busca ou selecionar outra categoria.
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                Limpar Filtros
              </Button>
            )}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
