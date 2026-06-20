// Qué módulos premium le conviene a cada rubro. Lo usan el alta de cliente
// (para mostrar la sugerencia) y Configuración (para el chip "Recomendado").
export const RECOMENDADOS: Record<string, string[]> = {
  abogado: ["pagos", "reportes"],
  contador: ["pagos", "reportes"],
  medico: ["equipo", "reportes"],
  dentista: ["equipo", "reportes"],
  psicologo: ["reportes"],
  nutricionista: ["reportes"],
  estetica: ["productos", "reportes"],
  peluqueria: ["productos", "equipo"],
  veterinaria: ["productos", "equipo"],
  inmobiliaria: ["pagos", "equipo"],
  constructora: ["pagos", "reportes"],
  hogar: ["pagos", "automatizaciones"],
  taller: ["productos", "pagos"],
  automotriz: ["pagos", "equipo"],
  gimnasio: ["productos", "equipo", "automatizaciones"],
  academia: ["pagos", "equipo"],
  escuela: ["equipo", "pagos"],
  restaurante: ["productos", "equipo"],
  turismo: ["pagos", "reportes"],
  seguros: ["pagos", "reportes"],
  comercio: ["productos", "pagos", "automatizaciones"],
  otro: [],
};

export const MODULO_LABEL: Record<string, string> = {
  automatizaciones: "Automatizaciones",
  productos: "Productos",
  equipo: "Equipo",
  reportes: "Reportes",
  pagos: "Pagos",
};
