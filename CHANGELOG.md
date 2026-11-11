# Historial de Cambios

Todos los cambios relevantes del **Sistema Integral de Gestión de Restaurante** se documentan cronológicamente en este archivo.

## [1.1.0] - 2026-11-11

### Cambiado y Añadido (Cierre Final del Proyecto)
- **Identidad visual cálida (amarillo y naranja)**:
  - Renovación completa de la paleta de colores en `index.html`, `src/App.jsx`, `src/components/Navbar.jsx`, `src/pages/AuthPage.jsx`, `src/pages/MenuPage.jsx`, `src/pages/OrdersPage.jsx`, `src/pages/ReservationsPage.jsx` y `src/pages/BillingPage.jsx`.
- **Imágenes de productos en catálogo y pedidos**:
  - Agregada columna `image_url` en la tabla `dishes` (`lib/schema.js`, `docs/database_schema.sql`, `server/routes/dishes.js`) con migración automática para bases existentes en `lib/db.js`.
  - Incorporadas 8 fotografías locales en `public/images/dishes/` (`empanadas-criollas.jpg`, `patacones-hogao.jpg`, `bandeja-tipica.jpg`, `trucha-ajillo.jpg`, `pechuga-plancha.jpg`, `limonada-coco.jpg`, `jugo-natural.jpg`, `postre-tres-leches.jpg`), campo editable de imagen en el CRUD y miniaturas en pedidos.
- **Actualización de marca en interfaz**:
  - Retirada la sigla visible anterior en títulos, barra superior, encabezado del menú, login y nombre de platos/usuarios visibles (`Bandeja Típica`, `Restaurante · Sistema de Gestión`).
- **Documentación de ingeniería en `README.md`**:
  - Ampliado con arquitectura en capas, estructura completa del proyecto, modelo relacional, matriz RBAC, contrato completo de los endpoints REST, máquinas de estado, pruebas, scripts y despliegue.

## [1.0.0-baseline] - 2026-11-11

### Añadido
- **Estructura base y configuración (`chore`)**:
  - Licencia MIT en `LICENSE.txt`, exclusiones en `.gitignore`, plantilla `.env.example`, configuración de React + Vite + Tailwind CSS, configuración de rutas para Vercel en `vercel.json` y convenciones en `docs/CONVENCIONES.md`.
- **Base de datos relacional (`feat(db)`)**:
  - Esquema SQL completo de 9 tablas (`users`, `categories`, `dishes`, `restaurant_tables`, `orders`, `order_items`, `reservations`, `invoices`, `cash_closings`) e índices en `docs/database_schema.sql` y `lib/schema.js`.
  - Conexión unificada `@libsql/client` (`lib/db.js`) compatible con SQLite local y Turso en Vercel, más script idempotente `npm run db:init`.
- **Autenticación y roles (`feat(auth)`)**:
  - Registro de clientes, inicio de sesión con `bcryptjs` y JWT, consulta de perfil (`/api/auth/me`) y administración de usuarios por rol en `server/routes/auth.js` y `lib/auth.js`.
- **Menú digital (`feat(menu)`)**:
  - CRUD completo de categorías (`/api/categories`) y platos (`/api/dishes`) con filtros y cambio rápido de disponibilidad.
- **Pedidos en tiempo real (`feat(orders)`)**:
  - Consulta de mesas (`/api/tables`), creación transaccional de comandas con cálculo de precios en servidor, endpoint en vivo (`/api/orders/live`) y control de transiciones de estado.
- **Reservas (`feat(reservations)`)**:
  - Verificador de disponibilidad (`/api/reservations/availability`), validación de aforo, prevención de solapamientos en ventanas de 90 minutos y cancelación/completado de reservas.
- **Facturación, cierre de caja y reportes (`feat(billing)`)**:
  - Emisión transaccional de facturas (`/api/invoices`) con liberación automática de mesas, previsualización y cierre de caja diario (`/api/cash-closing`) y reporte consolidado de ventas (`/api/reports/daily`).
- **Interfaz web React + Tailwind (`feat(ui)`)**:
  - Barra de navegación adaptada por rol, login/registro con accesos rápidos de demostración, catálogo y CRUD de menú digital, tablero de pedidos en vivo con refresco automático cada 5s, agenda de reservas y panel de facturación/caja/reportes.
- **Pruebas de integración (`test`)**:
  - Suite automatizada con Vitest y Supertest (`tests/auth-menu.integration.test.js` y `tests/operations.integration.test.js`) validando los flujos críticos de punta a punta contra SQLite en memoria.
- **Documentación técnica (`docs`)**:
  - `README.md`, `CHANGELOG.md`, `docs/database_structure.md` y `docs/manual_despliegue.md`.
