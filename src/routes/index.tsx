import { createFileRoute, Link } from "@tanstack/react-router";
import { MARCA, MARCA_INICIAL } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Workflow,
  CalendarDays,
  Zap,
  BarChart3,
  MessagesSquare,
  Megaphone,
  CalendarCheck,
  LayoutDashboard,
  ArrowRight,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${MARCA} — CRM con WhatsApp e IA` },
      {
        name: "description",
        content:
          "El CRM que atiende por WhatsApp con IA, agenda las citas y ordena tus ventas. Para profesionales y comercios.",
      },
    ],
  }),
  component: LandingPage,
});

// Si querés que los botones "Pedir demo" abran tu WhatsApp, poné acá tu número
// (código de país + número, sin espacios ni signos). Si lo dejás vacío, llevan al login.
const WHATSAPP = ""; // ej: "5491122334455"
const demoHref = WHATSAPP ? `https://wa.me/${WHATSAPP}` : "/login";

const FUNCIONES = [
  {
    icon: Bot,
    titulo: "Atención 24/7 con IA",
    desc: "Responde al instante por WhatsApp, evacúa dudas y califica al cliente. De día y de noche, sin que estés vos.",
  },
  {
    icon: Workflow,
    titulo: "Embudo de ventas",
    desc: "Cada contacto cae en una etapa. Ves quién está por comprar y a quién hay que seguir, de un vistazo.",
  },
  {
    icon: CalendarDays,
    titulo: "Agenda y recordatorios",
    desc: "Las citas se agendan solas y manda recordatorios automáticos. Menos ausencias, más reuniones.",
  },
  {
    icon: Zap,
    titulo: "Automatizaciones",
    desc: "Tareas y seguimientos que se disparan solos cuando entra o avanza un cliente. Nada se te escapa.",
  },
  {
    icon: BarChart3,
    titulo: "Reportes claros",
    desc: "Cuántos contactos, cuántas ventas y cuánto facturás. Todo en números simples, sin planillas.",
  },
  {
    icon: MessagesSquare,
    titulo: "Bandeja unificada",
    desc: "Todas las charlas en un solo lugar. Cuando querés, apagás el bot y tomás vos la conversación.",
  },
];

const PASOS = [
  {
    icon: Megaphone,
    titulo: "Llega el contacto",
    desc: "Desde tu anuncio, tu web o tu WhatsApp, el cliente escribe.",
  },
  {
    icon: Bot,
    titulo: "La IA responde",
    desc: "Contesta al toque, resuelve dudas y detecta si está listo para comprar.",
  },
  {
    icon: CalendarCheck,
    titulo: "Agenda la cita",
    desc: "Le ofrece horarios y la reserva sola, sin idas y vueltas.",
  },
  {
    icon: LayoutDashboard,
    titulo: "Vos cerrás",
    desc: "Llegás con todo ordenado en el CRM y te enfocás en vender.",
  },
];

const PLANES = [
  {
    nombre: "Inicial",
    ideal: "Para arrancar a ordenar tu negocio",
    destacado: false,
    features: [
      "Bot de IA por WhatsApp",
      "Embudo de ventas",
      "Agenda con recordatorios",
      "Bandeja unificada de chats",
    ],
  },
  {
    nombre: "Pro",
    ideal: "El más elegido por los que ya venden",
    destacado: true,
    features: [
      "Todo lo de Inicial",
      "Automatizaciones",
      "Reportes de ventas",
      "Productos y stock",
    ],
  },
  {
    nombre: "A medida",
    ideal: "Para equipos y comercios grandes",
    destacado: false,
    features: [
      "Todo lo de Pro",
      "Varios usuarios y equipo",
      "Pagos y proyección",
      "Tu propia marca (white-label)",
    ],
  },
];

