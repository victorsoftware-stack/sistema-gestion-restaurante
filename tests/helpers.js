import request from 'supertest';
import { resetDbClient } from '../lib/db.js';
import { createApp } from '../server/app.js';

export async function createTestApp() {
  process.env.DATABASE_URL = ':memory:';
  process.env.JWT_SECRET = 'test-secret-key';
  await resetDbClient();
  return createApp();
}

export async function loginAs(app, email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}
