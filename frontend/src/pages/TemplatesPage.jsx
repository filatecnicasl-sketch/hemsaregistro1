import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { TEMPLATE_CATEGORIES, TPL_CAT_LABEL } from "../lib/templates";
import { formatDate } from "../lib/constants";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Layers } from "lucide-react";

const PLACEHOLDERS = [
  "numero_entrada",
  "remitente",
  "asunto",
  "fecha_actual",
  "fecha_recepcion",
  "usuario",
  "departamento",
];

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "otro",
    subject: "",
    body: "",
  });
  const [error, setError] = useState("");

  const canEdit = user?.role === "admin" || user?.role === "jefe_departamento" || user?.role === "recepcionista";
  const canDelete = user?.role === "admin";

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/templates");
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", category: "otro", subject: "", body: "" });
    setError("");
    setOpen(true);
  }

  function openEdit(t) {
    setEditing(t);
    setForm({
      name: t.name,
      category: t.category,
      subject: t.subject,
      body: t.body,
    });
    setError("");
    setOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.patch(`/templates/${editing.id}`, form);
        toast.success("Plantilla actualizada");
      } else {
        await api.post("/templates", form);
        toast.success("Plantilla creada");
      }
      setOpen(false);
      await reload();
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail));
    }
  }

  async function onDelete(t) {
    if (!window.confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    try {
      await api.delete(`/templates/${t.id}`);
      toast.success("Plantilla eliminada");
      reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  }

  function insertPlaceholder(field, ph) {
    setForm((f) => ({ ...f, [field]: `${f[field] || ""}{{${ph}}}` }));
  }

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Biblioteca
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            Plantillas de respuesta
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Modelos reutilizables para acuses, requerimientos, resoluciones, notificaciones e
            informes. Usa marcadores como <code className="font-mono text-xs bg-slate-100 px-1">{"{{numero_entrada}}"}</code> para datos dinámicos.
          </p>
        </div>
        {canEdit && (
          <button
            data-testid="templates-create-btn"
            onClick={openCreate}
            className="btn-primary px-5 py-2.5 text-sm font-medium rounded-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva plantilla
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Cargando...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-border/60 p-12 text-center text-sm text-slate-500">
          <Layers className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          Aún no hay plantillas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              data-testid={`template-card-${t.id}`}
              className="bg-white border border-border/60 p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold">
                    {TPL_CAT_LABEL[t.category] || t.category}
                  </div>
                  <div className="font-display text-lg font-medium text-slate-900 mt-1 truncate">
                    {t.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{t.subject}</div>
                </div>
                {canEdit && (
                  <div className="flex flex-col gap-1">
                    <button
                      data-testid={`template-edit-${t.id}`}
                      onClick={() => openEdit(t)}
                      className="p-1.5 hover:bg-slate-100 rounded-sm border border-border bg-white"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4 text-slate-700" />
                    </button>
                    {canDelete && (
                      <button
                        data-testid={`template-delete-${t.id}`}
                        onClick={() => onDelete(t)}
                        className="p-1.5 hover:bg-red-50 rounded-sm border border-border bg-white"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans bg-slate-50/60 border border-border/40 p-3 rounded-sm h-36 overflow-hidden line-clamp-6">
{t.body}
              </pre>
              <div className="text-[11px] text-slate-500 border-t border-border/40 pt-2">
                Por {t.created_by_name} · {formatDate(t.updated_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
            <DialogDescription>
              Plantilla reutilizable. Inserta marcadores con doble llave que se sustituirán al usarla.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nombre
                </label>
                <input
                  data-testid="tpl-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Categoría
                </label>
                <select
                  data-testid="tpl-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                >
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Asunto
              </label>
              <input
                data-testid="tpl-subject"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Cuerpo
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">
                    Insertar:
                  </span>
                  {PLACEHOLDERS.map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => insertPlaceholder("body", ph)}
                      className="text-[11px] px-1.5 py-0.5 border border-border bg-slate-50 hover:bg-slate-100 rounded-sm font-mono"
                    >
                      {`{{${ph}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                data-testid="tpl-body"
                required
                rows={14}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black font-mono leading-relaxed"
              />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border bg-white text-slate-700 hover:bg-slate-50 rounded-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="tpl-submit"
                className="btn-primary px-4 py-2 text-sm font-medium rounded-sm"
              >
                {editing ? "Guardar" : "Crear"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
