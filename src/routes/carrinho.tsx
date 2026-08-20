import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, MessageCircle, CheckCircle2, ShoppingBag } from "lucide-react";
import { z } from "zod";

import { SiteShell } from "@/components/site-shell";
import { useCart } from "@/lib/cart";
import { formatPrice, formatWhatsappUrl, siteSettingsQuery } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Seu carrinho — Catálogo Virtual" },
      {
        name: "description",
        content:
          "Revise os itens escolhidos e envie seu pedido diretamente para a loja pelo WhatsApp.",
      },
      { property: "og:title", content: "Seu carrinho — Catálogo Virtual" },
      { property: "og:description", content: "Revise os itens e finalize seu pedido no WhatsApp." },
    ],
  }),
  component: CartPage,
});

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo").max(100),
  phone: z.string().trim().min(8, "Informe um telefone / WhatsApp válido").max(25),
  note: z.string().trim().max(500).optional(),
});

function CartPage() {
  const { data: settings } = useQuery(siteSettingsQuery);
  const { items, total, setQuantity, remove, clear } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    whatsappUrl: string;
    total: number;
    itemsCount: number;
  } | null>(null);

  const submit = async () => {
    if (items.length === 0) return;
    const parsed = checkoutSchema.safeParse({ name, phone, note });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }

    setSending(true);
    try {
      // 1. Salva o pedido no banco de dados Supabase
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_name: parsed.data.name,
          customer_phone: parsed.data.phone,
          note: parsed.data.note ?? null,
          total,
          status: "novo",
        })
        .select("id")
        .single();

      if (error) {
        console.warn("Aviso ao salvar no banco:", error);
      }

      if (order?.id) {
        await supabase.from("order_items").insert(
          items.map((i) => ({
            order_id: order.id,
            product_id: i.productId,
            title: i.title,
            options: i.options,
            unit_price: i.price,
            quantity: i.quantity,
          })),
        );
      }

      // 2. Monta a mensagem formatada para o WhatsApp
      const storeName = settings?.site_name ?? "Catálogo";
      const itemsText = items
        .map(
          (i) =>
            `• *${i.quantity}x ${i.title}*` +
            (i.options ? `\n  _Opções:_ ${i.options}` : "") +
            `\n  _Valor unit.:_ ${formatPrice(i.price)} | _Subtotal:_ ${formatPrice(i.price * i.quantity)}`,
        )
        .join("\n\n");

      const messageText =
        `🛍️ *NOVO PEDIDO - ${storeName.toUpperCase()}*\n\n` +
        `👤 *Cliente:* ${parsed.data.name}\n` +
        `📱 *Telefone:* ${parsed.data.phone}\n` +
        (parsed.data.note ? `📝 *Observações:* ${parsed.data.note}\n` : "") +
        `\n📦 *Itens Escolhidos:*\n${itemsText}\n\n` +
        `💰 *TOTAL DO PEDIDO:* ${formatPrice(total)}\n\n` +
        `Aguardo a confirmação dos itens e disponibilidade!`;

      // 3. Obtém o WhatsApp do Administrador configurado ou do cliente como fallback
      const adminPhone = settings?.whatsapp?.trim() || "";
      const targetPhone = adminPhone || parsed.data.phone;
      const whatsappUrl = formatWhatsappUrl(targetPhone, messageText);

      // 4. Salva estado de conclusão e abre o WhatsApp
      const totalAmount = total;
      const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);

      clear();
      setCompletedOrder({
        whatsappUrl,
        total: totalAmount,
        itemsCount: totalCount,
      });

      toast.success("Pedido gerado com sucesso! Abrindo o WhatsApp...");
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao processar o pedido. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (completedOrder) {
    return (
      <SiteShell>
        <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center sm:px-6">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Pedido Enviado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu pedido de <strong>{completedOrder.itemsCount} item(ns)</strong> no valor de{" "}
            <strong>{formatPrice(completedOrder.total)}</strong> foi gerado e encaminhado para o
            WhatsApp da loja.
          </p>

          <div className="surface-panel mt-6 w-full p-5 text-left space-y-3">
            <p className="text-xs text-muted-foreground">
              A conversa do WhatsApp abriu em uma nova janela. Caso não tenha aberto
              automaticamente, clique no botão abaixo:
            </p>
            <Button
              asChild
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              size="lg"
            >
              <a href={completedOrder.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-5 w-5" /> Abrir WhatsApp Agora
              </a>
            </Button>
          </div>

          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Continuar Navegando</Link>
          </Button>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h1 className="font-display text-3xl sm:text-4xl">Seu Carrinho</h1>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar Carrinho
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="surface-panel mt-8 p-12 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 font-display text-xl">Seu carrinho está vazio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore nossos produtos e adicione suas peças favoritas.
            </p>
            <Button asChild className="mt-6">
              <Link to="/">Ver Catálogo</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            {/* LISTA DE PRODUTOS NO CARRINHO */}
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.key} className="surface-panel flex gap-4 p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                        Sem foto
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-medium text-foreground text-balance-tight">{item.title}</p>
                      {item.options && (
                        <p className="mt-1 text-xs text-muted-foreground text-balance-tight">
                          {item.options}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {formatPrice(item.price)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Diminuir"
                          onClick={() => setQuantity(item.key, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Aumentar"
                          onClick={() => setQuantity(item.key, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-foreground">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          aria-label="Remover"
                          onClick={() => remove(item.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* FORMULÁRIO DE FINALIZAÇÃO */}
            <div className="surface-panel h-fit space-y-5 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total do Pedido</span>
                <span className="font-display text-2xl font-bold text-primary">
                  {formatPrice(total)}
                </span>
              </div>

              <div className="h-px w-full gold-line" />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Seu Nome Completo *</Label>
                  <Input
                    id="nome"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telefone">Seu WhatsApp / Telefone com DDD *</Label>
                  <Input
                    id="telefone"
                    value={phone}
                    maxLength={25}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="obs">Observações / Endereço de Entrega</Label>
                  <Textarea
                    id="obs"
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex: Entregar à tarde, embalagem para presente, etc."
                    rows={2}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
                💬 Ao clicar no botão abaixo, seu pedido será gerado e você será redirecionado para
                o WhatsApp da loja para concluir o atendimento.
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 text-base"
                size="lg"
                disabled={sending}
                onClick={submit}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                {sending ? "Enviando Pedido..." : "Finalizar Compra via WhatsApp"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
