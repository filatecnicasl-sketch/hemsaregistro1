export const DEPARTMENTS = [
  { value: "administracion", label: "Administración" },
  { value: "direccion", label: "Dirección" },
  { value: "tecnico", label: "Técnico" },
  { value: "coordinacion", label: "Coordinación" },
];

export const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "recepcionista", label: "Recepcionista" },
  { value: "jefe_departamento", label: "Jefe de Departamento" },
  { value: "personal", label: "Personal" },
];

export const MEDIUMS = [
  { value: "email", label: "Correo electrónico" },
  { value: "fisico", label: "Físico / Papel" },
  { value: "fax", label: "Fax" },
  { value: "web", label: "Web / Portal" },
  { value: "telefono", label: "Teléfono" },
  { value: "mensajeria", label: "Mensajería" },
  { value: "otro", label: "Otro" },
];

export const PRIORITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export const STATUSES = [
  { value: "recibido", label: "Recibido" },
  { value: "repartido", label: "Repartido" },
  { value: "asignado", label: "Asignado" },
  { value: "en_proceso", label: "En Proceso" },
  { value: "finalizado", label: "Finalizado" },
  { value: "archivado", label: "Archivado" },
];

const map = (arr) =>
  Object.fromEntries(arr.map((x) => [x.value, x.label]));

export const DEPT_LABEL = map(DEPARTMENTS);
export const ROLE_LABEL = map(ROLES);
export const MEDIUM_LABEL = map(MEDIUMS);
export const PRIORITY_LABEL = map(PRIORITIES);
export const STATUS_LABEL = map(STATUSES);

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatBytes(bytes) {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
