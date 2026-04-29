import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { StatusBadge, PriorityBadge } from "../components/StatusBadge";
import {
  STATUSES,
  DEPARTMENTS,
  DEPT_LABEL,
  MEDIUM_LABEL,
  formatDate,
} from "../lib/constants";
import { Plus, Filter, FileText, Paperclip } from "lucide-react";

export default function DocumentsPage({ inbox = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterDept) params.department = filterDept;
    if (search) params.q = search;
    if (inbox) params.inbox = true;
    api
      .get("/documents", { params })
      .then(({ data }) => {
        if (active) setDocs(data);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filterStatus, filterDept, search, inbox]);

  const canRegister = user?.role === "admin" || user?.role === "recepcionista";

  const title = inbox ? "Mi bandeja" : "Documentos";

  return (
    <Layout search={{ value: search, setValue: setSearch }}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
            {inbox ? "Asignados a ti" : "Registro de entrada"}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {inbox
              ? "Documentos asignados directamente a tu cuenta."
              : "Listado de documentos registrados."}
          </p>
        </div>
        {canRegister && !inbox && (
          <Link
            to="/documentos/nuevo"
            data-testid="documents-new-btn"
            className="bg-black text-white hover:bg-slate-800 px-5 py-2.5 text-sm font-medium rounded-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Registrar entrada
          </Link>
        )}
      </div>

      <div className="bg-white border border-border/60 mb-4 p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 mr-2">
          <Filter className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider font-semibold">Filtros</span>
        </div>
        <select
          data-testid="filter-status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-border bg-white px-3 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          data-testid="filter-department"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border border-border bg-white px-3 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
        >
          <option value="">Todos los departamentos</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {(filterStatus || filterDept || search) && (
          <button
            data-testid="filter-clear"
            onClick={() => {
              setFilterStatus("");
              setFilterDept("");
              setSearch("");
            }}
            className="text-xs text-slate-600 hover:text-black underline underline-offset-2"
          >
            Limpiar
          </button>
        )}
        <div className="ml-auto text-xs text-slate-500 font-mono-num">
          {docs.length} resultados
        </div>
      </div>

      <div className="bg-white border border-border/60 overflow-x-auto">
        <table className="min-w-full text-sm" data-testid="documents-table">
          <thead className="bg-slate-50 border-b border-border">
            <tr>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Nº Entrada
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Asunto
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Remitente
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Medio
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Departamento
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Asignado a
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Estado
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Prioridad
              </th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && docs.length === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center text-sm text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  No hay documentos que coincidan con los filtros.
                </td>
              </tr>
            )}
            {!loading &&
              docs.map((d) => (
                <tr
                  key={d.id}
                  data-testid={`doc-row-${d.entry_number}`}
                  onClick={() => navigate(`/documentos/${d.id}`)}
                  className="border-b border-border/40 hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{d.entry_number}</span>
                      {d.file_path && (
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-900 max-w-xs truncate">
                    {d.subject}
                  </td>
                  <td className="py-3 px-4 text-slate-700 truncate max-w-[180px]">
                    {d.sender}
                  </td>
                  <td className="py-3 px-4 text-slate-700 text-xs">
                    {MEDIUM_LABEL[d.medium] || d.medium}
                  </td>
                  <td className="py-3 px-4 text-slate-700 text-xs">
                    {d.department ? DEPT_LABEL[d.department] : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-700 text-xs">
                    {d.assigned_to_name || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="py-3 px-4">
                    <PriorityBadge priority={d.priority} />
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(d.created_at)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
