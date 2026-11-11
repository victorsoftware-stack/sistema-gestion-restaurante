import { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import BillingPage from './pages/BillingPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ReservationsPage from './pages/ReservationsPage.jsx';

function SigrShell() {
  const { loading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('menu');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Verificando sesión...
      </div>
    );
  }

  const isStaff = user && (user.role === 'mesero' || user.role === 'administrador');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-yellow-50/70 to-orange-50/80">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'menu' && <MenuPage />}
        {activeTab === 'auth' && <AuthPage onSuccess={() => setActiveTab('menu')} />}
        {activeTab === 'orders' && (user ? <OrdersPage /> : <AuthPage onSuccess={() => setActiveTab('orders')} />)}
        {activeTab === 'reservations' && (
          user ? <ReservationsPage /> : <AuthPage onSuccess={() => setActiveTab('reservations')} />
        )}
        {activeTab === 'billing' && (
          isStaff ? (
            <BillingPage />
          ) : (
            <AuthPage onSuccess={() => setActiveTab('billing')} />
          )
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
