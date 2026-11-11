import { UtensilsCrossed } from 'lucide-react';

const MODULES = [
  { name: 'Autenticación y Roles', desc: 'Clientes, meseros y administrador' },
  { name: 'Menú Digital', desc: 'CRUD de platos, categorías y disponibilidad' },
  { name: 'Pedidos en Tiempo Real', desc: 'Seguimiento entre salón y cocina' },
  { name: 'Reservas', desc: 'Control de fecha, hora y mesas disponibles' },
  { name: 'Facturación y Caja', desc: 'Comprobantes, cierre de caja y reportes diarios' },
];

export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              SIGR — Sistema Integral de Gestión de Restaurante
            </h1>
            <p className="text-sm text-slate-500">
              Estructura base inicial · Licencia MIT · Despliegue preparado para Vercel
            </p>
          </div>
        </div>

        <p className="text-slate-600 mb-6">
          Plataforma web en construcción incremental para establecer la línea base del sistema.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          {MODULES.map((mod) => (
            <div
              key={mod.name}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50"
            >
              <h2 className="font-semibold text-slate-800">{mod.name}</h2>
              <p className="text-sm text-slate-600 mt-1">{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
