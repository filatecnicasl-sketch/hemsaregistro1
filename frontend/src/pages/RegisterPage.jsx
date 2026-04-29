import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const r = await register(name, email, password);
    setLoading(false);
    if (r.ok) {
      toast.success("Cuenta creada");
      navigate("/");
    } else {
      setError(r.error || "Error al registrarse");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md bg-white border border-border p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-black flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display font-semibold text-slate-900">
              Gestión Documental
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-0.5">
              Crear cuenta
            </div>
          </div>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          Solicita tu acceso
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Tu cuenta será creada como Personal. Un administrador podrá
          actualizar tu rol y departamento.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Nombre
            </label>
            <input
              data-testid="register-name-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border bg-white px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Email
            </label>
            <input
              data-testid="register-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border bg-white px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Contraseña
            </label>
            <input
              data-testid="register-password-input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border bg-white px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>

          {error && (
            <div
              data-testid="register-error"
              className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm"
            >
              {error}
            </div>
          )}

          <button
            data-testid="register-submit-button"
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white hover:bg-slate-800 py-2.5 px-6 text-sm font-medium rounded-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear cuenta"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 text-sm text-slate-600">
          ¿Ya tienes cuenta?{" "}
          <Link
            to="/login"
            data-testid="register-go-login"
            className="text-black underline underline-offset-2 font-medium hover:no-underline"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
