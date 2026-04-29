import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Bell, Search, Menu, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ROLE_LABEL, DEPT_LABEL } from "../lib/constants";

const titles = {
  "/": "Panel de control",
  "/documentos": "Documentos",
  "/documentos/nuevo": "Registrar entrada",
  "/bandeja": "Mi bandeja",
  "/usuarios": "Usuarios",
  "/notificaciones": "Notificaciones",
  "/plantillas": "Plantillas de respuesta",
};

function getTitle(pathname) {
  if (pathname.startsWith("/documentos/") && pathname !== "/documentos/nuevo") {
    return "Detalle del documento";
  }
  return titles[pathname] || "Gestión Documental";
}

export default function Topbar({ onMenu, query, setQuery }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let timer;
    const fetchUnread = async () => {
      try {
        const { data } = await api.get("/notifications");
        setUnread(data.filter((n) => !n.read).length);
      } catch {}
    };
    fetchUnread();
    timer = setInterval(fetchUnread, 30000);
    return () => clearInterval(timer);
  }, [location.pathname]);

  return (
    <header
      data-testid="app-topbar"
      className="h-16 bg-white border-b border-border flex items-center px-4 md:px-6 sticky top-0 z-40"
    >
      <button
        data-testid="topbar-menu-btn"
        onClick={onMenu}
        className="lg:hidden mr-2 p-2 hover:bg-slate-100 rounded-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="font-display text-lg font-medium text-slate-900 mr-6 hidden sm:block">
        {getTitle(location.pathname)}
      </h1>

      {setQuery && (
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="topbar-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, asunto, remitente..."
              className="w-full pl-9 pr-3 py-2 border border-border bg-slate-50/50 rounded-sm text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/notificaciones"
          data-testid="topbar-bell"
          className="relative p-2 hover:bg-slate-100 rounded-sm transition-colors"
        >
          <Bell className="w-5 h-5 text-slate-700" />
          {unread > 0 && (
            <span
              data-testid="topbar-bell-count"
              className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-600 text-white flex items-center justify-center rounded-full"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="topbar-user-menu-trigger"
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-slate-100 rounded-sm transition-colors"
            >
              <div className="w-8 h-8 bg-brand text-white text-xs font-bold flex items-center justify-center rounded-sm">
                {(user?.name || "?")
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-slate-900 leading-tight">
                  {user?.name}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  {ROLE_LABEL[user?.role]}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-sm">
            <DropdownMenuLabel>
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs text-slate-500 font-normal">
                {user?.email}
              </div>
              <div className="text-[11px] text-slate-500 font-normal mt-1">
                {ROLE_LABEL[user?.role]}
                {user?.department ? ` · ${DEPT_LABEL[user.department]}` : ""}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="topbar-logout-item"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
