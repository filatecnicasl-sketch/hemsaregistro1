import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@gestion.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) {
      toast.success("Sesión iniciada");
      navigate("/");
    } else {
      setError(r.error || "Error de autenticación");
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block auth-cover relative">
        <div className="absolute inset-0 grid-bg" />
        <div className="relative h-full flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-semibold text-slate-900">
                Gestión Documental
              </div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Sistema integral
              </div>
            </div>
          </div>
          <div>
            <h2 className="font-display text-4xl font-light tracking-tight text-slate-900 leading-[1.1] max-w-md">
              Registro y reparto de la documentación de tu organización.
            </h2>
            <p className="mt-6 text-sm text-slate-600 max-w-md">
              Recepciona, asigna a departamentos y haz seguimiento de cada
              documento con trazabilidad completa.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-px bg-border max-w-md">
              {["Administración", "Dirección", "Técnico", "Coordinación", "Recepción", "Personal"].map((d) => (
                <div key={d} className="bg-white px-3 py-3 text-[11px] uppercase tracking-wider text-slate-600 font-medium">
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12 bg-white">
        <div className="lg:hidden mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-black flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="font-display font-semibold text-slate-900">
            Gestión Documental
          </div>
        </div>

        <div className="max-w-sm w-full">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
            Acceso
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
            Inicia sesión
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Introduce tus credenciales corporativas para continuar.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Email
              </label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border bg-white px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Contraseña
              </label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border bg-white px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
              />
            </div>

            {error && (
              <div
                data-testid="login-error"
                className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm"
              >
                {error}
              </div>
            )}

            <button
              data-testid="login-submit-button"
              disabled={loading}
              type="submit"
              className="w-full bg-black text-white hover:bg-slate-800 transition-colors py-2.5 px-6 text-sm font-medium rounded-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-600">
            ¿No tienes cuenta?{" "}
            <Link to="/register" data-testid="login-go-register" className="text-black underline underline-offset-2 font-medium hover:no-underline">
              Crear cuenta
            </Link>
          </div>

          <div className="mt-10 p-4 border border-border/70 bg-slate-50">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
              Demo
            </div>
            <div className="text-xs text-slate-600 space-y-1 font-mono-num">
              <div>admin@gestion.com / admin123</div>
              <div>recepcion@gestion.com / demo123</div>
              <div>jefe.tecnico@gestion.com / demo123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
