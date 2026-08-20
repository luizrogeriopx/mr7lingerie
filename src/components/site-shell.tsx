import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, ShoppingBag, X, MessageCircle, Instagram, Mail, MapPin } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { siteSettingsQuery, formatWhatsappUrl } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { session, isAdmin } = useSession();
  return (
    <>
      <Link
        to="/"
        onClick={onNavigate}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Catálogo
      </Link>
      <Link
        to="/carrinho"
        onClick={onNavigate}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Carrinho
      </Link>
      {session && isAdmin ? (
        <Link
          to="/admin"
          onClick={onNavigate}
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Painel Admin
        </Link>
      ) : (
        <Link
          to="/auth"
          onClick={onNavigate}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          Área Admin
        </Link>
      )}
    </>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const { data: settings } = useQuery(siteSettingsQuery);
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  const cleanInsta = (settings?.instagram ?? "").replace(/^@/, "").trim();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3 group">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.site_name}
                className="h-10 w-10 shrink-0 rounded-full object-cover border border-border"
              />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground shadow-sm">
                {(settings?.site_name ?? "C").charAt(0)}
              </span>
            )}
            <div className="truncate">
              <span className="truncate font-display text-lg font-bold tracking-tight sm:text-xl group-hover:text-primary transition-colors block">
                {settings?.site_name ?? "Catálogo"}
              </span>
            </div>
          </Link>

          <nav className="ml-auto hidden items-center gap-6 md:flex">
            <NavLinks />
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-4">
            <Button asChild variant="outline" size="sm" className="relative h-9 px-3">
              <Link to="/carrinho" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Carrinho</span>
                {count > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                    {count}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Abrir menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border bg-card md:hidden">
            <nav className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-border bg-card/40">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover border border-border"
                />
              ) : null}
              <h3 className="font-display text-lg font-bold">
                {settings?.site_name ?? "Catálogo"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {settings?.about ??
                settings?.tagline ??
                "Catálogo virtual de produtos com atendimento direto pelo WhatsApp."}
            </p>
          </div>

          <div className="space-y-2.5 text-sm text-muted-foreground">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-foreground">
              Atendimento & Contato
            </h4>
            {settings?.whatsapp && (
              <p>
                <a
                  href={formatWhatsappUrl(
                    settings.whatsapp,
                    "Olá! Gostaria de tirar uma dúvida sobre os produtos do catálogo.",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>WhatsApp: {settings.whatsapp}</span>
                </a>
              </p>
            )}
            {settings?.instagram && (
              <p>
                <a
                  href={`https://instagram.com/${cleanInsta}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-pink-400 transition-colors"
                >
                  <Instagram className="h-4 w-4 shrink-0 text-pink-500" />
                  <span>@{cleanInsta}</span>
                </a>
              </p>
            )}
            {settings?.email && (
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <span>{settings.email}</span>
              </p>
            )}
          </div>

          <div className="space-y-2.5 text-sm text-muted-foreground">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-foreground">
              Localização
            </h4>
            {settings?.address && (
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{settings.address}</span>
              </p>
            )}
            <p className="pt-2 text-xs">
              © {new Date().getFullYear()} {settings?.site_name ?? "Catálogo Virtual"}. Todos os
              direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
