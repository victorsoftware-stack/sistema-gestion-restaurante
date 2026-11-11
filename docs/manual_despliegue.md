# Manual de Despliegue — SIGR

Este documento describe los pasos necesarios para compilar, verificar y desplegar el **Sistema Integral de Gestión de Restaurante (SIGR)** tanto en un entorno local como en **Vercel** con persistencia en **Turso (LibSQL)**.

---

## 1. Requisitos del Entorno

- **Node.js**: versión `20.x` o superior (validado en `v24.21.0`).
- **npm**: versión `10.x` o superior.
- **Git**: instalado y configurado para clonar el repositorio.

---

## 2. Despliegue en Entorno Local

### 2.1. Preparación e instalación

```bash
git clone https://github.com/victorsoftware-stack/sistema-gestion-restaurante.git
cd sistema-gestion-restaurante
npm install
```

### 2.2. Variables de entorno

Copie la plantilla de variables de entorno:

```bash
cp .env.example .env
```

Para ejecución local con SQLite en disco, los valores por defecto funcionan de inmediato:

```env
PORT=3001
DATABASE_URL=file:./sigr.db
TURSO_AUTH_TOKEN=
JWT_SECRET=cambia-esta-clave-secreta-en-produccion
VITE_API_URL=/api
```

### 2.3. Verificación previa (Pruebas + Compilación)

Antes de levantar o publicar la versión, ejecute la batería de verificación de línea base:

```bash
npm run db:init
npm run verify
```

El comando `npm run verify` ejecuta:
1. `npm test` (`vitest run`): valida los flujos de autenticación, menú, pedidos, reservas, facturación, cierre de caja y reportes.
2. `npm run build` (`vite build`): compila el frontend React/Tailwind en la carpeta `dist/`.

### 2.4. Arranque en desarrollo o previsualización

```bash
# Modo desarrollo completo (API en :3001 + Vite en :5173)
npm run dev:full
```

---

## 3. Despliegue en Producción (Vercel + Turso)

Dado que **Vercel** ejecuta el backend como funciones *serverless* sin almacenamiento local persistente, la base de datos en producción debe apuntar a **Turso** (mismo motor LibSQL/SQLite compatible con `@libsql/client`).

### 3.1. Crear base de datos en Turso

1. Cree una cuenta gratuita en Turso e instale su CLI o use el panel web.
2. Cree la base de datos (por ejemplo `sigr-prod`) y obtenga:
   - URL de conexión: `libsql://<tu-bd>.turso.io`
   - Token de acceso: `<tu-turso-auth-token>`

*(No es necesario ejecutar migraciones manuales previas: la primera invocación de `/api/*` ejecuta `initializeDatabase()` automáticamente, creando tablas, índices y datos semilla iniciales).*

### 3.2. Importar y configurar el proyecto en Vercel

1. Inicie sesión en **Vercel** y seleccione **Add New Project**.
2. Conecte su cuenta de GitHub y seleccione el repositorio `victorsoftware-stack/sistema-gestion-restaurante` (rama `main`).
3. Verifique la configuración de compilación detectada desde `vercel.json`:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. En **Environment Variables**, agregue las siguientes variables para *Production* (y *Preview* si lo desea):
   - `DATABASE_URL`: `libsql://<tu-bd>.turso.io`
   - `TURSO_AUTH_TOKEN`: `<tu-turso-auth-token>`
   - `JWT_SECRET`: clave secreta aleatoria y robusta (mínimo 32 caracteres).
   - `VITE_API_URL`: `/api`
5. Presione **Deploy**.

### 3.3. Enrutamiento Serverless en `vercel.json`

El archivo `vercel.json` enruta todas las peticiones `/api/*` hacia la función serverless `api/index.js` (que envuelve la aplicación Express de `server/app.js`) y dirige el resto de rutas al SPA compilado en `dist/index.html`.

---

## 4. Verificación Post-Despliegue

Una vez finalizado el despliegue en Vercel:

1. Visite `https://<tu-proyecto>.vercel.app/api/health` y confirme que responde HTTP `200` con `{"ok": true, "service": "SIGR API"}`.
2. Abra `https://<tu-proyecto>.vercel.app` y verifique que carga el **Menú Digital** con los platos semilla.
3. Ingrese con una de las cuentas iniciales (por ejemplo `admin@sigr.local` / `Admin123!`) y cambie las contraseñas en un entorno productivo real.
