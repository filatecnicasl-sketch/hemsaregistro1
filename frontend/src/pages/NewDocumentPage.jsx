import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api, { formatApiError } from "../lib/api";
import { MEDIUMS, PRIORITIES } from "../lib/constants";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload } from "lucide-react";

export default function NewDocumentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    sender: "",
    subject: "",
    description: "",
    medium: "email",
    priority: "media",
    received_at: "",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.received_at) delete payload.received_at;
      else payload.received_at = new Date(payload.received_at).toISOString();
      const { data } = await api.post("/documents", payload);
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        try {
          await api.post(`/documents/${data.id}/upload`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (uploadErr) {
          toast.error("Documento creado, pero falló la subida del archivo");
        }
      }
      toast.success(`Documento ${data.entry_number} registrado`);
      navigate(`/documentos/${data.id}`);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <button
        data-testid="newdoc-back-btn"
        onClick={() => navigate(-1)}
        className="text-sm text-slate-600 hover:text-black inline-flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
          Nuevo registro
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 mt-1">
          Registrar entrada de documentación
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Cumplimenta los datos del documento recibido. Se generará un número
          de entrada único automáticamente.
        </p>

        <form onSubmit={onSubmit} className="mt-8 bg-white border border-border/60 p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Asunto *
            </label>
            <input
              data-testid="newdoc-subject-input"
              required
              value={form.subject}
              onChange={update("subject")}
              className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Remitente *
            </label>
            <input
              data-testid="newdoc-sender-input"
              required
              value={form.sender}
              onChange={update("sender")}
              placeholder="Persona / entidad emisora"
              className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Fecha de recepción
            </label>
            <input
              data-testid="newdoc-receivedat-input"
              type="datetime-local"
              value={form.received_at}
              onChange={update("received_at")}
              className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Medio de recepción *
            </label>
            <select
              data-testid="newdoc-medium-select"
              required
              value={form.medium}
              onChange={update("medium")}
              className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            >
              {MEDIUMS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Prioridad
            </label>
            <select
              data-testid="newdoc-priority-select"
              value={form.priority}
              onChange={update("priority")}
              className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Descripción / Notas
            </label>
            <textarea
              data-testid="newdoc-description-input"
              rows={4}
              value={form.description}
              onChange={update("description")}
              className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Archivo adjunto
            </label>
            <label
              htmlFor="file-input"
              className="flex items-center gap-3 border border-dashed border-border bg-slate-50/50 px-4 py-4 text-sm cursor-pointer hover:bg-slate-50 transition-colors rounded-sm"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              <div className="flex-1">
                <div className="font-medium text-slate-900">
                  {file ? file.name : "Selecciona un archivo (PDF, imagen, Office)"}
                </div>
                <div className="text-xs text-slate-500">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Máx 25 MB"}
                </div>
              </div>
            </label>
            <input
              id="file-input"
              data-testid="newdoc-file-input"
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {error && (
            <div
              data-testid="newdoc-error"
              className="md:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm"
            >
              {error}
            </div>
          )}

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              data-testid="newdoc-cancel-btn"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-sm font-medium border border-border bg-white text-slate-700 hover:bg-slate-50 rounded-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="newdoc-submit-btn"
              disabled={loading}
              className="bg-black text-white hover:bg-slate-800 px-5 py-2.5 text-sm font-medium rounded-sm flex items-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {loading ? "Guardando..." : "Registrar entrada"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
