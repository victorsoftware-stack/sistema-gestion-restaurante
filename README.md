# Sistema Integral de Gestión de Restaurante

Aplicación web *full-stack* diseñada para centralizar y controlar la operación completa de un restaurante: autenticación con control de acceso por roles, catálogo digital con fotografías de producto, registro y seguimiento de pedidos en tiempo real, reservas por fecha y hora, facturación, cierre de caja diario y reportes de ventas.

Este documento reúne la referencia técnica integral del proyecto para ingenieros de sistemas e ingenieros de software: arquitectura, modelo de datos, seguridad, contrato completo de la API REST, máquinas de estado, estrategia de pruebas automatizadas, despliegue en Vercel y gestión de configuración.

---

## 1. Arquitectura del Sistema

El sistema sigue una arquitectura modular de **tres capas desacopladas** pensada para ejecutarse tanto en un entorno local monolítico de desarrollo como en infraestructura *serverless* en **Vercel**:

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   CAPA DE PRESENTACIÓN (Frontend SPA)                │
│   React 18 + Vite 5 + Tailwind CSS (src/)                            │
│   • Contexto de autenticación JWT (AuthContext)                      │
│   • Cliente HTTP centralizado con Bearer Token (src/services/api.js) │
│   • Vistas por módulo: Menú, Pedidos (polling 5s), Reservas, Caja    │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTP / JSON (/api/*)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  CAPA DE LÓGICA Y API REST (Backend)                 │
│   Node.js (ESM) + Express 5 (server/app.js)                          │
│   • Modo Local: server/dev.js (puerto 3001, proxy Vite /api)         │
│   • Modo Serverless Vercel: api/index.js + vercel.json rewrites      │
│   • Middlewares: initializeDatabase, authenticate, requireRole       │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ SQL parametrizado (@libsql/client)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   CAPA DE PERSISTENCIA (Base de Datos)               │
│   SQLite / LibSQL (lib/db.js + lib/schema.js)                        │
│   • Local: file:./sigr.db                                            │
│   • Pruebas de integración: :memory:                                 │
│   • Producción Vercel: Turso (libsql://... + TURSO_AUTH_TOKEN)       │
└──────────────────────────────────────────────────────────────────────┘
```

### Decisiones Arquitectónicas Clave
1. **Un solo núcleo Express compartido (`server/app.js`)**: La función [`createApp`](server/app.js) instancia la aplicación Express una sola vez y la reutilizan tres consumidores distintos: el servidor local (`server/dev.js`), el adaptador *serverless* de Vercel (`api/index.js`) y las pruebas de integración con Supertest (`tests/helpers.js`). Esto elimina divergencias entre desarrollo, pruebas y producción.
2. **Inicialización idempotente en *cold start* (`lib/db.js`)**: En entornos *serverless* no existe un proceso de arranque persistente. El middleware de `/api` invoca `initializeDatabase()` (protegido con promesa cacheada para evitar carreras concurrentes), garantizando que el esquema, migraciones incrementales de columnas (`PRAGMA table_info`) y datos semilla estén listos en la primera petición.
3. **Persistencia dual SQLite / Turso**: Se utiliza `@libsql/client` para ejecutar el mismo dialecto SQL relacional en archivo local (`file:./sigr.db`), en memoria (`:memory:`) durante Vitest y en **Turso** en la nube al desplegar en Vercel.
4. **Seguimiento en tiempo real compatible con *serverless***: Debido a que las funciones *serverless* de Vercel son efímeras y no sostienen sockets WebSocket en memoria, la cola de cocina/salón (`/api/orders/live`) utiliza consultas indexadas ligeras con actualización automática cada 5 segundos y refresco inmediato tras cada mutación.
5. **Integridad financiera del lado del servidor**: El cliente nunca envía precios ni totales finales. Al registrar un pedido (`POST /api/orders`), el backend consulta los precios vigentes en la tabla `dishes` y ejecuta la creación de `orders`, `order_items` y ocupación de mesa dentro de una transacción atómica (`db.transaction('write')`).

---

## 2. Estructura del Repositorio

```text
sistema-gestion-restaurante/
├── api/
│   └── index.js                          # Entrypoint Serverless de Vercel (exporta createApp())
├── docs/
│   ├── CONVENCIONES.md                   # Estándares de carpetas, código y Conventional Commits
│   ├── database_schema.sql               # DDL SQL completo (9 tablas + 4 índices)
│   ├── database_structure.md             # Documentación técnica del modelo relacional
│   └── manual_despliegue.md              # Guía paso a paso para local y Vercel + Turso
├── lib/
│   ├── auth.js                           # Hashing bcryptjs, firma/verificación JWT y middlewares RBAC
│   ├── db.js                             # Cliente LibSQL/SQLite, migraciones y seed idempotente
│   ├── init-db.js                        # Script CLI (npm run db:init)
│   ├── schema.js                         # Sentencias DDL embebidas (evita fallos de bundling en Vercel)
│   └── validators.js                     # Validación de IDs, fechas YYYY-MM-DD y horas HH:MM
├── public/
│   └── images/
│       └── dishes/                       # Fotografías estáticas de los platos del catálogo (8 .jpg)
├── server/
│   ├── app.js                            # Fábrica Express y montaje de rutas /api/*
│   ├── dev.js                            # Servidor HTTP local (puerto 3001)
│   └── routes/
│       ├── auth.js                       # Registro, login, perfil /me y gestión de usuarios
│       ├── cashClosing.js                # Previsualización, cierre de caja diario e historial
│       ├── categories.js                 # CRUD de categorías del menú
│       ├── dishes.js                     # CRUD de platos, filtros y disponibilidad
│       ├── invoices.js                   # Facturación transaccional y liberación de mesas
│       ├── orders.js                     # Comandas, cola /live y máquina de estados
│       ├── reports.js                    # Reporte consolidado diario de ventas y top platos
│       ├── reservations.js               # Disponibilidad, aforo y reservas con control de traslapes
│       └── tables.js                     # Listado de mesas físicas y estado operativo
├── src/
│   ├── components/
│   │   └── Navbar.jsx                    # Navegación superior responsiva filtrada por rol
│   ├── context/
│   │   └── AuthContext.jsx               # Estado global de sesión JWT
│   ├── pages/
│   │   ├── AuthPage.jsx                  # Login, registro de clientes y accesos rápidos demo
│   │   ├── BillingPage.jsx               # Facturación, cierre de caja y reportes diarios
│   │   ├── MenuPage.jsx                  # Catálogo con fotos, filtros y CRUD administrativo
│   │   ├── OrdersPage.jsx                # Toma de pedidos y tablero en tiempo real (polling 5s)
│   │   └── ReservationsPage.jsx          # Buscador de disponibilidad y agenda de reservas
│   ├── services/
│   │   └── api.js                        # Cliente fetch centralizado + formateador COP
│   ├── App.jsx                           # Shell de la aplicación y enrutamiento por pestañas
│   ├── index.css                         # Directivas Tailwind CSS
│   └── main.jsx                          # Punto de entrada ReactDOM
├── tests/
│   ├── helpers.js                        # Aislamiento en memoria (:memory:) y helper de login
│   ├── auth-menu.integration.test.js     # Pruebas de integración de salud, auth, RBAC y menú
│   └── operations.integration.test.js    # Pruebas integrales de pedidos, reservas, facturas y caja
├── .env.example                          # Plantilla documentada de variables de entorno
├── .gitignore                            # Exclusión de node_modules, dist, .env, *.db y .vercel
├── CHANGELOG.md                          # Registro cronológico de versiones y cambios
├── index.html                            # Documento HTML raíz (idioma es)
├── LICENSE.txt                           # Licencia MIT
├── package.json                          # Dependencias y scripts de desarrollo, test y build
├── postcss.config.js                     # Pipeline PostCSS
├── tailwind.config.js                    # Configuración Tailwind CSS
├── vercel.json                           # BuildCommand, dist/ y rewrites SPA + /api
├── vite.config.js                        # Configuración Vite + proxy /api -> localhost:3001
└── vitest.config.js                      # Configuración Vitest en entorno Node
```

---

## 3. Modelo de Datos Relacional e Integridad

El esquema relacional ([docs/database_schema.sql](docs/database_schema.sql)) aplica integridad referencial estricta (`PRAGMA foreign_keys = ON`) y restricciones `CHECK`/`UNIQUE` en base de datos:

| Tabla | Claves / Restricciones | Relaciones y Comportamiento |
| :--- | :--- | :--- |
| `users` | `email UNIQUE`, `role IN ('cliente','mesero','administrador')` | Almacena credenciales con hash `bcryptjs`. |
| `categories` | `name UNIQUE`, `display_order`, `active` | Agrupa platos; `ON DELETE RESTRICT` impide borrar categorías con platos asociados. |
| `dishes` | `price >= 0`, `image_url`, `available` | Pertenece a `categories`. Si un plato ya tiene historial en `order_items`, se protege contra borrado (`409`). |
| `restaurant_tables` | `table_number UNIQUE`, `capacity > 0`, `status` | Estados: `disponible`, `ocupada`, `reservada`. |
| `orders` | `status CHECK(...)`, `total >= 0` | Referencia opcional a `restaurant_tables`, `customer_id` y `waiter_id`. |
| `order_items` | `quantity > 0`, `unit_price >= 0`, `subtotal >= 0` | `ON DELETE CASCADE` desde `orders`. Guarda *snapshot* de `dish_name` y `unit_price` para preservar histórico contable ante cambios futuros de precio. |
| `reservations` | `party_size > 0`, `reservation_date`, `reservation_time`, `status` | Valida capacidad máxima de la mesa y evita conflictos en ventanas de **90 minutos** entre reservas confirmadas. |
| `invoices` | `invoice_number UNIQUE`, `order_id UNIQUE`, `payment_method` | Garantiza facturación 1 a 1 por pedido (`efectivo`, `tarjeta`, `transferencia`). |
| `cash_closings` | `closing_date UNIQUE` | Consolida una única acta de cierre diario por fecha (`YYYY-MM-DD`). |

**Índices definidos:** `idx_dishes_category`, `idx_orders_status`, `idx_reservations_date_table`, `idx_invoices_issued_at`.

---

## 4. Seguridad y Control de Acceso (RBAC)

- **Contraseñas**: Almacenamiento mediante `bcryptjs` con factor de costo `10` (nunca en texto plano y nunca expuestas en respuestas JSON gracias a `sanitizeUser`).
- **Autenticación Stateless (JWT)**: Tokens firmados con `HS256` (`JWT_SECRET`, vigencia `24h`), enviados en cabecera `Authorization: Bearer <token>`. El middleware [`authenticate`](lib/auth.js) verifica firma y vigencia y reconsulta el usuario en BD para invalidar tokens de cuentas eliminadas.
- **Prevención de escalamiento de privilegios**: El registro público (`POST /api/auth/register`) ignora cualquier rol enviado en el payload y asigna siempre `'cliente'`. Solo un `'administrador'` autenticado puede crear cuentas de personal (`POST /api/auth/users`).
- **Autorización por rol (`requireRole`)**:

| Capacidad / Recurso | Invitado | `cliente` | `mesero` | `administrador` |
| :--- | :---: | :---: | :---: | :---: |
| Consultar menú digital, categorías, mesas y disponibilidad | ✅ | ✅ | ✅ | ✅ |
| Registrarse e iniciar sesión | ✅ | ✅ | ✅ | ✅ |
| Crear pedido y cancelar propio pedido `pendiente` | ❌ | ✅ | ✅ | ✅ |
| Ver cola completa en vivo y avanzar estados de cocina | ❌ | ❌ (solo propios) | ✅ | ✅ |
| Crear reserva y cancelar propia reserva | ❌ | ✅ | ✅ | ✅ |
| Gestionar reservas de clientes (`completada` / `cancelada`) | ❌ | ❌ | ✅ | ✅ |
| Cambiar disponibilidad rápida de platos (`Agotar`/`Habilitar`) | ❌ | ❌ | ✅ | ✅ |
| Emitir facturas, cerrar caja y consultar reportes diarios | ❌ | ❌ | ✅ | ✅ |
| CRUD completo de categorías, platos y gestión de usuarios | ❌ | ❌ | ❌ | ✅ |

---

## 5. Contrato de la API REST (`/api/*`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Público | Verificación de salud del servicio e inicialización de BD. |
| `POST` | `/api/auth/register` | Público | Registro de cliente (devuelve JWT + usuario). |
| `POST` | `/api/auth/login` | Público | Inicio de sesión para cualquier rol (devuelve JWT + usuario). |
| `GET` | `/api/auth/me` | Autenticado | Perfil del usuario actual según token Bearer. |
| `GET` | `/api/auth/users` | `administrador` | Lista de usuarios sin `password_hash`. |
| `POST` | `/api/auth/users` | `administrador` | Creación de cuentas internas (`cliente`, `mesero`, `administrador`). |
| `GET` | `/api/categories` | Público | Lista de categorías activas (soporta `?includeInactive=true`). |
| `POST` | `/api/categories` | `administrador` | Crea categoría (`name`, `description`, `display_order`). |
| `PUT` | `/api/categories/:id` | `administrador` | Actualiza categoría existente. |
| `DELETE` | `/api/categories/:id` | `administrador` | Elimina categoría si no posee platos vinculados (`409` si tiene). |
| `GET` | `/api/dishes` | Público | Lista platos con filtros `?categoryId=`, `?available=`, `?search=`. |
| `GET` | `/api/dishes/:id` | Público | Detalle de un plato por ID. |
| `POST` | `/api/dishes` | `administrador` | Crea plato (`category_id`, `name`, `description`, `price`, `image_url`, `available`). |
| `PUT` | `/api/dishes/:id` | `administrador` | Actualiza plato existente. |
| `PATCH` | `/api/dishes/:id/availability` | `mesero`, `administrador` | Alterna disponibilidad (`{ available: boolean }`). |
| `DELETE` | `/api/dishes/:id` | `administrador` | Elimina plato si no aparece en `order_items`. |
| `GET` | `/api/tables` | Público | Lista las mesas físicas y su estado actual. |
| `GET` | `/api/orders/live` | Autenticado | Cola en tiempo real de pedidos activos + contadores por estado. |
| `GET` | `/api/orders` | Autenticado | Historial de pedidos (filtros `?status=`, `?activeOnly=true`). |
| `GET` | `/api/orders/:id` | Autenticado | Detalle de un pedido con sus ítems (clientes solo ven los suyos). |
| `POST` | `/api/orders` | Autenticado | Crea comanda transaccional validando disponibilidad y precios en BD. |
| `PATCH` | `/api/orders/:id/status` | Autenticado | Avanza estado o cancela según matriz de transiciones y rol. |
| `GET` | `/api/reservations/availability` | Público | Consulta disponibilidad por `?date=YYYY-MM-DD&time=HH:MM&party_size=N`. |
| `GET` | `/api/reservations` | Autenticado | Lista reservas (`?date=`, `?status=`), filtrado por usuario si es cliente. |
| `POST` | `/api/reservations` | Autenticado | Registra reserva validando capacidad y ventana de 90 min sin traslapes. |
| `PATCH` | `/api/reservations/:id/status` | Autenticado | Cambia estado (`confirmada`, `completada`, `cancelada`). |
| `GET` | `/api/invoices` | Autenticado | Lista facturas emitidas (opcional `?date=YYYY-MM-DD`). |
| `GET` | `/api/invoices/:id` | Autenticado | Detalle de factura con los ítems del pedido. |
| `POST` | `/api/invoices` | `mesero`, `administrador` | Emite factura `FAC-YYYYMMDD-NNNN`, pasa pedido a `pagado` y libera mesa. |
| `GET` | `/api/cash-closing/preview` | `mesero`, `administrador` | Previsualización de totales por método de pago antes de cerrar caja. |
| `GET` | `/api/cash-closing` | `mesero`, `administrador` | Historial de cierres de caja registrados. |
| `POST` | `/api/cash-closing` | `mesero`, `administrador` | Registra cierre único por fecha (error `409` si ya fue cerrada). |
| `GET` | `/api/reports/daily` | `mesero`, `administrador` | Consolidado diario: ventas por método, pedidos, reservas, cierre y top 5 platos. |

---

## 6. Máquinas de Estado

- **Pedidos (`orders.status`)**:
  - `pendiente` → `en_preparacion` | `listo` | `cancelado`
  - `en_preparacion` → `listo` | `entregado` | `cancelado`
  - `listo` → `entregado` | `cancelado`
  - `entregado` → `pagado` *(transición automática al emitir factura en `POST /api/invoices`)*
  - `pagado` y `cancelado` son estados terminales.
- **Reservas (`reservations.status`)**:
  - `confirmada` → `completada` | `cancelada`
  - No se permite cancelar una reserva ya marcada como `completada` (`409`).

---

## 7. Pruebas Automatizadas e Integración Continua

Las pruebas se ejecutan con **Vitest** y **Supertest** sobre la aplicación Express real conectada a SQLite en memoria (`DATABASE_URL=:memory:`), sin *mocks* de base de datos, reiniciando el cliente entre casos mediante [`resetDbClient`](lib/db.js):

- [tests/auth-menu.integration.test.js](tests/auth-menu.integration.test.js): Verifica arranque `/api/health`, semillas (`4` categorías, `8` platos con `image_url`, `6` mesas), bloqueo de escalamiento de rol en registro, rechazo de duplicados (`409`), RBAC (`403`) y CRUD de menú.
- [tests/operations.integration.test.js](tests/operations.integration.test.js): Verifica cálculo de totales en servidor, cola en tiempo real `/api/orders/live`, transiciones válidas e inválidas de pedidos, validación de aforo y solapamiento horario de reservas, facturación con impoconsumo (`8%`), liberación automática de mesa, cierre de caja único y cálculo de reporte diario.

---

## 8. Instalación, Ejecución y Scripts NPM

### Requisitos
- **Node.js** `>= 20` (probado en `v24.21.0`)
- **npm** `>= 10`
- **Git**

### Puesta en marcha local
```bash
git clone https://github.com/victorsoftware-stack/sistema-gestion-restaurante.git
cd sistema-gestion-restaurante
npm install
cp .env.example .env   # Opcional en local; usa SQLite file:./sigr.db por defecto
npm run dev:full
```
- **Frontend (Vite):** `http://localhost:5173`
- **API Backend (Express):** `http://localhost:3001`

### Scripts disponibles en `package.json`
| Script | Comando | Uso |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Inicia solo el servidor de desarrollo frontend con HMR. |
| `npm run dev:api` | `node --watch server/dev.js` | Inicia la API local con recarga automática ante cambios. |
| `npm run dev:full` | `concurrently ...` | Ejecuta frontend y API simultáneamente. |
| `npm run db:init` | `node lib/init-db.js` | Crea/migra tablas e inserta datos semilla de forma idempotente. |
| `npm test` | `vitest run` | Ejecuta las pruebas de integración end-to-end. |
| `npm run build` | `vite build` | Compila la aplicación optimizada en `dist/`. |
| `npm run verify` | `npm test && npm run build` | Compuerta de calidad: ejecuta todas las pruebas y compila producción. |

### Variables de entorno (`.env.example`)
| Variable | Valor por defecto local | Uso en producción (Vercel) |
| :--- | :--- | :--- |
| `PORT` | `3001` | Gestionado por Vercel Serverless. |
| `DATABASE_URL` | `file:./sigr.db` | URL de Turso (`libsql://<bd>.turso.io`). |
| `TURSO_AUTH_TOKEN` | *(vacío)* | Token de acceso de Turso. |
| `JWT_SECRET` | `cambia-esta-clave-secreta-en-produccion` | Secreto aleatorio robusto (mín. 32 caracteres). |
| `VITE_API_URL` | `/api` | `/api` (mismo origen en Vercel). |

### Cuentas de demostración (entorno semilla)
| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| Administrador | `admin@sigr.local` | `Admin123!` |
| Mesero | `mesero@sigr.local` | `Mesero123!` |
| Cliente | `cliente@sigr.local` | `Cliente123!` |

*(En producción, cambie o elimine las credenciales por defecto y configure un `JWT_SECRET` seguro).*

---

## 9. Despliegue en Vercel y Trazabilidad de Versiones

- El proyecto está preparado para desplegarse directamente desde GitHub en **Vercel** ([vercel.json](vercel.json)) respaldado por **Turso**: consulte el paso a paso completo en [docs/manual_despliegue.md](docs/manual_despliegue.md).
- **Gestión de configuración**:
  - Rama principal estable: `main`.
  - Etiqueta de línea base oficial: `v1.0.0-baseline`.
  - Convención de mensajes: **Conventional Commits** ([docs/CONVENCIONES.md](docs/CONVENCIONES.md)).
  - Historial de versiones: [CHANGELOG.md](CHANGELOG.md).
  - Licencia: **MIT** ([LICENSE.txt](LICENSE.txt)).
