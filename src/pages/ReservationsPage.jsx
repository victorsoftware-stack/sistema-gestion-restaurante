import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { reservationsApi } from '../services/api.js';

const RESERVATION_BADGES = {
  confirmada: 'bg-emerald-100 text-emerald-800',
  completada: 'bg-amber-100 text-orange-900',
  cancelada: 'bg-rose-100 text-rose-800',
};

function getTodayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ReservationsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'mesero' || user?.role === 'administrador';

  const [date, setDate] = useState(getTodayLocalIso);
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [reservations, setReservations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadAvailability = useCallback(async () => {
    if (!date) return;
    try {
      const data = await reservationsApi.checkAvailability({
        date,
        time,
        party_size: partySize,
      });
      setAvailableTables(data.tables);
      const firstFree = data.tables.find((t) => t.available);
      setSelectedTableId(firstFree ? String(firstFree.id) : '');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }, [date, time, partySize]);

  const loadReservations = useCallback(async () => {
    try {
      const data = await reservationsApi.list(statusFilter ? { status: statusFilter } : {});
      setReservations(data.reservations);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }, [statusFilter]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  async function handleCreateReservation(e) {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    if (!selectedTableId) {
      setFeedback({ type: 'error', message: 'No hay mesa disponible seleccionada.' });
      return;
    }
    try {
      await reservationsApi.create({
        table_id: Number(selectedTableId),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        party_size: Number(partySize),
        reservation_date: date,
        reservation_time: time,
        notes: notes.trim(),
      });
      setNotes('');
      setFeedback({ type: 'success', message: 'Reserva confirmada correctamente.' });
      await Promise.all([loadAvailability(), loadReservations()]);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleStatusChange(id, status) {
    setFeedback({ type: '', message: '' });
    try {
      await reservationsApi.updateStatus(id, status);
      await Promise.all([loadAvailability(), loadReservations()]);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reservas por Fecha y Hora</h1>
        <p className="text-sm text-slate-600">
          Validación automática de capacidad de mesas y prevención de solapamiento horario.
        </p>
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
          onSubmit={handleCreateReservation}
          className="lg:col-span-2 bg-white rounded-2xl border border-amber-200 p-5 space-y-4 h-fit shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-stone-900">Programar Reserva</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hora</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Personas</label>
              <input
                type="number"
                required
                min={1}
                max={20}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Mesas elegibles según capacidad
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!t.available}
                  onClick={() => setSelectedTableId(String(t.id))}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                    !t.available
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : selectedTableId === String(t.id)
                      ? 'bg-amber-50 border-orange-500 text-orange-950'
                      : 'bg-white border-amber-200 hover:bg-amber-50/50'
                  }`}
                >
                  <span className="font-semibold block">Mesa {t.table_number}</span>
                  <span>
                    {t.location} · {t.capacity} pers.
                  </span>
                  <span className="block mt-1 font-medium">
                    {t.available ? 'Disponible' : 'Ocupada'}
                  </span>
                </button>
              ))}
              {availableTables.length === 0 && (
                <p className="col-span-2 text-xs text-slate-500">
                  No hay mesas con capacidad para {partySize} comensales.
                </p>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              minLength={2}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nombre del cliente"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Teléfono de contacto"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones (opcional)"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />

          <button
            type="submit"
            disabled={!selectedTableId}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 shadow-sm"
          >
            Confirmar Reserva
          </button>
        </form>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Agenda de Reservas</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="confirmada">Confirmadas</option>
              <option value="completada">Completadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>

          {reservations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              No hay reservas registradas para mostrar.
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((resv) => (
                <article
                  key={resv.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{resv.customer_name}</span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                          RESERVATION_BADGES[resv.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {resv.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {resv.reservation_date} a las {resv.reservation_time} · Mesa {resv.table_number} (
                      {resv.table_location}) · {resv.party_size} comensales
                    </p>
                    {resv.notes && <p className="text-xs text-slate-500 italic">{resv.notes}</p>}
                  </div>

                  {resv.status === 'confirmada' && (
                    <div className="flex gap-2 shrink-0">
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(resv.id, 'completada')}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-semibold hover:from-amber-600 hover:to-orange-700"
                        >
                          Completar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(resv.id, 'cancelada')}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
