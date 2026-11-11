import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDbClient } from '../lib/db.js';
import { createTestApp, loginAs } from './helpers.js';

describe('SIGR Integration — Autenticación y Menú Digital', () => {
  let app;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await resetDbClient();
  });

  it('inicializa esquema, datos semilla y responde /api/health', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);

    const [cats, dishes, tables] = await Promise.all([
      request(app).get('/api/categories'),
      request(app).get('/api/dishes'),
      request(app).get('/api/tables'),
    ]);

    expect(cats.body.categories).toHaveLength(4);
    expect(dishes.body.dishes).toHaveLength(8);
    expect(dishes.body.dishes.every((d) => d.image_url.startsWith('/images/dishes/'))).toBe(true);
    expect(tables.body.tables).toHaveLength(6);
  });

  it('registra clientes sin permitir escalamiento de rol y valida /api/auth/me', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Sofía Pérez',
      email: 'sofia@ejemplo.com',
      password: 'Password123',
      role: 'administrador',
    });

    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('cliente');
    expect(reg.body.token).toBeTruthy();

    const dup = await request(app).post('/api/auth/register').send({
      name: 'Sofía Duplicada',
      email: 'sofia@ejemplo.com',
      password: 'Password123',
    });
    expect(dup.status).toBe(409);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('sofia@ejemplo.com');
  });

  it('aplica control RBAC y permite al administrador CRUD de categorías y platos', async () => {
    const clientToken = await loginAs(app, 'cliente@sigr.local', 'Cliente123!');
    const adminToken = await loginAs(app, 'admin@sigr.local', 'Admin123!');

    const denied = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ name: 'Sopas' });
    expect(denied.status).toBe(403);

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sopas', description: 'Caldos del día', display_order: 5 });
    expect(catRes.status).toBe(201);
    const categoryId = catRes.body.category.id;

    const dishRes = await request(app)
      .post('/api/dishes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        category_id: categoryId,
        name: 'Ajiaco Santafereño',
        description: 'Con alcaparras, crema y aguacate',
        price: 29000,
      });
    expect(dishRes.status).toBe(201);
    const dishId = dishRes.body.dish.id;

    const searchRes = await request(app).get('/api/dishes?search=Ajiaco');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.dishes).toHaveLength(1);

    const availRes = await request(app)
      .patch(`/api/dishes/${dishId}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ available: false });
    expect(availRes.status).toBe(200);
    expect(availRes.body.dish.available).toBe(false);

    const delDish = await request(app)
      .delete(`/api/dishes/${dishId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delDish.status).toBe(200);

    const delCat = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delCat.status).toBe(200);
  });
});
