import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import api, { formatApiError, API } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { StatusBadge, PriorityBadge } from "../components/StatusBadge";
import Responses from "../components/Responses";
import {
  DEPARTMENTS,
  DEPT_LABEL,
  MEDIUM_LABEL,
  STATUSES,
  formatDate,
  formatBytes,
} from "../lib/constants";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  UserPlus,
  Download,
  Trash2,
  Upload,
  History,
  MessageSquare,
  Activity,
  Building2,
  Paperclip,
  FileSignature,
} from "lucide-react";

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [users, setUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [tab, setTab] = useState("comments");
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === "admin";
  const isRecepcion = user?.role === "recepcionista";
  const isJefe = user?.role === "jefe_departamento";
  const canDispatch = isAdmin || isRecepcion;
  const canAssignPerson =
    isAdmin || isRecepcion || (isJefe && doc?.department === user?.department);

  const reload = async () => {
    try {
      const [{ data: d }, { data: c }, { data: h }] = await Promise.all([
        api.get(`/documents/${id}`),
        api.get(`/documents/${id}/comments`),
        api.get(`/documents/${id}/history`),
      ]);
      setDoc(d);
      setComments(c);
      setHistory(h);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Error al cargar");
    }
  };

  useEffect(() => {
    reload();
    api.get("/users").then(({ data }) => setUsers(data)).catch(() => {});
  }, [id]);

  async function dispatchToDept(department) {
    setBusy(true);
    try {
      const { data } = await api.post(`/documents/${id}/assign-department`, { department });
      setDoc(data);
      toast.success(`Repartido a ${DEPT_LABEL[department]}`);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  }

  async function assignPerson(user_id) {
    if (!user_id) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/documents/${id}/assign-person`, { user_id });
      setDoc(data);
      toast.success("Persona asignada");
      await reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status) {
    setBusy(true);
    try {
      const { data } = await api.post(`/documents/${id}/status`, { status });
      setDoc(data);
      toast.success(`Estado: ${status}`);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post(`/documents/${id}/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDoc(data);
      toast.success("Archivo subido");
      await reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile() {
    try {
      const token = localStorage.getItem("gd_token");
      const res = await fetch(`${API}/documents/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Descarga fallida");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc?.file_name || "archivo";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar archivo");
    }
  }

  async function addComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.post(`/documents/${id}/comments`, { text: newComment });
      setNewComment("");
      const { data } = await api.get(`/documents/${id}/comments`);
      setComments(data);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  }

  async function onDelete() {
    if (!window.confirm("¿Eliminar definitivamente este documento?")) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success("Documento eliminado");
      navigate("/documentos");
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  }

  if (!doc) {
    return (
      <Layout>
        <div className="text-sm text-slate-500">Cargando documento...</div>
      </Layout>
    );
  }

  const deptUsers = users.filter(
    (u) => u.role === "personal" || u.role === "jefe_departamento"
  );

  return (
    <Layout>
      <button
        data-testid="docdetail-back-btn"
        onClick={() => navigate(-1)}
        className="text-sm text-slate-600 hover:text-black inline-flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al listado
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-border/60 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-mono-num text-slate-500" data-testid="docdetail-entry-number">
                  {doc.entry_number}
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mt-1">
                  {doc.subject}
                </h1>
                <div className="mt-2 text-sm text-slate-600">
                  De <span className="font-medium text-slate-900">{doc.sender}</span> · {MEDIUM_LABEL[doc.medium]} · {formatDate(doc.received_at)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={doc.status} />
                <PriorityBadge priority={doc.priority} />
              </div>
            </div>

            {doc.description && (
              <div className="mt-5 pt-5 border-t border-border/60">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
                  Descripción
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {doc.description}
                </p>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-border/60 grid grid-cols-2 gap-4">
              <Field label="Departamento" value={doc.department ? DEPT_LABEL[doc.department] : "—"} />
              <Field label="Asignado a" value={doc.assigned_to_name || "—"} />
              <Field label="Registrado por" value={doc.registered_by_name} />
              <Field label="Última actualización" value={formatDate(doc.updated_at)} />
            </div>
          </div>

          {/* Attachment */}
          <div className="bg-white border border-border/60 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
                Archivo adjunto
              </div>
              <label
                htmlFor="upload-file"
                className="text-xs text-slate-700 hover:text-black inline-flex items-center gap-1 cursor-pointer"
                data-testid="docdetail-upload-btn"
              >
                <Upload className="w-3.5 h-3.5" /> {doc.file_path ? "Reemplazar" : "Subir"}
              </label>
              <input
                id="upload-file"
                type="file"
                className="hidden"
                onChange={(e) => uploadFile(e.target.files?.[0])}
              />
            </div>
            {doc.file_path ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 flex items-center justify-center rounded-sm">
                  <Paperclip className="w-5 h-5 text-slate-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate" data-testid="docdetail-filename">
                    {doc.file_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatBytes(doc.file_size)}
                  </div>
                </div>
                <button
                  data-testid="docdetail-download-btn"
                  onClick={downloadFile}
                  className="border border-border bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-xs rounded-sm flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Sin archivo adjunto.</div>
            )}
          </div>

          {/* Tabs: Comments, Responses & History */}
          <div className="bg-white border border-border/60">
            <div className="flex items-center border-b border-border/60 overflow-x-auto">
              <button
                data-testid="docdetail-tab-comments"
                onClick={() => setTab("comments")}
                className={`flex items-center gap-2 px-5 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  tab === "comments" ? "border-brand text-slate-900 font-medium" : "border-transparent text-slate-500"
                }`}
              >
                <MessageSquare className="w-4 h-4" /> Comentarios ({comments.length})
              </button>
              <button
                data-testid="docdetail-tab-responses"
                onClick={() => setTab("responses")}
                className={`flex items-center gap-2 px-5 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  tab === "responses" ? "border-brand text-slate-900 font-medium" : "border-transparent text-slate-500"
                }`}
              >
                <FileSignature className="w-4 h-4" /> Respuestas
              </button>
              <button
                data-testid="docdetail-tab-history"
                onClick={() => setTab("history")}
                className={`flex items-center gap-2 px-5 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  tab === "history" ? "border-brand text-slate-900 font-medium" : "border-transparent text-slate-500"
                }`}
              >
                <History className="w-4 h-4" /> Historial ({history.length})
              </button>
            </div>

            <div className="p-6">
              {tab === "responses" && <Responses document={doc} />}
              {tab === "comments" && (
                <div>
                  <form onSubmit={addComment} className="flex gap-2 mb-5">
                    <input
                      data-testid="docdetail-comment-input"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Añadir comentario..."
                      className="flex-1 border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                    />
                    <button
                      type="submit"
                      data-testid="docdetail-comment-submit"
                      className="btn-primary px-4 py-2 text-sm font-medium rounded-sm"
                    >
                      Enviar
                    </button>
                  </form>
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <div className="text-sm text-slate-500">Sin comentarios todavía.</div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="border-l-2 border-slate-300 pl-4 py-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium text-slate-900">{c.user_name}</span>
                            · {formatDate(c.created_at)}
                          </div>
                          <div className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">
                            {c.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === "history" && (
                <div className="space-y-3">
                  {history.length === 0 ? (
                    <div className="text-sm text-slate-500">Sin actividad.</div>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 border-l-2 border-slate-300 pl-4 py-1">
                        <Activity className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-sm text-slate-900 font-medium capitalize">
                            {h.action.replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-slate-500">
                            {h.by_user_name} · {formatDate(h.timestamp)}
                          </div>
                          {h.details && (
                            <div className="text-xs text-slate-600 mt-0.5">{h.details}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-4">
          {canDispatch && (
            <div className="bg-white border border-border/60 p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3">
                <Building2 className="w-3.5 h-3.5" />
                Repartir a departamento
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEPARTMENTS.map((d) => (
                  <button
                    key={d.value}
                    data-testid={`dispatch-${d.value}`}
                    disabled={busy}
                    onClick={() => dispatchToDept(d.value)}
                    className={`px-3 py-2 text-xs font-medium rounded-sm border transition-colors ${
                      doc.department === d.value
                        ? "bg-brand text-white border-brand"
                        : "bg-white text-slate-700 border-border hover:bg-slate-50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canAssignPerson && (
            <div className="bg-white border border-border/60 p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3">
                <UserPlus className="w-3.5 h-3.5" />
                Asignar a persona
              </div>
              <select
                data-testid="docdetail-assign-person"
                onChange={(e) => assignPerson(e.target.value)}
                value=""
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              >
                <option value="">Seleccionar persona...</option>
                {deptUsers
                  .filter((u) =>
                    isJefe ? u.department === user?.department : true
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.department ? `(${DEPT_LABEL[u.department]})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="bg-white border border-border/60 p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3">
              <Send className="w-3.5 h-3.5" />
              Cambiar estado
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  data-testid={`status-btn-${s.value}`}
                  disabled={busy || doc.status === s.value}
                  onClick={() => changeStatus(s.value)}
                  className={`px-3 py-2 text-xs font-medium rounded-sm border transition-colors ${
                    doc.status === s.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-border hover:bg-slate-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {(isAdmin || isRecepcion) && (
            <button
              data-testid="docdetail-delete-btn"
              onClick={onDelete}
              className="w-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2.5 text-sm font-medium rounded-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar documento
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
        {label}
      </div>
      <div className="text-sm text-slate-900 mt-1">{value}</div>
    </div>
  );
}
