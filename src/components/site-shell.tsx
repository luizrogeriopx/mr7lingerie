import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { siteSettingsQuery } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin } = useSession();
  return (
    <>
      <Link
        to="/"
        onClick={onNavigate}
        className="text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        Catálogo
      </Link>
      <Link
        to="/carrinho"
        onClick={onNavigate}
        className="text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        Carrinho
      </Link>
      {isAdmin ? (
        <Link
          to="/admin"
          onClick={onNavigate}
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          Painel
        </Link>
      ) : (
        <Link
          to="/auth"
          onClick={onNavigate}
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          Entrar
        </Link>
      )}
    </>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const { data: settings } = useQuery(siteSettingsQuery);
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.site_name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-display text-base text-primary-foreground">
                {(settings?.site_name ?? "C").charAt(0)}
              </span>
            )}
            <span className="truncate font-display text-lg tracking-tight sm:text-xl">
              {settings?.site_name ?? "Catálogo"}
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-6 md:flex">
            <NavLinks />
          </nav>

          <div className="ml-auto flex items-center gap-1 md:ml-4">
            <Button asChild variant="ghost" size="icon" aria-label="Abrir carrinho">
              <Link to="/carrinho" className="relative">
                <ShoppingBag className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
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
          <div className="border-t border-border md:hidden">
            <nav className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <h3 className="font-display text-lg">{settings?.site_name ?? "Catálogo"}</h3>
            <p className="mt-2 text-sm text-muted-foreground text-balance-tight">
              {settings?.about ?? settings?.tagline ?? "Catálogo virtual de produtos."}
            </p>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {settings?.whatsapp && <p className="break-words">WhatsApp: {settings.whatsapp}</p>}
            {settings?.email && <p className="break-words">E-mail: {settings.email}</p>}
            {settings?.instagram && <p className="break-words">Instagram: {settings.instagram}</p>}
          </div>
          <div className="text-sm text-muted-foreground">
            {settings?.address && <p className="break-words">{settings.address}</p>}
            <p className="mt-3">
              © {new Date().getFullYear()} {settings?.site_name ?? "Catálogo"}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
