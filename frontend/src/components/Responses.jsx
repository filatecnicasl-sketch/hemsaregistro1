import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../lib/constants";
import { buildPlaceholderData, interpolate, TPL_CAT_LABEL } from "../lib/templates";
import SignaturePad from "./SignaturePad";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { toast } from "sonner";
import { LOGO_URL, BRAND } from "../lib/brand";
import {
  PenSquare,
  ShieldCheck,
  Trash2,
  Pencil,
  FileSignature,
  Printer,
  Plus,
  X,
  Save,
} from "lucide-react";

function StatusPill({ status }) {
  const cls =
    status === "firmado"
      ? "bg-[#E6F8EF] text-[#168D5C] border-[#A7E5C7]"
      : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-sm border ${cls}`}>
      {status === "firmado" ? <ShieldCheck className="w-3 h-3" /> : <PenSquare className="w-3 h-3" />}
      {status === "firmado" ? "Firmada" : "Borrador"}
    </span>
  );
}

function buildPrintHtml(resp, doc) {
  const sigImg = resp.signature_image
    ? `<img src="${resp.signature_image}" alt="firma" style="max-height:120px"/>`
    : "";
  const lines = (resp.body || "").split("\n").map((l) => `<p style="margin:0 0 8px 0;white-space:pre-wrap">${l.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</p>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${resp.subject}</title>
  <style>
    body{font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#0f172a;max-width:780px;margin:40px auto;padding:0 32px;}
    header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #1FB877;padding-bottom:12px;margin-bottom:24px}
    header img{width:64px;height:64px;object-fit:contain}
    h1{font-family:'Outfit',sans-serif;font-size:22px;margin:0}
    .meta{font-size:11px;color:#64748b;letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px}
    .ref{font-size:12px;color:#475569;margin-top:4px}
    .body{font-size:14px;line-height:1.55;margin-top:24px}
    .sig{margin-top:60px;border-top:1px solid #e5e7eb;padding-top:16px;display:flex;align-items:flex-end;gap:24px;justify-content:space-between}
    .sig .who{font-size:13px}
    .hash{margin-top:8px;font-family:monospace;font-size:10px;color:#64748b;word-break:break-all}
  </style></head>
  <body>
    <header>
      <img src="${LOGO_URL}" alt="Hemsa"/>
      <div>
        <div class="meta">${BRAND.name} · ${BRAND.full}</div>
        <h1>${resp.subject}</h1>
        <div class="ref">Expediente ${doc?.entry_number || ""} · Solicitante: ${doc?.sender || ""}</div>
      </div>
    </header>
    <div class="body">${lines}</div>
    <div class="sig">
      <div class="who">
        ${sigImg ? `<div>${sigImg}</div>` : ""}
        <div style="margin-top:6px;font-weight:600">${resp.signed_by_name || ""}</div>
        <div style="font-size:11px;color:#64748b">Firmado el ${resp.signed_at ? new Date(resp.signed_at).toLocaleString("es-ES") : "(sin firmar)"}</div>
        ${resp.signature_hash ? `<div class="hash">SHA-256: ${resp.signature_hash}</div>` : ""}
      </div>
    </div>
    <script>setTimeout(()=>window.print(),300)</script>
  </body></html>`;
}

export default function Responses({ document: doc }) {
  const { user } = useAuth();
  const [responses, setResponses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [activeResp, setActiveResp] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ template_id: "", subject: "", body: "" });
  const [sigImage, setSigImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [{ data: rs }, { data: ts }] = await Promise.all([
        api.get(`/documents/${doc.id}/responses`),
        api.get("/templates"),
      ]);
      setResponses(rs);
      setTemplates(ts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  function openCreate() {
    setEditing(null);
    setForm({ template_id: "", subject: "", body: "" });
    setEditorOpen(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({ template_id: r.template_id || "", subject: r.subject, body: r.body });
    setEditorOpen(true);
  }

  function applyTemplate(tid) {
    const t = templates.find((x) => x.id === tid);
    setForm((f) => ({ ...f, template_id: tid }));
    if (!t) return;
    const data = buildPlaceholderData(doc, user);
    setForm((f) => ({
      ...f,
      template_id: tid,
      subject: interpolate(t.subject, data),
      body: interpolate(t.body, data),
    }));
  }

  async function saveDraft(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/responses/${editing.id}`, {
          subject: form.subject,
          body: form.body,
        });
        toast.success("Borrador actualizado");
      } else {
        await api.post(`/documents/${doc.id}/responses`, {
          template_id: form.template_id || null,
          subject: form.subject,
          body: form.body,
        });
        toast.success("Borrador creado");
      }
      setEditorOpen(false);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  }

  function openSign(r) {
    setActiveResp(r);
    setSigImage(null);
    setSignOpen(true);
  }

  async function confirmSign() {
    if (!sigImage) {
      toast.error("Dibuja tu firma antes de confirmar");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/responses/${activeResp.id}/sign`, { signature_image: sigImage });
      toast.success("Respuesta firmada");
      setSignOpen(false);
      setActiveResp(null);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(r) {
    if (!window.confirm("¿Eliminar esta respuesta?")) return;
    try {
      await api.delete(`/responses/${r.id}`);
      toast.success("Eliminada");
      reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  }

  function printResponse(r) {
    const html = buildPrintHtml(r, doc);
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Permite ventanas emergentes para imprimir");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-600">
          {loading ? "Cargando..." : `${responses.length} respuesta(s)`}
        </div>
        <button
          data-testid="responses-new-btn"
          onClick={openCreate}
          className="btn-primary px-3 py-1.5 text-xs font-medium rounded-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva respuesta
        </button>
      </div>

      {responses.length === 0 && !loading && (
        <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-border rounded-sm">
          <FileSignature className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          Sin respuestas todavía. Crea una desde una plantilla y fírmala digitalmente.
        </div>
      )}

      <div className="space-y-3">
        {responses.map((r) => (
          <div
            key={r.id}
            data-testid={`response-${r.id}`}
            className="border border-border/60 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={r.status} />
                  <span className="text-xs text-slate-500">
                    {r.template_id ? `Plantilla aplicada` : "Libre"}
                  </span>
                </div>
                <div className="font-medium text-slate-900 mt-1">{r.subject}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {r.created_by_name} · creado {formatDate(r.created_at)}
                  {r.signed_at && (
                    <>
                      {" · "}firmado por <span className="font-medium text-slate-700">{r.signed_by_name}</span> el {formatDate(r.signed_at)}
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {r.status === "borrador" && (r.created_by === user.id || user.role === "admin") && (
                  <button
                    data-testid={`response-edit-${r.id}`}
                    onClick={() => openEdit(r)}
                    title="Editar borrador"
                    className="p-1.5 hover:bg-slate-100 rounded-sm border border-border bg-white"
                  >
                    <Pencil className="w-4 h-4 text-slate-700" />
                  </button>
                )}
                {r.status === "borrador" && (
                  <button
                    data-testid={`response-sign-${r.id}`}
                    onClick={() => openSign(r)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-sm border border-brand bg-brand text-white inline-flex items-center gap-1"
                  >
                    <FileSignature className="w-3.5 h-3.5" /> Firmar
                  </button>
                )}
                {r.status === "firmado" && (
                  <button
                    data-testid={`response-print-${r.id}`}
                    onClick={() => printResponse(r)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-sm border border-border bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                )}
                {(r.status === "borrador" && r.created_by === user.id) || user.role === "admin" ? (
                  <button
                    data-testid={`response-delete-${r.id}`}
                    onClick={() => onDelete(r)}
                    title="Eliminar"
                    className="p-1.5 hover:bg-red-50 rounded-sm border border-border bg-white"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                ) : null}
              </div>
            </div>

            <pre className="mt-3 text-sm text-slate-700 whitespace-pre-wrap font-sans bg-slate-50/50 border border-border/40 p-3 rounded-sm max-h-44 overflow-auto">
{r.body}
            </pre>

            {r.status === "firmado" && (
              <div className="mt-3 flex items-center gap-4 border-t border-border/40 pt-3">
                {r.signature_image && (
                  <img
                    src={r.signature_image}
                    alt="firma"
                    data-testid={`response-signature-${r.id}`}
                    className="h-16 max-w-[260px] object-contain border border-border bg-white p-1"
                  />
                )}
                <div className="text-[10px] text-slate-500 font-mono break-all">
                  <div className="uppercase tracking-wider font-semibold text-slate-700 mb-0.5">
                    Hash SHA-256
                  </div>
                  {r.signature_hash}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="rounded-sm max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar respuesta" : "Nueva respuesta"}</DialogTitle>
            <DialogDescription>
              Selecciona una plantilla para autocompletar o escribe libremente. Los marcadores {"{{numero_entrada}}"}, {"{{remitente}}"}, etc. se sustituyen automáticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveDraft} className="space-y-4">
            {!editing && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Plantilla (opcional)
                </label>
                <select
                  data-testid="response-template-select"
                  value={form.template_id}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                >
                  <option value="">— Sin plantilla —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {`${t.name} · ${TPL_CAT_LABEL[t.category] || t.category}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Asunto
              </label>
              <input
                data-testid="response-subject"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Cuerpo de la respuesta
              </label>
              <textarea
                data-testid="response-body"
                required
                rows={14}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black font-mono leading-relaxed"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border bg-white text-slate-700 hover:bg-slate-50 rounded-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="response-save-draft"
                disabled={busy}
                className="btn-primary px-4 py-2 text-sm font-medium rounded-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {editing ? "Guardar" : "Guardar borrador"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle>Firma digital de la respuesta</DialogTitle>
            <DialogDescription>
              Tu firma se almacenará junto a tu identidad ({user?.name}) y la fecha actual. Se generará un hash SHA-256 de integridad que permitirá validar la respuesta posteriormente.
            </DialogDescription>
          </DialogHeader>
          {activeResp && (
            <div className="border border-border/60 bg-slate-50/50 p-3 rounded-sm mb-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Respuesta a firmar
              </div>
              <div className="text-sm font-medium text-slate-900 mt-0.5">{activeResp.subject}</div>
            </div>
          )}
          <SignaturePad onChange={setSigImage} testid="sign-pad" />
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40 mt-3">
            <button
              type="button"
              onClick={() => setSignOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-border bg-white text-slate-700 hover:bg-slate-50 rounded-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="response-confirm-sign"
              onClick={confirmSign}
              disabled={busy || !sigImage}
              className="btn-primary px-4 py-2 text-sm font-medium rounded-sm flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> Confirmar firma
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
