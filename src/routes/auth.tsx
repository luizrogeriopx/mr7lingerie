import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Painel do catálogo" },
      {
        name: "description",
        content: "Acesse o painel administrativo do catálogo para gerenciar produtos e pedidos.",
      },
      { property: "og:title", content: "Entrar — Painel do catálogo" },
      { property: "og:description", content: "Acesso ao painel administrativo do catálogo." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/admin", replace: true });
  };

  return (
    <SiteShell>
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center sm:px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Área restrita</p>
        <h1 className="mt-3 font-display text-3xl">Painel do catálogo</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Entre com sua conta Google para gerenciar produtos, atributos, pedidos e as informações do
          site.
        </p>
        <Button className="mt-8 w-full" size="lg" onClick={signIn} disabled={loading}>
          {loading ? "Abrindo..." : "Entrar com Google"}
        </Button>
      </div>
    </SiteShell>
  );
}
