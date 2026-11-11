import {
  CalendarClock,
  ClipboardList,
  LogIn,
  LogOut,
  Receipt,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_BADGES = {
  administrador: 'bg-indigo-100 text-indigo-800',
  mesero: 'bg-amber-100 text-amber-800',
  cliente: 'bg-emerald-100 text-emerald-800',
};

export default function Navbar({ activeTab, onSelectTab }) {
  const { user, logout } = useAuth();
  const isStaff = user && (user.role === 'mesero' || user.role === 'administrador');

  const navItems = [
    { id: 'menu', label: 'Menú Digital', icon: UtensilsCrossed, visible: true },
    { id: 'orders', label: 'Pedidos en Vivo', icon: ClipboardList, visible: Boolean(user) },
    { id: 'reservations', label: 'Reservas', icon: CalendarClock, visible: Boolean(user) },
    { id: 'billing', label: 'Facturación y Caja', icon: Receipt, visible: Boolean(isStaff) },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onSelectTab('menu')}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="p-2 rounded-xl bg-indigo-600 text-white">
            <UtensilsCrossed className="w-5 h-5" />
          </span>
          <div>
            <span className="font-bold text-slate-900 block leading-none">SIGR</span>
            <span className="text-xs text-slate-500">Gestión de Restaurante</span>
          </div>
        </button>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{user.name}</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                    ROLE_BADGES[user.role] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onSelectTab('menu');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('auth')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              <LogIn className="w-4 h-4" />
              <span>Ingresar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
