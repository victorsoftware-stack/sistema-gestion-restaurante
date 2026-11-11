# Sistema Integral de Gestión de Restaurante (SIGR)

Aplicación web integral para gestionar la operación de un restaurante en una primera línea base estable (`v1.0.0-baseline`): autenticación con control de acceso por roles, menú digital administrable, registro y seguimiento de pedidos en tiempo real, reservas por fecha y hora, facturación, cierre de caja y reportes diarios de ventas.

## Módulos de la Línea Base

1. **Autenticación y Roles (`/api/auth`)**: Registro de clientes, inicio de sesión con JWT y control de permisos para `cliente`, `mesero` y `administrador`.
2. **Menú Digital (`/api/categories`, `/api/dishes`)**: Consulta pública filtrable por categoría o búsqueda, cambio rápido de disponibilidad y CRUD administrativo.
3. **Pedidos en Tiempo Real (`/api/orders`, `/api/tables`)**: Toma de comandas por mesa o para llevar, cálculo de precios en servidor, cola en vivo (`/api/orders/live`) con actualización automática cada 5 segundos y flujo de estados (`pendiente → en_preparacion → listo → entregado → pagado`).
4. **Reservas (`/api/reservations`)**: Verificación de disponibilidad de mesas por fecha, hora y número de comensales, con bloqueo automático de solapamientos en ventanas de 90 minutos.
5. **Facturación, Cierre de Caja y Reportes (`/api/invoices`, `/api/cash-closing`, `/api/reports`)**: Emisión transaccional de facturas, liberación automática de mesas, arqueo por método de pago (`efectivo`, `tarjeta`, `transferencia`), cierre de caja único por fecha y reporte diario con top de platos vendidos.

## Stack Tecnológico

- **Frontend**: React 18, Vite 5, Tailwind CSS, Lucide React.
- **Backend**: Node.js (ES Modules), Express 5 (compatible con servidor local y funciones serverless en Vercel).
- **Base de datos**: SQLite / LibSQL (`@libsql/client`) — archivo local `sigr.db` en desarrollo, `:memory:` en pruebas y **Turso** en producción en Vercel.
- **Pruebas**: Vitest + Supertest.

## Requisitos Previos

- **Node.js** `>= 20` (probado en `v24.21.0`)
- **npm** `>= 10`
- **Git**

## Instalación y Ejecución Local

1. **Clonar el repositorio e ingresar al proyecto:**

```bash
git clone https://github.com/victorsoftware-stack/sistema-gestion-restaurante.git
cd sistema-gestion-restaurante
```

2. **Instalar dependencias:**

```bash
npm install
```

3. **Configurar variables de entorno (opcional en local, usa valores por defecto si se omite):**

```bash
cp .env.example .env
```

Variables principales en `.env.example`:
- `PORT=3001`
- `DATABASE_URL=file:./sigr.db`
- `TURSO_AUTH_TOKEN=` (solo requerido al desplegar en Vercel con Turso)
- `JWT_SECRET=cambia-esta-clave-secreta-en-produccion`
- `VITE_API_URL=/api`

4. **Inicializar la base de datos y datos semilla (opcional; también ocurre automáticamente al iniciar la API):**

```bash
npm run db:init
```

5. **Ejecutar frontend y backend simultáneamente en desarrollo:**

```bash
npm run dev:full
```

- Frontend (Vite): `http://localhost:5173`
- API Backend (Express): `http://localhost:3001`

## Usuarios de Demostración (Datos Semilla)

Al inicializar una base de datos vacía se crean tres cuentas de prueba:

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| Administrador | `admin@sigr.local` | `Admin123!` |
| Mesero | `mesero@sigr.local` | `Mesero123!` |
| Cliente | `cliente@sigr.local` | `Cliente123!` |

## Verificación, Compilación y Pruebas

```bash
# Ejecutar suite completa de pruebas de integración
npm test

# Compilar bundle de producción (carpeta dist/)
npm run build

# Ejecutar pruebas + compilación en un solo comando
npm run verify
```

## Estructura del Proyecto y Documentación

- [docs/CONVENCIONES.md](docs/CONVENCIONES.md) — Estructura de carpetas y reglas de código/commits.
- [docs/database_schema.sql](docs/database_schema.sql) — Script SQL relacional completo.
- [docs/database_structure.md](docs/database_structure.md) — Documentación del modelo de datos, relaciones e índices.
- [docs/manual_despliegue.md](docs/manual_despliegue.md) — Guía paso a paso para ejecución local y despliegue en Vercel + Turso.
- [CHANGELOG.md](CHANGELOG.md) — Historial de cambios de la línea base.
- [LICENSE.txt](LICENSE.txt) — Licencia MIT.
