import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { SiteShell } from "@/components/site-shell";
import { attributesQuery, formatPrice, productBySlugQuery, sortedImages } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/produto/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Produto ${params.slug.replace(/-/g, " ")} — Catálogo Virtual` },
      {
        name: "description",
        content: "Fotos, preço, estoque e opções disponíveis deste produto do catálogo.",
      },
      { property: "og:title", content: "Detalhes do produto — Catálogo Virtual" },
      {
        property: "og:description",
        content: "Fotos, preço, estoque e opções disponíveis deste produto.",
      },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useQuery(productBySlugQuery(slug));
  const { data: attributes } = useQuery(attributesQuery);
  const { add } = useCart();
  const [active, setActive] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});

  const images = product ? sortedImages(product) : [];
  const selectedIds = useMemo(
    () => new Set((product?.product_attribute_values ?? []).map((v) => v.attribute_value_id)),
    [product],
  );
  const groups = (attributes ?? [])
    .map((attr) => ({
      ...attr,
      attribute_values: attr.attribute_values.filter((v) => selectedIds.has(v.id)),
    }))
    .filter((attr) => attr.attribute_values.length > 0);

  const handleAdd = () => {
    if (!product) return;
    const missing = groups.find((g) => !selection[g.name]);
    if (missing) {
      toast.error(`Escolha uma opção de ${missing.name}.`);
      return;
    }
    const options = groups.map((g) => `${g.name}: ${selection[g.name]}`).join(" · ");
    add({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      price: Number(product.price),
      image: images[0]?.url ?? null,
      options,
    });
    toast.success("Adicionado ao carrinho");
  };

  if (isLoading) {
    return (
      <SiteShell>
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </SiteShell>
    );
  }

  if (!product) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-2xl px-4 py-20 text-center sm:px-6">
          <h1 className="font-display text-2xl">Produto não encontrado</h1>
          <Button asChild className="mt-6">
            <Link to="/">Voltar ao catálogo</Link>
          </Button>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Catálogo
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="surface-panel aspect-square w-full overflow-hidden bg-secondary">
              {images[active] ? (
                <img
                  src={images[active].url}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">
                  Sem foto
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border ${
                      i === active ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {product.category && (
              <span className="text-xs uppercase tracking-[0.2em] text-primary">
                {product.category}
              </span>
            )}
            <h1 className="mt-2 font-display text-3xl leading-tight text-balance-tight sm:text-4xl">
              {product.title}
            </h1>
            <p className="mt-4 text-2xl font-semibold">{formatPrice(product.price)}</p>
            <Badge variant={product.stock > 0 ? "secondary" : "outline"} className="mt-3">
              {product.stock > 0 ? `${product.stock} em estoque` : "Esgotado"}
            </Badge>

            {product.description && (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-balance-tight">
                {product.description}
              </p>
            )}

            <div className="mt-8 space-y-5">
              {groups.map((group) => (
                <div key={group.id}>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {group.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.attribute_values.map((v) => {
                      const isActive = selection[group.name] === v.value;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() =>
                            setSelection((prev) => ({ ...prev, [group.name]: v.value }))
                          }
                          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/60"
                          }`}
                        >
                          {v.color_hex && (
                            <span
                              className="h-3 w-3 rounded-full border border-border"
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

            <Button
              className="mt-8 w-full sm:w-auto"
              size="lg"
              disabled={product.stock <= 0}
              onClick={handleAdd}
            >
              {product.stock > 0 ? "Adicionar ao carrinho" : "Produto esgotado"}
            </Button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
