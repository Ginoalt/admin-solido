import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MARCA, MARCA_INICIAL } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

const BENEFICIOS = [
  "Atención por WhatsApp 24/7 con IA",
  "Embudo de ventas ordenado",
  "Agenda y recordatorios automáticos",
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/inicio" });
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel de marca (oculto en mobile) */}
      <div className="relative hidden lg:flex lg:w-[46%] flex-col justify-between overflow-hidden bg-foreground p-12 text-background">
        {/* brillo sutil de fondo */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-background/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-background/5 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-base font-bold text-foreground">
            {MARCA_INICIAL}
          </div>
          <span className="text-lg font-semibold tracking-tight">{MARCA}</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Tu negocio,
            <br />
            respondiendo solo.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-background/70">
            El CRM con WhatsApp e inteligencia artificial que atiende, ordena y le hace seguimiento a
            cada cliente. Para que no se te escape ninguna venta.
          </p>
          <ul className="mt-8 space-y-3">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-background/85">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/15">
                  <Check className="h-3 w-3" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-background/40">© {MARCA}</p>
      </div>

      {/* Panel del formulario */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* logo solo en mobile */}
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-base font-bold text-background">
              {MARCA_INICIAL}
            </div>
            <span className="text-lg font-semibold tracking-tight">{MARCA}</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Accedé a tu panel para gestionar tu negocio.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vos@tunegocio.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground">
            ¿No tenés acceso? Pedíselo a tu administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
