import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { RECOMENDADOS, MODULO_LABEL } from "@/lib/rubros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alta-cliente")({
  component: AltaClientePage,
});

type Plantilla = {
  label: string;
  etapas: string[];
  campos: { nombre: string; tipo: string; opciones: string[] }[];
  bot: { nombre_bot: string; mensaje_bienvenida: string; instrucciones: string };
};

const PLANTILLAS: Record<string, Plantilla> = {
  abogado: {
    label: "Abogado / Estudio jurídico",
    etapas: ["Consulta", "Análisis de caso", "Contrato", "Ganado", "Perdido"],
    campos: [
      { nombre: "N° de Expediente", tipo: "texto", opciones: [] },
      { nombre: "Tipo de caso", tipo: "lista", opciones: ["Penal", "Civil", "Laboral", "Familia"] },
    ],
    bot: {
      nombre_bot: "Asistente Legal",
      mensaje_bienvenida:
        "Hola 👋 Soy el asistente del estudio. ¿En qué tema legal te puedo ayudar?",
      instrucciones:
        "Sos el asistente de un estudio jurídico. Respondé con claridad y profesionalismo. Si la consulta requiere un abogado, ofrecé agendar una consulta. No des asesoramiento legal definitivo.",
    },
  },
  contador: {
    label: "Contador / Estudio contable",
    etapas: ["Consulta", "Propuesta enviada", "Cliente", "Perdido"],
    campos: [
      { nombre: "Servicio", tipo: "lista", opciones: ["Monotributo", "Responsable Inscripto", "Sociedad", "Sueldos"] },
      { nombre: "CUIT", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente Contable",
      mensaje_bienvenida: "Hola 👋 ¿En qué te ayudo? Monotributo, impuestos, sueldos…",
      instrucciones:
        "Sos el asistente de un estudio contable. Respondé consultas generales sobre servicios (monotributo, impuestos, sueldos) y ofrecé agendar una reunión o pasar una propuesta. No des asesoramiento impositivo definitivo; derivá al contador.",
    },
  },
  medico: {
    label: "Médico / Consultorio",
    etapas: ["Cita solicitada", "Confirmada", "Atendido", "No asistió"],
    campos: [
      { nombre: "Obra social", tipo: "texto", opciones: [] },
      { nombre: "Motivo de consulta", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Consultorio",
      mensaje_bienvenida:
        "Hola 👋 Soy el asistente del consultorio. ¿Querés agendar una consulta?",
      instrucciones:
        "Sos el asistente de un consultorio médico. Sé cordial y claro. Ayudá a agendar turnos. No des diagnósticos ni indicaciones médicas; derivá siempre al profesional.",
    },
  },
  dentista: {
    label: "Odontólogo / Dentista",
    etapas: ["Consulta", "Turno agendado", "Atendido", "No asistió"],
    campos: [
      { nombre: "Obra social", tipo: "texto", opciones: [] },
      { nombre: "Tratamiento", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Consultorio",
      mensaje_bienvenida: "Hola 👋 ¿Querés agendar un turno o consultar por un tratamiento?",
      instrucciones:
        "Sos el asistente de un consultorio odontológico. Informá sobre tratamientos, obras sociales y horarios y ofrecé agendar un turno. No des diagnósticos; derivá al profesional.",
    },
  },
  psicologo: {
    label: "Psicólogo / Terapeuta",
    etapas: ["Primer contacto", "Sesión agendada", "Cliente", "Baja"],
    campos: [
      { nombre: "Modalidad", tipo: "lista", opciones: ["Presencial", "Online"] },
      { nombre: "Motivo", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Consultorio",
      mensaje_bienvenida: "Hola 👋 ¿Querés agendar una primera sesión? Te ayudo.",
      instrucciones:
        "Sos el asistente de un consultorio de psicología. Sé cálido, respetuoso y confidencial. Informá sobre modalidad (presencial/online) y honorarios y ofrecé agendar una sesión. No hagas terapia ni des diagnósticos; derivá al profesional.",
    },
  },
  nutricionista: {
    label: "Nutricionista",
    etapas: ["Consulta", "Primera cita", "Cliente", "Baja"],
    campos: [
      { nombre: "Objetivo", tipo: "lista", opciones: ["Bajar de peso", "Masa muscular", "Salud", "Deportivo"] },
      { nombre: "Plan", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente de Nutrición",
      mensaje_bienvenida: "Hola 👋 ¿Querés agendar una consulta? Contame tu objetivo.",
      instrucciones:
        "Sos el asistente de un consultorio de nutrición. Informá sobre planes y modalidad y ofrecé agendar una consulta. Sé motivador; no des indicaciones médicas, derivá al profesional.",
    },
  },
  estetica: {
    label: "Estética / Spa",
    etapas: ["Consulta", "Turno", "Atendido", "No asistió"],
    campos: [
      { nombre: "Tratamiento", tipo: "texto", opciones: [] },
      { nombre: "Zona a tratar", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Centro",
      mensaje_bienvenida:
        "Hola 👋 ¿Qué tratamiento te interesa? Te ayudo a reservar un turno.",
      instrucciones:
        "Sos el asistente de un centro de estética/salud. Informá sobre tratamientos y ofrecé reservar un turno. Sé cordial y cuidadoso; no des indicaciones médicas, derivá al profesional.",
    },
  },
  peluqueria: {
    label: "Peluquería / Barbería",
    etapas: ["Consulta", "Turno agendado", "Atendido", "No asistió"],
    campos: [
      { nombre: "Servicio", tipo: "lista", opciones: ["Corte", "Color", "Peinado", "Barba"] },
      { nombre: "Profesional", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Salón",
      mensaje_bienvenida: "Hola 👋 ¿Querés reservar un turno? Decime qué servicio y para cuándo.",
      instrucciones:
        "Sos el asistente de una peluquería/barbería. Informá servicios, precios y disponibilidad y ofrecé reservar un turno. Cercano y ágil.",
    },
  },
  veterinaria: {
    label: "Veterinaria",
    etapas: ["Consulta", "Turno agendado", "Atendido", "No asistió"],
    campos: [
      { nombre: "Mascota", tipo: "texto", opciones: [] },
      { nombre: "Motivo", tipo: "lista", opciones: ["Control", "Vacuna", "Urgencia", "Peluquería"] },
    ],
    bot: {
      nombre_bot: "Asistente de la Veterinaria",
      mensaje_bienvenida: "Hola 👋 ¿En qué podemos ayudar a tu mascota? Te ayudo a agendar un turno.",
      instrucciones:
        "Sos el asistente de una veterinaria. Informá servicios (controles, vacunas, urgencias) y ofrecé agendar un turno. Cálido; en urgencias, indicá contacto directo.",
    },
  },
  inmobiliaria: {
    label: "Inmobiliaria",
    etapas: ["Consulta", "Visita", "Reserva", "Cerrado", "Perdido"],
    campos: [
      { nombre: "Tipo de propiedad", tipo: "lista", opciones: ["Departamento", "Casa", "Local", "Terreno"] },
      { nombre: "Operación", tipo: "lista", opciones: ["Venta", "Alquiler"] },
      { nombre: "Zona", tipo: "texto", opciones: [] },
      { nombre: "Presupuesto", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente Inmobiliario",
      mensaje_bienvenida:
        "Hola 👋 Soy el asistente de la inmobiliaria. ¿Qué propiedad estás buscando?",
      instrucciones:
        "Sos el asistente de una inmobiliaria. Ayudá a entender qué busca el cliente (tipo de propiedad, zona, presupuesto, venta o alquiler) y ofrecé agendar una visita. Sé cordial y concreto.",
    },
  },
  constructora: {
    label: "Constructora / Reformas",
    etapas: ["Consulta", "Visita técnica", "Presupuesto", "Contratado", "Perdido"],
    campos: [
      { nombre: "Tipo de obra", tipo: "lista", opciones: ["Construcción", "Reforma", "Ampliación", "Pintura"] },
      { nombre: "Zona", tipo: "texto", opciones: [] },
      { nombre: "Presupuesto estimado", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente de Obras",
      mensaje_bienvenida:
        "Hola 👋 ¿Qué obra o reforma tenés en mente? Coordinamos una visita y te pasamos un presupuesto.",
      instrucciones:
        "Sos el asistente de una constructora/empresa de reformas. Entendé qué necesita el cliente (tipo de obra, zona) y ofrecé coordinar una visita técnica para presupuestar. Serio y confiable.",
    },
  },
  hogar: {
    label: "Servicios del hogar",
    etapas: ["Consulta", "Presupuesto", "Agendado", "Finalizado", "Perdido"],
    campos: [
      { nombre: "Servicio", tipo: "lista", opciones: ["Plomería", "Electricidad", "Gas", "Pintura", "Flete", "Otro"] },
      { nombre: "Zona", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente de Servicios",
      mensaje_bienvenida: "Hola 👋 ¿Qué necesitás resolver en tu casa? Te paso un presupuesto y coordinamos.",
      instrucciones:
        "Sos el asistente de un servicio para el hogar (plomería, electricidad, etc.). Entendé el problema y la zona y ofrecé un presupuesto y coordinar una visita. Rápido y resolutivo.",
    },
  },
  taller: {
    label: "Taller mecánico",
    etapas: ["Consulta", "Presupuesto", "En reparación", "Entregado", "Perdido"],
    campos: [
      { nombre: "Vehículo", tipo: "texto", opciones: [] },
      { nombre: "Patente", tipo: "texto", opciones: [] },
      { nombre: "Servicio", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Taller",
      mensaje_bienvenida: "Hola 👋 ¿Qué necesita tu vehículo? Te paso un presupuesto o agendamos.",
      instrucciones:
        "Sos el asistente de un taller mecánico. Pedí datos del vehículo y el problema y ofrecé pasar un presupuesto o agendar un turno. Claro y confiable.",
    },
  },
  automotriz: {
    label: "Concesionaria / Autos",
    etapas: ["Consulta", "Visita / Test drive", "Negociación", "Vendido", "Perdido"],
    campos: [
      { nombre: "Modelo de interés", tipo: "texto", opciones: [] },
      { nombre: "Operación", tipo: "lista", opciones: ["0km", "Usado", "Plan de ahorro"] },
      { nombre: "Permuta", tipo: "lista", opciones: ["Sí", "No"] },
    ],
    bot: {
      nombre_bot: "Asistente de la Concesionaria",
      mensaje_bienvenida: "Hola 👋 ¿Qué vehículo estás buscando? Te ayudo con info y a coordinar una visita.",
      instrucciones:
        "Sos el asistente de una concesionaria. Informá modelos, financiación y planes y ofrecé coordinar una visita o test drive. Orientado a la venta, sin presionar.",
    },
  },
  gimnasio: {
    label: "Gimnasio / Estudio",
    etapas: ["Consulta", "Clase de prueba", "Inscripto", "Baja"],
    campos: [
      { nombre: "Plan", tipo: "lista", opciones: ["Mensual", "Trimestral", "Anual"] },
      { nombre: "Objetivo", tipo: "texto", opciones: [] },
      { nombre: "Vencimiento", tipo: "fecha", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Gym",
      mensaje_bienvenida: "Hola 👋 ¿Querés info de planes o agendar una clase de prueba?",
      instrucciones:
        "Sos el asistente de un gimnasio/estudio. Informá sobre planes y horarios y ofrecé agendar una clase de prueba. Sé motivador y cercano.",
    },
  },
  academia: {
    label: "Academia / Cursos",
    etapas: ["Consulta", "Clase de prueba", "Inscripto", "Baja"],
    campos: [
      { nombre: "Curso", tipo: "texto", opciones: [] },
      { nombre: "Modalidad", tipo: "lista", opciones: ["Presencial", "Online"] },
    ],
    bot: {
      nombre_bot: "Asistente de la Academia",
      mensaje_bienvenida: "Hola 👋 ¿Qué curso te interesa? Te paso info y coordinamos una clase de prueba.",
      instrucciones:
        "Sos el asistente de una academia/instituto de cursos (idiomas, oficios, música, etc.). Informá cursos, horarios, modalidad y precios y ofrecé una clase de prueba o inscripción. Motivador.",
    },
  },
  escuela: {
    label: "Escuela / Instituto",
    etapas: ["Consulta", "Visita agendada", "Entrevista", "Inscripto", "No concretó"],
    campos: [
      { nombre: "Nivel", tipo: "lista", opciones: ["Inicial", "Primaria", "Secundaria"] },
      { nombre: "Año de ingreso", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente de la Escuela",
      mensaje_bienvenida:
        "Hola 👋 Soy el asistente de la escuela. ¿Querés info de vacantes, aranceles o agendar una visita?",
      instrucciones:
        "Sos el asistente de una escuela/instituto. Informá sobre vacantes, niveles, aranceles, horarios y requisitos de inscripción con la información de la institución. Ofrecé agendar una visita o entrevista. Cálido y claro; si no sabés algo, derivá a la secretaría.",
    },
  },
  restaurante: {
    label: "Restaurante / Gastronomía",
    etapas: ["Consulta", "Reserva", "Atendido", "Cancelado"],
    campos: [
      { nombre: "Personas", tipo: "texto", opciones: [] },
      { nombre: "Fecha y hora", tipo: "texto", opciones: [] },
      { nombre: "Ocasión", tipo: "lista", opciones: ["Cumpleaños", "Familiar", "Empresa", "Otro"] },
    ],
    bot: {
      nombre_bot: "Asistente del Restaurante",
      mensaje_bienvenida: "Hola 👋 ¿Querés reservar una mesa? Decime día, horario y cuántas personas.",
      instrucciones:
        "Sos el asistente de un restaurante. Tomá reservas (fecha, horario, cantidad de personas), informá sobre el menú y horarios. Cordial y rápido.",
    },
  },
  turismo: {
    label: "Agencia de viajes / Turismo",
    etapas: ["Consulta", "Cotización enviada", "Reserva", "Cerrado", "Perdido"],
    campos: [
      { nombre: "Destino", tipo: "texto", opciones: [] },
      { nombre: "Fecha", tipo: "texto", opciones: [] },
      { nombre: "Pasajeros", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente de Viajes",
      mensaje_bienvenida: "Hola 👋 ¿A dónde querés viajar? Contame destino y fechas y te armo una cotización.",
      instrucciones:
        "Sos el asistente de una agencia de viajes. Pedí destino, fechas y cantidad de pasajeros y ofrecé enviar una cotización. Entusiasta y claro.",
    },
  },
  seguros: {
    label: "Seguros",
    etapas: ["Consulta", "Cotización", "Cliente", "Perdido"],
    campos: [
      { nombre: "Tipo de seguro", tipo: "lista", opciones: ["Auto", "Hogar", "Vida", "Comercio"] },
      { nombre: "Compañía", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente de Seguros",
      mensaje_bienvenida: "Hola 👋 ¿Qué seguro necesitás? Auto, hogar, vida… te cotizo.",
      instrucciones:
        "Sos el asistente de un productor de seguros. Pedí qué seguro necesita (auto, hogar, vida) y datos básicos y ofrecé pasar una cotización. Claro y confiable.",
    },
  },
  comercio: {
    label: "Comercio / PyME",
    etapas: ["Contacto", "Presupuesto", "Negociación", "Venta", "Perdido"],
    campos: [
      { nombre: "Producto/Servicio", tipo: "texto", opciones: [] },
      { nombre: "Monto estimado", tipo: "texto", opciones: [] },
      { nombre: "Origen", tipo: "lista", opciones: ["Instagram", "WhatsApp", "Recomendación", "Web"] },
    ],
    bot: {
      nombre_bot: "Asistente de Ventas",
      mensaje_bienvenida: "Hola 👋 ¿En qué producto o servicio estás interesado?",
      instrucciones:
        "Sos el asistente de un comercio/PyME. Respondé consultas sobre productos y precios y ofrecé pasar un presupuesto o agendar. Sé claro y orientado a la venta sin ser invasivo.",
    },
  },
  otro: {
    label: "Otro",
    etapas: ["Nuevo", "En proceso", "Ganado", "Perdido"],
    campos: [],
    bot: {
      nombre_bot: "Asistente",
      mensaje_bienvenida: "Hola 👋 ¿En qué te puedo ayudar?",
      instrucciones:
        "Sos un asistente cordial y servicial. Respondé las consultas y ofrecé agendar cuando corresponda.",
    },
  },
};

// Ficha de conocimiento que se siembra para el bot por rubro (el cliente la edita con sus precios/horarios).
const CONOCIMIENTO_RUBRO: Record<string, string> = {
  abogado:
    "Somos un estudio jurídico. Atendemos consultas en distintas áreas (penal, civil, laboral, familia). Para avanzar pedimos el motivo de la consulta y coordinamos una reunión con un abogado. Los honorarios se informan según el caso.",
  contador:
    "Somos un estudio contable. Ofrecemos monotributo, responsable inscripto, sociedades y liquidación de sueldos. Para asesorarte pedimos qué necesitás y coordinamos una reunión. Los honorarios dependen del servicio.",
  medico:
    "Somos un consultorio médico. Atendemos por turno. Para agendar pedimos nombre, motivo de consulta y obra social. Los horarios y aranceles los confirma la secretaría.",
  dentista:
    "Somos un consultorio odontológico. Ofrecemos consultas, limpieza, ortodoncia, implantes y blanqueamiento. Para un turno pedimos nombre y motivo. Obras sociales y precios los confirma el equipo.",
  psicologo:
    "Somos un consultorio de psicología. Atendemos en modalidad presencial y online. Para una primera sesión pedimos nombre y un breve motivo. Los honorarios se informan al coordinar.",
  nutricionista:
    "Somos un consultorio de nutrición. Ayudamos con planes para bajar de peso, salud, masa muscular o deportivos. Para una consulta pedimos tu objetivo y coordinamos día y horario.",
  estetica:
    "Somos un centro de estética. Ofrecemos distintos tratamientos faciales y corporales. Para reservar pedimos qué tratamiento te interesa y coordinamos un turno. Precios y duración se informan según el tratamiento.",
  peluqueria:
    "Somos una peluquería/barbería. Ofrecemos corte, color, peinado y barba. Para reservar un turno pedimos el servicio y el día preferido. Los precios varían según el servicio.",
  veterinaria:
    "Somos una veterinaria. Atendemos controles, vacunas, urgencias y peluquería de mascotas. Para un turno pedimos el nombre de la mascota y el motivo. En urgencias indicá contacto directo.",
  inmobiliaria:
    "Somos una inmobiliaria. Operamos venta y alquiler de departamentos, casas, locales y terrenos. Para ayudarte pedimos qué buscás (tipo, zona, presupuesto) y coordinamos una visita.",
  constructora:
    "Hacemos construcción, reformas, ampliaciones y pintura. Para presupuestar pedimos el tipo de obra y la zona, y coordinamos una visita técnica.",
  hogar:
    "Ofrecemos servicios para el hogar (plomería, electricidad, gas, pintura, fletes). Para ayudarte pedimos qué necesitás y la zona, y coordinamos una visita o presupuesto.",
  taller:
    "Somos un taller mecánico. Hacemos diagnósticos, reparaciones y service. Para presupuestar pedimos datos del vehículo y el problema, y coordinamos un turno.",
  automotriz:
    "Somos una concesionaria. Vendemos 0km y usados, con financiación y planes de ahorro. Para asesorarte pedimos qué modelo te interesa y coordinamos una visita o test drive.",
  gimnasio:
    "Somos un gimnasio/estudio. Ofrecemos distintos planes y actividades. Para sumarte contamos los planes y coordinamos una clase de prueba. Horarios y precios se informan según el plan.",
  academia:
    "Somos una academia de cursos. Ofrecemos cursos presenciales y online. Para sumarte contamos el curso, la modalidad y los horarios, y coordinamos una clase de prueba.",
  escuela:
    "Somos una institución educativa. Informamos sobre vacantes, niveles, aranceles y requisitos de inscripción. Para avanzar ofrecemos coordinar una visita o entrevista. Los detalles los confirma la secretaría.",
  restaurante:
    "Somos un restaurante. Tomamos reservas y consultas sobre el menú. Para reservar pedimos día, horario y cantidad de personas.",
  turismo:
    "Somos una agencia de viajes. Armamos viajes a distintos destinos. Para cotizar pedimos destino, fechas y cantidad de pasajeros.",
  seguros:
    "Somos productores de seguros. Ofrecemos seguros de auto, hogar, vida y comercio. Para cotizar pedimos qué seguro necesitás y algunos datos básicos.",
  comercio:
    "Somos un comercio. Vendemos distintos productos y servicios. Para ayudarte respondemos sobre productos, precios y formas de pago, y coordinamos la compra o un presupuesto.",
  otro:
    "Atendemos las consultas de nuestros clientes y coordinamos lo que necesiten. Para ayudarte mejor, contanos qué buscás.",
};

// Automatización de seguimiento lista por rubro (se activa al prender el módulo Automatizaciones).
const AUTOMATIZACION_RUBRO: Record<string, { nombre: string; tarea_titulo: string; tarea_dias: number }> = {
  abogado: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Llamar para coordinar la consulta", tarea_dias: 1 },
  contador: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Contactar para coordinar reunión", tarea_dias: 1 },
  medico: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Confirmar el turno", tarea_dias: 1 },
  dentista: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Confirmar el turno", tarea_dias: 1 },
  psicologo: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Contactar para la primera sesión", tarea_dias: 1 },
  nutricionista: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Contactar para la consulta", tarea_dias: 1 },
  estetica: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Confirmar el turno", tarea_dias: 1 },
  peluqueria: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Confirmar el turno", tarea_dias: 1 },
  veterinaria: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Confirmar el turno", tarea_dias: 1 },
  inmobiliaria: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Llamar para coordinar la visita", tarea_dias: 1 },
  constructora: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Coordinar visita técnica", tarea_dias: 2 },
  hogar: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Pasar presupuesto", tarea_dias: 1 },
  taller: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Pasar presupuesto o coordinar turno", tarea_dias: 1 },
  automotriz: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Llamar y coordinar test drive", tarea_dias: 1 },
  gimnasio: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Invitar a la clase de prueba", tarea_dias: 1 },
  academia: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Invitar a la clase de prueba", tarea_dias: 1 },
  escuela: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Coordinar visita o entrevista", tarea_dias: 2 },
  restaurante: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Confirmar la reserva", tarea_dias: 1 },
  turismo: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Enviar la cotización", tarea_dias: 1 },
  seguros: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Enviar la cotización", tarea_dias: 1 },
  comercio: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Contactar y pasar presupuesto", tarea_dias: 1 },
  otro: { nombre: "Seguir a cada lead nuevo", tarea_titulo: "Contactar al lead", tarea_dias: 1 },
};

function tipoDeEtapa(nombre: string): string {
  const n = nombre.toLowerCase();
  if (
    n.includes("ganado") ||
    n.includes("contrato") ||
    n.includes("contratado") ||
    n.includes("cliente") ||
    n.includes("atendido") ||
    n.includes("cerrado") ||
    n.includes("inscripto") ||
    n.includes("entregado") ||
    n.includes("finalizado") ||
    n.includes("venta") ||
    n.includes("vendido")
  )
    return "ganado";
  if (
    n.includes("perdido") ||
    n.includes("no asist") ||
    n.includes("no concret") ||
    n.includes("baja") ||
    n.includes("cancelad")
  )
    return "perdido";
  return "normal";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function AltaClientePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("abogado");
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState("prueba");

  // Paso 2 (bot, prellenado desde la plantilla)
  const [botNombre, setBotNombre] = useState("");
  const [botBienvenida, setBotBienvenida] = useState("");
  const [botInstrucciones, setBotInstrucciones] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plantilla = PLANTILLAS[rubro] ?? PLANTILLAS.otro;

  function irAPaso2(e: React.FormEvent) {
    e.preventDefault();
    const p = PLANTILLAS[rubro] ?? PLANTILLAS.otro;
    setBotNombre(p.bot.nombre_bot);
    setBotBienvenida(p.bot.mensaje_bienvenida);
    setBotInstrucciones(p.bot.instrucciones);
    setStep(2);
  }

  async function crear() {
    setSaving(true);
    setError(null);

    const { data: prof, error: e1 } = await supabase
      .from("profesionales")
      .insert({ nombre, rubro, email_contacto: email, estado })
      .select("id")
      .single();
    if (e1 || !prof) {
      setError(e1?.message ?? "No se pudo crear el cliente.");
      setSaving(false);
      return;
    }
    const pid = prof.id as string;

    if (plantilla.etapas.length > 0) {
      const { error: e2 } = await supabase.from("etapas_pipeline").insert(
        plantilla.etapas.map((n, i) => ({
          profesional_id: pid,
          nombre: n,
          orden: i,
          tipo: tipoDeEtapa(n),
        })),
      );
      if (e2) {
        setError(e2.message);
        setSaving(false);
        return;
      }
    }

    if (plantilla.campos.length > 0) {
      const { error: e3 } = await supabase.from("campos_personalizados").insert(
        plantilla.campos.map((c, i) => ({
          profesional_id: pid,
          nombre: c.nombre,
          clave: slugify(c.nombre),
          tipo: c.tipo,
          opciones: c.opciones,
          orden: i,
        })),
      );
      if (e3) {
        setError(e3.message);
        setSaving(false);
        return;
      }
    }

    const { error: e4 } = await supabase.from("bot_config").insert({
      profesional_id: pid,
      nombre_bot: botNombre,
      mensaje_bienvenida: botBienvenida,
      instrucciones: botInstrucciones,
      modelo_ia: "claude-haiku-4-5",
      activo: true,
    });
    if (e4) {
      setError(e4.message);
      setSaving(false);
      return;
    }

    // Pre-carga por rubro (no bloquea el alta si algo falla).
    const conocimiento = CONOCIMIENTO_RUBRO[rubro];
    if (conocimiento) {
      await supabase.from("documentos").insert({
        profesional_id: pid,
        nombre_archivo: "Información del negocio",
        contenido: conocimiento,
        tipo: "texto",
        estado: "listo",
      });
    }
    const auto = AUTOMATIZACION_RUBRO[rubro];
    if (auto) {
      await supabase.from("reglas_automatizacion").insert({
        profesional_id: pid,
        nombre: auto.nombre,
        evento: "lead_nuevo",
        accion: "crear_tarea",
        tarea_titulo: auto.tarea_titulo,
        tarea_dias: auto.tarea_dias,
        activa: true,
      });
    }

    setSaving(false);
    navigate({ to: "/clientes" });
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          to="/clientes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Clientes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Alta de cliente</h1>
        <p className="text-sm text-muted-foreground">
          Paso {step} de 2 — en pocos pasos queda todo configurado
        </p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos del cliente</CardTitle>
            <CardDescription>
              Según el rubro, le armamos el embudo, los campos y el bot automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={irAPaso2} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alta-nombre">Nombre</Label>
                <Input
                  id="alta-nombre"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Estudio Pérez"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alta-rubro">Rubro</Label>
                  <Select value={rubro} onValueChange={setRubro}>
                    <SelectTrigger id="alta-rubro">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLANTILLAS).map(([key, p]) => (
                        <SelectItem key={key} value={key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alta-estado">Estado</Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger id="alta-estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prueba">Prueba</SelectItem>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alta-email">Email de contacto</Label>
                <Input
                  id="alta-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Siguiente</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Esto se va a crear automáticamente</CardTitle>
              <CardDescription>Plantilla del rubro {rubro}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">Etapas del embudo</p>
                <div className="flex flex-wrap gap-2">
                  {plantilla.etapas.map((et) => (
                    <span key={et} className="rounded-full border px-3 py-1 text-xs">
                      {et}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">Campos personalizados</p>
                {plantilla.campos.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Ninguno (lo podés agregar después)</p>
                ) : (
                  <ul className="list-disc list-inside text-muted-foreground">
                    {plantilla.campos.map((c) => (
                      <li key={c.nombre}>{c.nombre}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium mb-1">Se pre-carga también</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>Una ficha de conocimiento para el bot (editala después en Conocimiento).</li>
                  <li>Una automatización de seguimiento lista (se activa con el módulo Automatizaciones).</li>
                </ul>
              </div>
              {(RECOMENDADOS[rubro] ?? []).length > 0 && (
                <div>
                  <p className="font-medium mb-1">Complementos recomendados para este rubro</p>
                  <div className="flex flex-wrap gap-2">
                    {(RECOMENDADOS[rubro] ?? []).map((k) => (
                      <span
                        key={k}
                        className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium"
                      >
                        {MODULO_LABEL[k] ?? k}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Los prendés (y vendés) desde Configuración cuando el cliente los necesite.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personalidad del bot</CardTitle>
              <CardDescription>Ya viene prellenada — ajustala si querés.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alta-bot-nombre">Nombre del bot</Label>
                <Input
                  id="alta-bot-nombre"
                  value={botNombre}
                  onChange={(e) => setBotNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alta-bot-bienvenida">Mensaje de bienvenida</Label>
                <Textarea
                  id="alta-bot-bienvenida"
                  rows={2}
                  value={botBienvenida}
                  onChange={(e) => setBotBienvenida(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alta-bot-instrucciones">Instrucciones</Label>
                <Textarea
                  id="alta-bot-instrucciones"
                  rows={4}
                  value={botInstrucciones}
                  onChange={(e) => setBotInstrucciones(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={saving}>
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
            <Button type="button" onClick={crear} disabled={saving || !nombre}>
              <Check className="h-4 w-4" />
              {saving ? "Creando..." : "Crear cliente y configurar todo"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
