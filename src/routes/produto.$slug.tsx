import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";

import { SiteShell } from "@/components/site-shell";
import {
  attributesQuery,
  formatPrice,
  formatWhatsappUrl,
  productBySlugQuery,
  siteSettingsQuery,
  sortedImages,
} from "@/lib/catalog";
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
  const { data: settings } = useQuery(siteSettingsQuery);
  const { data: product, isLoading } = useQuery(productBySlugQuery(slug));
  const { data: attributes } = useQuery(attributesQuery);
  const { add } = useCart();
  const [active, setActive] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selection, setSelection] = useState<Record<string, string>>({});

  const images = product ? sortedImages(product) : [];
  const inStock = (product?.stock ?? 0) > 0;

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
      toast.error(`Por favor, escolha uma opção de ${missing.name}.`);
      return;
    }
    const options = groups.map((g) => `${g.name}: ${selection[g.name]}`).join(" · ");
    for (let i = 0; i < quantity; i++) {
      add({
        productId: product.id,
        title: product.title,
        slug: product.slug,
        price: Number(product.price),
        image: images[0]?.url ?? null,
        options,
      });
    }
    toast.success(`${quantity}x ${product.title} adicionado ao carrinho!`);
  };

  const handleQuickWhatsapp = () => {
    if (!product) return;
    const options = groups
      .filter((g) => selection[g.name])
      .map((g) => `${g.name}: ${selection[g.name]}`)
      .join(" · ");

    const text =
      `Olá! Gostaria de saber mais sobre o produto *${product.title}* (${formatPrice(product.price)})` +
      (options ? ` nas opções: ${options}.` : ".");

    const targetPhone = settings?.whatsapp?.trim() || "";
    const url = formatWhatsappUrl(targetPhone, text);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <SiteShell>
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
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
          <h1 className="font-display text-2xl font-semibold">Produto não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O produto que você procura não está mais disponível ou o link está incorreto.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar ao Catálogo</Link>
          </Button>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 text-xs"
          onClick={() => navigate({ to: "/" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Catálogo
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* GALERIA DE FOTOS */}
          <div className="min-w-0 space-y-3">
            <div className="surface-panel relative aspect-square w-full overflow-hidden bg-secondary">
              {images[active] ? (
                <img
                  src={images[active].url}
                  alt={product.title}
                  className="h-full w-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">
                  Sem foto disponível
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.id || i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-all ${
                      i === active
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DETALHES DO PRODUTO */}
          <div className="min-w-0 flex flex-col">
            {product.category && (
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {product.category}
              </span>
            )}
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">
              {product.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-display text-3xl font-bold text-foreground">
                {formatPrice(product.price)}
              </span>
              <Badge variant={inStock ? "secondary" : "outline"}>
                {inStock ? `${product.stock} em estoque` : "Esgotado"}
              </Badge>
            </div>

            {product.description && (
              <div className="mt-6 border-t border-border/50 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Descrição
                </h4>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}

            {/* SELETOR DE ATRIBUTOS (TAMANHO, COR, ETC.) */}
            {groups.length > 0 && (
              <div className="mt-6 space-y-5 border-t border-border/50 pt-4">
                {groups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                      <span className="text-muted-foreground">{group.name}:</span>
                      {selection[group.name] && (
                        <span className="text-primary font-bold">{selection[group.name]}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.attribute_values.map((v) => {
                        const isSelected = selection[group.name] === v.value;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() =>
                              setSelection((prev) => ({ ...prev, [group.name]: v.value }))
                            }
                            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                                : "border-border bg-card/60 hover:border-primary/60"
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
            )}

            {/* CONTROLE DE QUANTIDADE E BOTÕES DE AÇÃO */}
            <div className="mt-8 pt-4 border-t border-border/50 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quantidade:
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={quantity <= 1 || !inStock}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={quantity >= product.stock || !inStock}
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 py-6 text-base"
                  size="lg"
                  disabled={!inStock}
                  onClick={handleAdd}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  {inStock ? "Adicionar ao Carrinho" : "Produto Esgotado"}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="py-6 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400"
                  onClick={handleQuickWhatsapp}
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Dúvidas no WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
