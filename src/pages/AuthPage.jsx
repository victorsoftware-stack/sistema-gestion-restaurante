import { useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO_ACCOUNTS = [
  { label: 'Administrador', email: 'admin@sigr.local', pass: 'Admin123!' },
  { label: 'Mesero', email: 'mesero@sigr.local', pass: 'Mesero123!' },
  { label: 'Cliente', email: 'cliente@sigr.local', pass: 'Cliente123!' },
];

export default function AuthPage({ onSuccess }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin(demo) {
    setError('');
    setSubmitting(true);
    try {
      await login(demo.email, demo.pass);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-amber-100 text-orange-600">
            {mode === 'login' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
          </div>
          <h1 className="text-xl font-bold text-stone-900">
            {mode === 'login' ? 'Iniciar sesión' : 'Registro de Cliente'}
          </h1>
        </div>
        <p className="text-sm text-stone-600 mb-6">
          {mode === 'login'
            ? 'Accede según tu rol asignado (cliente, mesero o administrador).'
            : 'Crea una cuenta para realizar pedidos y reservar mesas.'}
        </p>

        <div className="grid grid-cols-2 gap-1 p-1 bg-amber-50 border border-amber-200 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'login'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm'
                : 'text-stone-700 hover:text-orange-800'
            }`}
          >
            Ingresar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === 'register'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm'
                : 'text-stone-700 hover:text-orange-800'
            }`}
          >
            Registrarse
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Laura Martínez"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-3.5 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3.5 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-600 hover:to-orange-700 disabled:opacity-60 shadow-sm"
          >
            {submitting
              ? 'Procesando...'
              : mode === 'login'
              ? 'Iniciar sesión'
              : 'Crear cuenta'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-6 pt-5 border-t border-amber-100">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2.5">
              Acceso rápido de demostración
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoLogin(demo)}
                  className="px-2.5 py-2 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-orange-100 hover:border-orange-300 text-xs font-semibold text-orange-900"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
