import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Lock, ReceiptText } from 'lucide-react';
import { billingApi, formatCurrency, ordersApi } from '../services/api.js';

function getTodayUtcIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BillingPage() {
  const [reportDate, setReportDate] = useState(getTodayUtcIso);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [preview, setPreview] = useState(null);
  const [closings, setClosings] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);

  const [paymentMethods, setPaymentMethods] = useState({});
  const [taxRate, setTaxRate] = useState('0');
  const [openingAmount, setOpeningAmount] = useState('0');
  const [closingNotes, setClosingNotes] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadBillingData = useCallback(async () => {
    try {
      const [ordersRes, invRes, prevRes, closingsRes, reportRes] = await Promise.all([
        ordersApi.list({ activeOnly: true }),
        billingApi.listInvoices(reportDate),
        billingApi.previewClosing(reportDate),
        billingApi.listClosings(),
        billingApi.getDailyReport(reportDate),
      ]);
      setPendingOrders(ordersRes.orders);
      setInvoices(invRes.invoices);
      setPreview(prevRes);
      setClosings(closingsRes.closings);
      setDailyReport(reportRes);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }, [reportDate]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  async function handleEmitInvoice(orderId) {
    setFeedback({ type: '', message: '' });
    try {
      const method = paymentMethods[orderId] || 'efectivo';
      const data = await billingApi.createInvoice({
        order_id: orderId,
        payment_method: method,
        tax_rate: Number(taxRate),
      });
      setSelectedInvoice(data.invoice);
      setFeedback({
        type: 'success',
        message: `Factura ${data.invoice.invoice_number} emitida correctamente.`,
      });
      await loadBillingData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleCloseCash(e) {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      await billingApi.createClosing({
        closing_date: reportDate,
        opening_amount: Number(openingAmount || 0),
        notes: closingNotes.trim(),
      });
      setClosingNotes('');
      setFeedback({ type: 'success', message: `Cierre de caja del ${reportDate} registrado.` });
      await loadBillingData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturación, Cierre de Caja y Reportes</h1>
          <p className="text-sm text-slate-600">
            Emisión de comprobantes, arqueo por método de pago y consolidado diario de ventas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Fecha de consulta:</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
          />
        </div>
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

      {dailyReport && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">Ventas del día</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(dailyReport.sales.total_sales)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {dailyReport.sales.invoices_count} factura(s) emitida(s)
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">Efectivo / Tarjeta / Transf.</p>
            <p className="text-sm font-semibold text-slate-800 mt-1.5">
              {formatCurrency(dailyReport.sales.by_payment_method.efectivo)} ·{' '}
              {formatCurrency(dailyReport.sales.by_payment_method.tarjeta)} ·{' '}
              {formatCurrency(dailyReport.sales.by_payment_method.transferencia)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">Pedidos del día</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {dailyReport.orders.total_orders}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {dailyReport.orders.paid_orders} pagados · {dailyReport.orders.active_orders} activos
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">Reservas del día</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {dailyReport.reservations.total_reservations}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {dailyReport.reservations.confirmed} confirmadas · {dailyReport.reservations.completed} completadas
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-stone-900">Pedidos Pendientes de Facturación</h2>
            </div>
            <select
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="0">Sin impuesto (0%)</option>
              <option value="0.08">Impoconsumo (8%)</option>
            </select>
          </div>

          {pendingOrders.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No hay pedidos activos por facturar.</p>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">
                      Pedido #{order.id} ·{' '}
                      {order.table_number ? `Mesa ${order.table_number}` : 'Para llevar'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.customer_name} · Estado: {order.status} · Subtotal:{' '}
                      <strong>{formatCurrency(order.total)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={paymentMethods[order.id] || 'efectivo'}
                      onChange={(e) =>
                        setPaymentMethods((prev) => ({ ...prev, [order.id]: e.target.value }))
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleEmitInvoice(order.id)}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-semibold hover:from-amber-600 hover:to-orange-700"
                    >
                      Facturar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedInvoice && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Factura {selectedInvoice.invoice_number}</span>
                <span>{formatCurrency(selectedInvoice.total)}</span>
              </div>
              <p className="text-xs text-slate-600">
                Cliente: {selectedInvoice.customer_name} · Método: {selectedInvoice.payment_method}
              </p>
              <ul className="text-xs text-slate-700 space-y-0.5 pt-1 border-t border-slate-200">
                {selectedInvoice.items?.map((it) => (
                  <li key={it.id} className="flex justify-between">
                    <span>
                      {it.quantity}x {it.dish_name}
                    </span>
                    <span>{formatCurrency(it.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-stone-900">Cierre de Caja ({reportDate})</h2>
          </div>

          {preview && (
            <div className="grid grid-cols-2 gap-2.5 text-sm bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 block">Facturas del día</span>
                <strong>{preview.invoices_count}</strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total recaudado</span>
                <strong>{formatCurrency(preview.total_sales)}</strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Estado</span>
                <strong className={preview.already_closed ? 'text-emerald-700' : 'text-amber-700'}>
                  {preview.already_closed ? 'Cerrado' : 'Abierto'}
                </strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Efectivo</span>
                <strong>{formatCurrency(preview.cash_sales)}</strong>
              </div>
            </div>
          )}

          {!preview?.already_closed && (
            <form onSubmit={handleCloseCash} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Base de apertura (COP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Novedades de turno"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-orange-900 text-amber-50 text-sm font-semibold hover:bg-orange-950"
              >
                Ejecutar Cierre de Caja
              </button>
            </form>
          )}

          {dailyReport?.top_dishes?.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                <BarChart3 className="w-4 h-4 text-orange-600" />
                <span>Platos más vendidos ({reportDate})</span>
              </div>
              <ul className="space-y-1 text-sm">
                {dailyReport.top_dishes.map((dish) => (
                  <li key={dish.dish_id} className="flex justify-between text-slate-700">
                    <span>
                      {dish.dish_name} ({dish.units_sold} und.)
                    </span>
                    <span className="font-medium">{formatCurrency(dish.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-900">Facturas del {reportDate}</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">Sin facturas emitidas en esta fecha.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{inv.invoice_number}</span>
                    <span className="text-xs text-slate-500 ml-2 capitalize">
                      {inv.payment_method} · {inv.customer_name}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(inv.total)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-900">Historial de Cierres de Caja</h3>
          {closings.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no se han registrado cierres.</p>
          ) : (
            <div className="space-y-2">
              {closings.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{c.closing_date}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {c.invoices_count} factura(s) · {c.closed_by_name || 'Sistema'}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(c.total_sales)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
