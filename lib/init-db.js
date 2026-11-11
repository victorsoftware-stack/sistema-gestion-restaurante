import { initializeDatabase } from './db.js';

async function main() {
  const db = await initializeDatabase();
  const [categories, dishes, tables] = await Promise.all([
    db.execute('SELECT COUNT(*) AS count FROM categories'),
    db.execute('SELECT COUNT(*) AS count FROM dishes'),
    db.execute('SELECT COUNT(*) AS count FROM restaurant_tables'),
  ]);

  console.log('Base de datos SIGR inicializada correctamente:');
  console.log(`- Categorías: ${categories.rows[0].count}`);
  console.log(`- Platos:     ${dishes.rows[0].count}`);
  console.log(`- Mesas:      ${tables.rows[0].count}`);
  db.close();
}

main().catch((err) => {
  console.error('Error inicializando la base de datos:', err);
  process.exit(1);
});
