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
  administrador: 'bg-orange-100 text-orange-800 border border-orange-200',
  mesero: 'bg-amber-100 text-amber-900 border border-amber-200',
  cliente: 'bg-yellow-100 text-yellow-900 border border-yellow-200',
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
    <header className="bg-white/95 backdrop-blur border-b border-amber-200 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onSelectTab('menu')}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="p-2 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 text-white shadow-sm">
            <UtensilsCrossed className="w-5 h-5" />
          </span>
          <div>
            <span className="font-bold text-stone-900 block leading-none">Restaurante</span>
            <span className="text-xs text-orange-700 font-medium">Sistema de Gestión</span>
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
                      ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-900 border border-amber-200'
                      : 'text-stone-600 hover:bg-amber-50 hover:text-orange-900'
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
                <span className="text-sm font-medium text-stone-800">{user.name}</span>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                    ROLE_BADGES[user.role] || 'bg-amber-100 text-amber-800'
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-sm font-medium text-stone-700 hover:bg-amber-50"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('auth')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-700 shadow-sm"
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
