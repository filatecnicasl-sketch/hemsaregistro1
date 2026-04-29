import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABEL, DEPT_LABEL } from "../lib/constants";
import {
  LayoutGrid,
  FileText,
  Inbox,
  Users,
  Bell,
  LogOut,
  Plus,
  Building2,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Panel", icon: LayoutGrid, roles: null, end: true, testid: "nav-dashboard" },
  { to: "/documentos", label: "Documentos", icon: FileText, roles: null, testid: "nav-documents" },
  { to: "/bandeja", label: "Mi Bandeja", icon: Inbox, roles: null, testid: "nav-inbox" },
  { to: "/notificaciones", label: "Notificaciones", icon: Bell, roles: null, testid: "nav-notifications" },
  { to: "/usuarios", label: "Usuarios", icon: Users, roles: ["admin"], testid: "nav-users" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const canRegister = user && (user.role === "admin" || user.role === "recepcionista");

  return (
    <aside
      data-testid="app-sidebar"
      className="hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-border h-screen sticky top-0"
    >
      <div className="px-5 h-16 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 bg-black flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-display font-semibold text-[15px] leading-none text-slate-900">
            Gestión
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-1">
            Documental
          </div>
        </div>
      </div>

      {canRegister && (
        <div className="px-4 pt-4">
          <button
            data-testid="sidebar-new-document-btn"
            onClick={() => navigate("/documentos/nuevo")}
            className="w-full bg-black text-white hover:bg-slate-800 transition-colors py-2.5 px-3 text-sm font-medium flex items-center justify-center gap-2 rounded-sm"
          >
            <Plus className="w-4 h-4" />
            Registrar entrada
          </button>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
          Navegación
        </div>
        {navItems
          .filter((it) => !it.roles || it.roles.includes(user?.role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={item.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors ${
                  isActive
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="px-3 py-3 mb-2 bg-slate-50 border border-border/60">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
            Sesión
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900 truncate" data-testid="sidebar-user-name">
            {user?.name}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 truncate">
            {ROLE_LABEL[user?.role]}{user?.department ? ` · ${DEPT_LABEL[user.department]}` : ""}
          </div>
        </div>
        <button
          data-testid="sidebar-logout-btn"
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors rounded-sm"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