function DemoButton({
  children,
  size,
  variant,
  className,
}: {
  children: React.ReactNode;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}) {
  const btn = (
    <Button size={size} variant={variant} className={className}>
      {children}
    </Button>
  );
  if (WHATSAPP) {
    return (
      <a href={demoHref} target="_blank" rel="noreferrer">
        {btn}
      </a>
    );
  }
  return <Link to="/login">{btn}</Link>;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-sm font-bold text-background">
              {MARCA_INICIAL}
            </div>
            <span className="text-base font-semibold tracking-tight">{MARCA}</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#funciones" className="transition-colors hover:text-foreground">Funciones</a>
            <a href="#como" className="transition-colors hover:text-foreground">Cómo funciona</a>
            <a href="#planes" className="transition-colors hover:text-foreground">Planes</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Acceder</Button>
            </Link>
            <DemoButton size="sm">Pedir demo</DemoButton>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              WhatsApp + Inteligencia Artificial
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Tu negocio, atendiendo y vendiendo solo.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              El CRM que responde por WhatsApp con IA, agenda las citas y ordena a cada cliente en un
              embudo. Para que no se te escape ninguna venta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <DemoButton size="lg">
                Pedir una demo
                <ArrowRight className="h-4 w-4" />
              </DemoButton>
              <Link to="/login">
                <Button size="lg" variant="outline">Acceder a mi panel</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sin instalar nada · Listo en días · Adaptado a tu rubro
            </p>
          </div>

          {/* DEMO VISUAL: chat de WhatsApp atendido por la IA */}
          <div className="relative">
            <div className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />
            <div className="relative rounded-2xl border bg-card p-4 shadow-xl">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                  IA
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-medium">Asistente de {MARCA}</p>
                  <p className="text-[11px] text-muted-foreground">en línea</p>
                </div>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                  WhatsApp
                </span>
              </div>
              <div className="space-y-2 py-4 text-sm">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-secondary px-3 py-2">
                  Hola, quería sacar un turno 🙌
                </div>
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-foreground px-3 py-2 text-background">
                  ¡Hola! Claro. Tengo el martes 10:00 o el miércoles 15:00. ¿Cuál te queda mejor?
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-secondary px-3 py-2">
                  El martes 10 está perfecto
                </div>
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-foreground px-3 py-2 text-background">
                  ¡Listo! Te agendé el martes 10:00. Te llega un recordatorio el día anterior ✅
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                Cita agendada · CRM actualizado · sin que muevas un dedo
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONFIANZA */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Pensado para <strong className="text-foreground">profesionales y comercios</strong>: salud,
            legales, estética, inmobiliarias, gimnasios, educación y más.
          </p>
        </div>
      </section>

      {/* FUNCIONES */}
      <section id="funciones" className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Todo tu negocio, en un solo lugar</h2>
          <p className="mt-3 text-muted-foreground">
            Dejá de saltar entre WhatsApp, la agenda y las planillas. {MARCA} junta todo y lo hace
            trabajar por vos.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.titulo} className="rounded-2xl border bg-card p-6 transition-colors hover:border-foreground/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como" className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              De un mensaje a una venta, casi solo
            </h2>
            <p className="mt-3 text-muted-foreground">
              El mismo recorrido que hoy te come horas, hecho automático.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {PASOS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.titulo} className="relative rounded-2xl border bg-card p-6">
                  <span className="absolute right-5 top-5 text-2xl font-bold text-muted-foreground/20">
                    {i + 1}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{p.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Planes que se adaptan a tu negocio</h2>
          <p className="mt-3 text-muted-foreground">
            Elegís el que va con tu momento y lo escalás cuando quieras.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANES.map((pl) => (
            <div
              key={pl.nombre}
              className={`flex flex-col rounded-2xl border p-6 ${
                pl.destacado ? "border-foreground bg-card shadow-lg ring-1 ring-foreground" : "bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{pl.nombre}</h3>
                {pl.destacado && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                    Recomendado
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{pl.ideal}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {pl.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <DemoButton
                size="default"
                variant={pl.destacado ? "default" : "outline"}
                className="mt-6 w-full"
              >
                Pedir una demo
              </DemoButton>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿No sabés cuál te conviene? Pedinos una demo y lo vemos juntos.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl rounded-2xl bg-foreground px-8 py-16 text-center text-background">
          <h2 className="text-3xl font-semibold tracking-tight">Empezá a vender con menos esfuerzo</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-background/70">
            Te mostramos en 15 minutos cómo quedaría funcionando en tu negocio.
          </p>
          <div className="mt-8 flex justify-center">
            <DemoButton size="lg" variant="secondary">
              Pedir una demo
              <ArrowRight className="h-4 w-4" />
            </DemoButton>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
              {MARCA_INICIAL}
            </div>
            <span className="text-sm font-semibold">{MARCA}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {MARCA}. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
