# Estructura de Base de Datos — SIGR

## 1. Estrategia de Persistencia (Local y Vercel)

El sistema utiliza **SQLite / LibSQL** mediante `@libsql/client`, lo que permite ejecutar exactamente el mismo SQL relacional en dos escenarios:

- **Desarrollo local y pruebas de integración**: Archivo local (`DATABASE_URL=file:./sigr.db`) o base en memoria (`:memory:`), sin necesidad de servicios externos.
- **Producción en Vercel**: Instancia serverless en **Turso** (`DATABASE_URL=libsql://...` y `TURSO_AUTH_TOKEN`), garantizando persistencia entre ejecuciones serverless.

## 2. Tablas Principales

| Tabla | Módulo Asociado | Descripción y Restricciones Clave |
| :--- | :--- | :--- |
| `users` | Autenticación | Almacena usuarios con `email` único, `password_hash` y `role` restringido a `cliente`, `mesero` o `administrador`. |
| `categories` | Menú Digital | Agrupaciones del menú con nombre único, orden de visualización (`display_order`) y estado `active`. |
| `dishes` | Menú Digital | Platos vinculados a `categories` (`ON DELETE RESTRICT`), precio no negativo (`price >= 0`), ruta/URL de imagen (`image_url`) y disponibilidad. |
| `restaurant_tables` | Pedidos y Reservas | Mesas físicas numeradas (`table_number` único), capacidad mínima > 0 y estado operativo (`disponible`, `ocupada`, `reservada`). |
| `orders` | Pedidos | Comandas asociadas opcionalmente a mesa, cliente y mesero; ciclo de vida controlado por `CHECK` (`pendiente`, `en_preparacion`, `listo`, `entregado`, `pagado`, `cancelado`). |
| `order_items` | Pedidos | Líneas de pedido dependientes de `orders` (`ON DELETE CASCADE`) con snapshot de nombre y precio unitario. |
| `reservations` | Reservas | Reservas por fecha (`YYYY-MM-DD`) y hora (`HH:MM`), asociadas a mesa y cantidad de comensales. |
| `invoices` | Facturación | Comprobante único por pedido (`order_id` único), número de factura único, impuestos y método de pago (`efectivo`, `tarjeta`, `transferencia`). |
| `cash_closings` | Cierre de Caja | Consolidado único por fecha (`closing_date`) con totales por método de pago y conteo de facturas. |

## 3. Relaciones e Índices

- **Integridad referencial**: Activada mediante `PRAGMA foreign_keys = ON`.
- **Relaciones clave**:
  - `categories 1 ── * dishes`
  - `restaurant_tables 1 ── * orders`
  - `orders 1 ── * order_items`
  - `restaurant_tables 1 ── * reservations`
  - `orders 1 ── 0..1 invoices`
- **Índices de rendimiento**:
  - `idx_dishes_category` en `dishes(category_id)`
  - `idx_orders_status` en `orders(status)`
  - `idx_reservations_date_table` en `reservations(reservation_date, table_id)`
  - `idx_invoices_issued_at` en `invoices(issued_at)`
