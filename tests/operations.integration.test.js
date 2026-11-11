import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDbClient } from '../lib/db.js';
import { createTestApp, loginAs } from './helpers.js';

describe('SIGR Integration — Pedidos, Reservas, Facturación y Reportes', () => {
  let app;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await resetDbClient();
  });

  it('registra pedidos, actualiza seguimiento en tiempo real y valida transiciones', async () => {
    const waiterToken = await loginAs(app, 'mesero@sigr.local', 'Mesero123!');
    const clientToken = await loginAs(app, 'cliente@sigr.local', 'Cliente123!');

    const [tablesRes, dishesRes] = await Promise.all([
      request(app).get('/api/tables'),
      request(app).get('/api/dishes'),
    ]);
    const table = tablesRes.body.tables[0];
    const dish = dishesRes.body.dishes[0];

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        table_id: table.id,
        customer_name: 'Mesa Familiar',
        items: [{ dish_id: dish.id, quantity: 2 }],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.order.total).toBe(dish.price * 2);
    expect(createRes.body.order.status).toBe('pendiente');

    const liveRes = await request(app)
      .get('/api/orders/live')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.counts.pendiente).toBe(1);

    const denied = await request(app)
      .patch(`/api/orders/${createRes.body.order.id}/status`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'en_preparacion' });
    expect(denied.status).toBe(403);

    const prep = await request(app)
      .patch(`/api/orders/${createRes.body.order.id}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'en_preparacion' });
    expect(prep.status).toBe(200);
    expect(prep.body.order.status).toBe('en_preparacion');

    const ready = await request(app)
      .patch(`/api/orders/${createRes.body.order.id}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'listo' });
    expect(ready.status).toBe(200);

    const delivered = await request(app)
      .patch(`/api/orders/${createRes.body.order.id}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'entregado' });
    expect(delivered.status).toBe(200);

    const invalidRevert = await request(app)
      .patch(`/api/orders/${createRes.body.order.id}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'pendiente' });
    expect(invalidRevert.status).toBe(409);
  });

  it('valida capacidad, solapamiento horario y cancelación de reservas', async () => {
    const clientToken = await loginAs(app, 'cliente@sigr.local', 'Cliente123!');
    const tablesRes = await request(app).get('/api/tables');
    const fourSeatTable = tablesRes.body.tables.find((t) => t.capacity === 4);

    const overCap = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        table_id: fourSeatTable.id,
        party_size: 8,
        reservation_date: '2026-11-25',
        reservation_time: '20:00',
      });
    expect(overCap.status).toBe(400);

    const booked = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        table_id: fourSeatTable.id,
        party_size: 3,
        reservation_date: '2026-11-25',
        reservation_time: '20:00',
        customer_phone: '3005551234',
      });
    expect(booked.status).toBe(201);

    const overlap = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        table_id: fourSeatTable.id,
        party_size: 2,
        reservation_date: '2026-11-25',
        reservation_time: '20:30',
      });
    expect(overlap.status).toBe(409);

    const availDuring = await request(app).get(
      '/api/reservations/availability?date=2026-11-25&time=20:30&party_size=4'
    );
    expect(
      availDuring.body.tables.find((t) => t.id === fourSeatTable.id).available
    ).toBe(false);

    const cancel = await request(app)
      .patch(`/api/reservations/${booked.body.reservation.id}/status`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'cancelada' });
    expect(cancel.status).toBe(200);

    const availAfter = await request(app).get(
      '/api/reservations/availability?date=2026-11-25&time=20:30&party_size=4'
    );
    expect(
      availAfter.body.tables.find((t) => t.id === fourSeatTable.id).available
    ).toBe(true);
  });

  it('emite factura, libera mesa, ejecuta cierre de caja y genera reporte diario', async () => {
    const waiterToken = await loginAs(app, 'mesero@sigr.local', 'Mesero123!');
    const [tablesRes, dishesRes] = await Promise.all([
      request(app).get('/api/tables'),
      request(app).get('/api/dishes'),
    ]);
    const table = tablesRes.body.tables[1];
    const dish = dishesRes.body.dishes[2];

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        table_id: table.id,
        customer_name: 'Cliente Factura',
        items: [{ dish_id: dish.id, quantity: 2 }],
      });
    const orderId = orderRes.body.order.id;

    const invRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        order_id: orderId,
        payment_method: 'transferencia',
        tax_rate: 0.08,
      });
    expect(invRes.status).toBe(201);
    const expectedTotal = Math.round(dish.price * 2 * 1.08);
    expect(invRes.body.invoice.total).toBe(expectedTotal);

    const dupInv = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ order_id: orderId, payment_method: 'efectivo' });
    expect(dupInv.status).toBe(409);

    const tablesAfter = await request(app).get('/api/tables');
    expect(tablesAfter.body.tables.find((t) => t.id === table.id).status).toBe('disponible');

    const preview = await request(app)
      .get('/api/cash-closing/preview')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.total_sales).toBe(expectedTotal);
    expect(preview.body.already_closed).toBe(false);

    const closing = await request(app)
      .post('/api/cash-closing')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ opening_amount: 100000, notes: 'Cierre sin novedades' });
    expect(closing.status).toBe(201);
    expect(closing.body.closing.transfer_sales).toBe(expectedTotal);

    const dupClosing = await request(app)
      .post('/api/cash-closing')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ opening_amount: 0 });
    expect(dupClosing.status).toBe(409);

    const report = await request(app)
      .get('/api/reports/daily')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(report.status).toBe(200);
    expect(report.body.sales.total_sales).toBe(expectedTotal);
    expect(report.body.orders.paid_orders).toBe(1);
    expect(report.body.top_dishes[0].dish_id).toBe(dish.id);
    expect(report.body.cash_closing).not.toBeNull();
  });
});
