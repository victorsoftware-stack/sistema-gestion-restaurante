import { useCallback, useEffect, useState } from 'react';
import { Clock, Minus, Plus, RefreshCw, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency, menuApi, ordersApi, tablesApi } from '../services/api.js';

const STATUS_META = {
  pendiente: { label: 'Pendiente', badge: 'bg-yellow-100 text-yellow-900 border border-yellow-200' },
  en_preparacion: { label: 'En preparación', badge: 'bg-orange-100 text-orange-800 border border-orange-200' },
  listo: { label: 'Listo', badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  entregado: { label: 'Entregado', badge: 'bg-amber-100 text-amber-900 border border-amber-200' },
  pagado: { label: 'Pagado', badge: 'bg-amber-200 text-orange-950' },
  cancelado: { label: 'Cancelado', badge: 'bg-rose-100 text-rose-800' },
};

const STAFF_NEXT_ACTIONS = {
  pendiente: [
    { status: 'en_preparacion', label: 'Iniciar preparación' },
    { status: 'cancelado', label: 'Cancelar', danger: true },
  ],
  en_preparacion: [
    { status: 'listo', label: 'Marcar listo' },
    { status: 'cancelado', label: 'Cancelar', danger: true },
  ],
  listo: [{ status: 'entregado', label: 'Marcar entregado' }],
  entregado: [],
};

export default function OrdersPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'mesero' || user?.role === 'administrador';

  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ pendiente: 0, en_preparacion: 0, listo: 0, entregado: 0 });
  const [lastSync, setLastSync] = useState('');
  const [dishes, setDishes] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState({});
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadLiveOrders = useCallback(async () => {
    try {
      const data = await ordersApi.listLive();
      setOrders(data.orders);
      setCounts(data.counts);
      setLastSync(new Date(data.server_time).toLocaleTimeString('es-CO'));
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }, []);

  useEffect(() => {
    Promise.all([
      menuApi.listDishes({ available: 'true' }),
      tablesApi.list(),
      loadLiveOrders(),
    ])
      .then(([dishRes, tableRes]) => {
        setDishes(dishRes.dishes);
        setTables(tableRes.tables);
      })
      .catch((err) => setFeedback({ type: 'error', message: err.message }));

    const timer = setInterval(loadLiveOrders, 5000);
    return () => clearInterval(timer);
  }, [loadLiveOrders]);

  function adjustCart(dishId, delta) {
    setCart((prev) => {
      const nextQty = (prev[dishId] || 0) + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[dishId];
        return copy;
      }
      return { ...prev, [dishId]: nextQty };
    });
  }

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => {
      const dish = dishes.find((d) => d.id === Number(id));
      return dish ? { ...dish, quantity: qty, subtotal: dish.price * qty } : null;
    })
    .filter(Boolean);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

  async function handleCreateOrder(e) {
    e.preventDefault();
    if (cartItems.length === 0) {
      setFeedback({ type: 'error', message: 'Agrega al menos un plato al pedido.' });
      return;
    }
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      await ordersApi.create({
        table_id: tableId ? Number(tableId) : null,
        customer_name: customerName.trim(),
        notes: notes.trim(),
        items: cartItems.map((item) => ({ dish_id: item.id, quantity: item.quantity })),
      });
      setCart({});
      setNotes('');
      setCustomerName('');
      setFeedback({ type: 'success', message: 'Pedido enviado a cocina correctamente.' });
      await loadLiveOrders();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(orderId, status) {
    setFeedback({ type: '', message: '' });
    try {
      await ordersApi.updateStatus(orderId, status);
      await loadLiveOrders();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos en Tiempo Real</h1>
          <p className="text-sm text-slate-600">
            Registro de comandas y sincronización automática cada 5 segundos entre salón y cocina.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              Actualizado {lastSync}
            </span>
          )}
          <button
            type="button"
            onClick={loadLiveOrders}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {['pendiente', 'en_preparacion', 'listo', 'entregado'].map((key) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-4">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_META[key].badge}`}>
              {STATUS_META[key].label}
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-2">{counts[key] || 0}</p>
          </div>
        ))}
      </div>

      {feedback.message && (
        <div
          className={`p-3.5 rounded-xl border text-sm ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleCreateOrder}
          className="lg:col-span-2 bg-white rounded-2xl border border-amber-200 p-5 space-y-4 h-fit shadow-sm"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-stone-900">Nuevo Pedido</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mesa</label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="">Para llevar / Sin mesa asignada</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Mesa {t.table_number} — {t.location} (cap. {t.capacity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={user.name}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (ej. sin cebolla)"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {dishes.map((dish) => {
              const qty = cart[dish.id] || 0;
              return (
                <div
                  key={dish.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {dish.image_url && (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-amber-200"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{dish.name}</p>
                      <p className="text-xs text-orange-700 font-semibold">{formatCurrency(dish.price)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustCart(dish.id, -1)}
                      disabled={qty === 0}
                      className="p-1 rounded-md border border-slate-200 disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => adjustCart(dish.id, 1)}
                      className="p-1 rounded-md border border-slate-200 hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total estimado</span>
            <span className="text-lg font-bold text-slate-900">{formatCurrency(cartTotal)}</span>
          </div>

          <button
            type="submit"
            disabled={submitting || cartItems.length === 0}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 shadow-sm"
          >
            {submitting ? 'Enviando...' : 'Registrar Pedido'}
          </button>
        </form>

        <div className="lg:col-span-3 space-y-3">
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              No hay pedidos activos en este momento.
            </div>
          ) : (
            orders.map((order) => {
              const meta = STATUS_META[order.status] || STATUS_META.pendiente;
              const staffActions = STAFF_NEXT_ACTIONS[order.status] || [];
              const canClientCancel = !isStaff && order.status === 'pendiente';

              return (
                <article
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900">Pedido #{order.id}</span>
                      <span className="text-sm text-slate-500 ml-2">
                        {order.table_number ? `Mesa ${order.table_number}` : 'Para llevar'} ·{' '}
                        {order.customer_name}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </div>

                  <ul className="text-sm text-slate-700 space-y-1 bg-slate-50 rounded-xl p-3">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>
                          {item.quantity}x {item.dish_name}
                        </span>
                        <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <p className="text-xs text-slate-600 italic">Nota: {order.notes}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-900">
                      Total: {formatCurrency(order.total)}
                    </span>

                    <div className="flex flex-wrap gap-2">
                      {isStaff &&
                        staffActions.map((act) => (
                          <button
                            key={act.status}
                            type="button"
                            onClick={() => handleStatusChange(order.id, act.status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              act.danger
                                ? 'border border-rose-200 text-rose-700 hover:bg-rose-50'
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
                            }`}
                          >
                            {act.label}
                          </button>
                        ))}
                      {canClientCancel && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'cancelado')}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                        >
                          Cancelar pedido
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
