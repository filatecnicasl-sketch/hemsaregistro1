import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Link } from "react-router-dom";
import { formatDate } from "../lib/constants";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAll = async () => {
    await api.post(`/notifications/read-all`);
    toast.success("Todas marcadas como leídas");
    reload();
  };

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Centro de avisos
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            Notificaciones
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {unread > 0 ? `Tienes ${unread} sin leer.` : "Estás al día."}
          </p>
        </div>
        {unread > 0 && (
          <button
            data-testid="notif-mark-all-btn"
            onClick={markAll}
            className="bg-white border border-border hover:bg-slate-50 text-slate-700 px-4 py-2 text-sm rounded-sm flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" /> Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="bg-white border border-border/60">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Cargando...</div>
        ) : notifs.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            <Bell className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            Sin notificaciones.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {notifs.map((n) => (
              <div
                key={n.id}
                data-testid={`notif-${n.id}`}
                className={`flex items-start gap-3 p-4 ${!n.read ? "bg-blue-50/30" : ""}`}
              >
                <div className={`w-2 h-2 mt-2 rounded-full ${!n.read ? "bg-blue-600" : "bg-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900">
                    {n.message}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {formatDate(n.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {n.document_id && (
                    <Link
                      to={`/documentos/${n.document_id}`}
                      className="text-xs text-slate-700 hover:text-black underline underline-offset-2"
                    >
                      Ver documento
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      data-testid={`notif-read-${n.id}`}
                      onClick={() => markRead(n.id)}
                      className="text-xs text-slate-500 hover:text-black"
                    >
                      Marcar leído
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
