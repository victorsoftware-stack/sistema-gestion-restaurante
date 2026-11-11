import { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import MenuPage from './pages/MenuPage.jsx';

function ModuleComingSoon({ title, description }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600 mt-2">{description}</p>
    </div>
  );
}

function SigrShell() {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState('menu');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Verificando sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'menu' && <MenuPage />}
        {activeTab === 'auth' && <AuthPage onSuccess={() => setActiveTab('menu')} />}
        {activeTab === 'orders' && (
          <ModuleComingSoon
            title="Pedidos en Tiempo Real"
            description="Los endpoints de pedidos (/api/orders y /api/orders/live) ya están activos; la vista interactiva de salón y cocina se conecta en el siguiente commit."
          />
        )}
        {activeTab === 'reservations' && (
          <ModuleComingSoon
            title="Reservas de Mesas"
            description="La API de disponibilidad y reservas (/api/reservations) ya está activa; el formulario y agenda visual se integran en el siguiente commit."
          />
        )}
        {activeTab === 'billing' && (
          <ModuleComingSoon
            title="Facturación, Cierre de Caja y Reportes"
            description="Las rutas de facturación, cierre de caja y reportes diarios ya están operativas; el panel financiero se integra en el siguiente commit."
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SigrShell />
    </AuthProvider>
  );
}
