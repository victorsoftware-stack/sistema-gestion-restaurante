# Estructura de Carpetas y Convenciones de Código — SIGR

## 1. Estructura del Repositorio

```text
sistema-gestion-restaurante/
├── api/                 # Punto de entrada Serverless para Vercel
├── docs/                # Documentación técnica, esquema SQL y manuales
├── lib/                 # Capa de base de datos, esquema, autenticación y utilidades
├── server/              # Aplicación Express, rutas REST y servidor de desarrollo local
├── src/                 # Aplicación web frontend (React + Vite + Tailwind)
│   ├── components/      # Componentes reutilizables de interfaz
│   ├── context/         # Estado global de sesión y notificaciones
│   ├── pages/           # Vistas principales por módulo
│   └── services/        # Cliente HTTP y utilidades de comunicación con /api
├── tests/               # Pruebas automatizadas de integración
├── .env.example         # Plantilla de variables de entorno
├── .gitignore           # Exclusiones de control de versiones
├── LICENSE.txt          # Licencia MIT
├── package.json         # Dependencias y scripts de compilación/pruebas
├── vercel.json          # Configuración de build y rutas para Vercel
└── vite.config.js       # Configuración de Vite y proxy local hacia /api
```

## 2. Convenciones de Código

- **Lenguaje y módulos**: JavaScript ES Modules (`"type": "module"`).
- **Nomenclatura**:
  - Componentes React y páginas: `PascalCase.jsx` (ej. `MenuPage.jsx`).
  - Servicios, utilidades y endpoints API: `camelCase.js` o `kebab-case.js` consistente por módulo.
  - Tablas y columnas SQL: `snake_case`.
- **Variables de entorno**: Nunca versionar `.env`; documentar toda variable nueva en `.env.example`.

## 3. Convención de Commits (Conventional Commits)

Se utiliza el formato `<tipo>(<alcance>): <descripción>`:

- `chore`: configuración inicial, dependencias, herramientas.
- `feat`: nueva funcionalidad o módulo.
- `fix`: corrección de errores.
- `test`: pruebas unitarias o de integración.
- `docs`: documentación técnica y guías.
