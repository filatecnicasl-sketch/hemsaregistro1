import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { StatusBadge, PriorityBadge } from "../components/StatusBadge";
import { Link } from "react-router-dom";
import {
  STATUSES,
  STATUS_LABEL,
  DEPT_LABEL,
  formatDate,
} from "../lib/constants";
import { ArrowUpRight, Plus, FileText, Inbox, Bell, CheckCircle2 } from "lucide-react";

function StatCard({ label, value, hint, testid }) {
  return (
    <div
      data-testid={testid}
      className="bg-white border border-border/60 p-5 flex flex-col gap-2"
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
        {label}
      </div>
      <div className="font-display text-4xl font-light tracking-tighter text-slate-900 font-mono-num">
        {value}
      </div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function MiniBar({ data, max }) {
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d) => {
        const h = max ? (d.count / max) * 100 : 0;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-slate-900/90 hover:bg-black transition-colors"
              style={{ height: `${Math.max(h, 4)}%`, minHeight: "4px" }}
              title={`${d.label}: ${d.count}`}
            />
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/stats/dashboard").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const max = stats ? Math.max(1, ...stats.timeline.map((d) => d.count)) : 1;

  return (
    <Layout>
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Bienvenido
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mt-1">
            Hola, {user?.name?.split(" ")[0] || "Usuario"}.
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-xl">
            Visión general del registro y reparto de documentación.
          </p>
        </div>
        {(user?.role === "admin" || user?.role === "recepcionista") && (
          <Link
            to="/documentos/nuevo"
            data-testid="dashboard-new-doc-btn"
            className="bg-black text-white hover:bg-slate-800 px-5 py-2.5 text-sm font-medium rounded-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Registrar entrada
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          testid="stat-total"
          label="Total Documentos"
          value={stats?.total ?? "—"}
          hint="En tu ámbito"
        />
        <StatCard
          testid="stat-pending"
          label="Pendientes"
          value={
            stats
              ? (stats.by_status.recibido || 0) +
                (stats.by_status.repartido || 0) +
                (stats.by_status.asignado || 0)
              : "—"
          }
          hint="Recibidos / repartidos / asignados"
        />
        <StatCard
          testid="stat-in-progress"
          label="En Proceso"
          value={stats?.by_status?.en_proceso ?? "—"}
        />
        <StatCard
          testid="stat-finalized"
          label="Finalizados"
          value={stats?.by_status?.finalizado ?? "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="bg-white border border-border/60 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
                Actividad
              </div>
              <div className="font-display text-lg font-medium text-slate-900 mt-0.5">
                Últimos 7 días
              </div>
            </div>
          </div>
          {stats ? (
            <MiniBar data={stats.timeline} max={max} />
          ) : (
            <div className="h-20 bg-slate-100/60 animate-pulse" />
          )}
        </div>

        <div className="bg-white border border-border/60 p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3">
            Estados
          </div>
          <div className="space-y-2">
            {stats &&
              STATUSES.map((s) => (
                <div
                  key={s.value}
                  className="flex items-center justify-between text-sm"
                >
                  <StatusBadge status={s.value} />
                  <span className="font-mono-num text-slate-900 font-medium">
                    {stats.by_status[s.value] || 0}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="bg-white border border-border/60 p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3">
            Por Departamento
          </div>
          <div className="space-y-2">
            {stats &&
              Object.entries(stats.by_department).map(([d, c]) => (
                <div
                  key={d}
                  className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0"
                >
                  <span className="text-slate-700">{DEPT_LABEL[d]}</span>
                  <span className="font-mono-num font-medium">{c}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white border border-border/60 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
              Actividad reciente
            </div>
            <Link
              to="/documentos"
              className="text-xs text-slate-700 hover:text-black flex items-center gap-1"
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {stats?.recent?.length ? (
              stats.recent.map((d) => (
                <Link
                  key={d.id}
                  to={`/documentos/${d.id}`}
                  data-testid={`recent-doc-${d.entry_number}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50/60 px-2 -mx-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono-num text-slate-500">
                      {d.entry_number}
                    </div>
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {d.subject}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {d.sender} · {formatDate(d.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={d.status} />
                    <PriorityBadge priority={d.priority} />
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Sin documentos aún
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
