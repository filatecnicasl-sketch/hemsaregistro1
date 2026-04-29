import { DEPT_LABEL, formatDateShort } from "./constants";

/** Reemplaza {{placeholder}} en un texto con datos del documento + usuario. */
export function buildPlaceholderData(doc, user) {
  const today = new Date();
  return {
    numero_entrada: doc?.entry_number || "",
    remitente: doc?.sender || "",
    asunto: doc?.subject || "",
    descripcion: doc?.description || "",
    fecha_actual: today.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    fecha_recepcion: formatDateShort(doc?.received_at) || "",
    usuario: user?.name || "",
    departamento: user?.department ? DEPT_LABEL[user.department] : "",
  };
}

export function interpolate(text, data) {
  if (!text) return "";
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(data, k) ? data[k] : m
  );
}

export const TEMPLATE_CATEGORIES = [
  { value: "acuse", label: "Acuse de recibo" },
  { value: "requerimiento", label: "Requerimiento" },
  { value: "resolucion", label: "Resolución" },
  { value: "notificacion", label: "Notificación" },
  { value: "informe", label: "Informe" },
  { value: "otro", label: "Otro" },
];
export const TPL_CAT_LABEL = Object.fromEntries(
  TEMPLATE_CATEGORIES.map((c) => [c.value, c.label])
);
