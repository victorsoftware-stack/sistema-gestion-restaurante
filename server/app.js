import express from 'express';
import { initializeDatabase } from '../lib/db.js';
import authRouter from './routes/auth.js';
import cashClosingRouter from './routes/cashClosing.js';
import categoriesRouter from './routes/categories.js';
import dishesRouter from './routes/dishes.js';
import invoicesRouter from './routes/invoices.js';
import ordersRouter from './routes/orders.js';
import reportsRouter from './routes/reports.js';
import reservationsRouter from './routes/reservations.js';
import tablesRouter from './routes/tables.js';

/**
 * Crea y configura la aplicación Express de SIGR.
 * Compartida entre el servidor local, pruebas de integración y Vercel Serverless.
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  app.use('/api', async (_req, _res, next) => {
    try {
      await initializeDatabase();
      return next();
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'SIGR API',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/dishes', dishesRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/cash-closing', cashClosingRouter);
  app.use('/api/reports', reportsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor.';
    res.status(status).json({ error: message });
  });

  return app;
}
