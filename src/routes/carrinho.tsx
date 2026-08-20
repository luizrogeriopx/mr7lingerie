import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { z } from "zod";

import { SiteShell } from "@/components/site-shell";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
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
        content: "Revise os itens escolhidos e envie seu pedido diretamente para a loja.",
      },
      { property: "og:title", content: "Seu carrinho — Catálogo Virtual" },
      { property: "og:description", content: "Revise os itens e envie seu pedido." },
    ],
  }),
  component: CartPage,
});

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  phone: z.string().trim().min(8, "Informe um telefone válido").max(20),
  note: z.string().trim().max(500).optional(),
});

function CartPage() {
  const { items, total, setQuantity, remove, clear } = useCart();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (items.length === 0) return;
    const parsed = checkoutSchema.safeParse({ name, phone, note });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados.");
      return;
    }
    setSending(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_name: parsed.data.name,
          customer_phone: parsed.data.phone,
          note: parsed.data.note ?? null,
          total,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.productId,
          title: i.title,
          options: i.options,
          unit_price: i.price,
          quantity: i.quantity,
        })),
      );
      if (itemsError) throw itemsError;

      clear();
      toast.success("Pedido enviado! Em breve entraremos em contato.");
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl sm:text-4xl">Seu carrinho</h1>

        {items.length === 0 ? (
          <div className="surface-panel mt-8 p-10 text-center">
            <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
            <Button asChild className="mt-6">
              <Link to="/">Ver produtos</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.key} className="surface-panel flex gap-4 p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-balance-tight">{item.title}</p>
                    {item.options && (
                      <p className="mt-1 text-xs text-muted-foreground text-balance-tight">
                        {item.options}
                      </p>
                    )}
                    <p className="mt-1 text-sm">{formatPrice(item.price)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Diminuir"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Aumentar"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label="Remover"
                        onClick={() => remove(item.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="surface-panel h-fit space-y-4 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-semibold">{formatPrice(total)}</span>
              </div>
              <div className="h-px w-full gold-line" />
              <div className="space-y-3">
                <div>
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                  <Input
                    id="telefone"
                    value={phone}
                    maxLength={20}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="obs">Observação</Label>
                  <Textarea
                    id="obs"
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Alguma informação extra?"
                  />
                </div>
              </div>
              <Button className="w-full" size="lg" disabled={sending} onClick={submit}>
                {sending ? "Enviando..." : "Enviar pedido"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
