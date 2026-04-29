import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { formatApiError } from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { ROLES, DEPARTMENTS, ROLE_LABEL, DEPT_LABEL, formatDate } from "../lib/constants";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "personal",
    department: "",
  });
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ email: "", name: "", password: "", role: "personal", department: "" });
    setError("");
    setOpen(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      email: u.email,
      name: u.name,
      password: "",
      role: u.role,
      department: u.department || "",
    });
    setError("");
    setOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        const payload = {
          name: form.name,
          role: form.role,
          department: form.department || null,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
        toast.success("Usuario actualizado");
      } else {
        await api.post("/users", {
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
          department: form.department || null,
        });
        toast.success("Usuario creado");
      }
      setOpen(false);
      await reload();
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail));
    }
  }

  async function onDelete(u) {
    if (!window.confirm(`¿Eliminar usuario ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Usuario eliminado");
      await reload();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    }
  }

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Administración
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            Usuarios
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Gestiona los usuarios del sistema, sus roles y departamentos.
          </p>
        </div>
        <button
          data-testid="users-create-btn"
          onClick={openCreate}
          className="bg-black text-white hover:bg-slate-800 px-5 py-2.5 text-sm font-medium rounded-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="bg-white border border-border/60 overflow-x-auto">
        <table className="min-w-full text-sm" data-testid="users-table">
          <thead className="bg-slate-50 border-b border-border">
            <tr>
              {["Nombre", "Email", "Rol", "Departamento", "Creado", ""].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 py-3 px-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.email}`} className="border-b border-border/40 hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-medium text-slate-900">{u.name}</td>
                  <td className="py-3 px-4 text-slate-700 font-mono-num">{u.email}</td>
                  <td className="py-3 px-4 text-slate-700 text-xs uppercase tracking-wider">
                    {ROLE_LABEL[u.role]}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {u.department ? DEPT_LABEL[u.department] : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        data-testid={`user-edit-${u.email}`}
                        onClick={() => openEdit(u)}
                        className="p-1.5 hover:bg-slate-100 rounded-sm"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        data-testid={`user-delete-${u.email}`}
                        onClick={() => onDelete(u)}
                        className="p-1.5 hover:bg-red-50 rounded-sm"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar usuario" : "Nuevo usuario"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Actualiza los datos del usuario." : "Crea un nuevo usuario del sistema."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Nombre
              </label>
              <input
                data-testid="userform-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Email
              </label>
              <input
                data-testid="userform-email"
                required
                type="email"
                disabled={!!editing}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Contraseña {editing && <span className="text-slate-400 normal-case">(dejar vacío para no cambiar)</span>}
              </label>
              <input
                data-testid="userform-password"
                type="password"
                required={!editing}
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Rol
                </label>
                <select
                  data-testid="userform-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Departamento
                </label>
                <select
                  data-testid="userform-department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full border border-border bg-white px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                >
                  <option value="">—</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
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
                data-testid="userform-submit"
                className="bg-black text-white hover:bg-slate-800 px-4 py-2 text-sm font-medium rounded-sm"
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
