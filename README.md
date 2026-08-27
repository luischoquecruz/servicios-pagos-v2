# Alquileres App v2

Sistema para administrar los **pagos por servicios de una casa** donde habitan muchos
inquilinos. La información vive en un **spreadsheet de Google Sheets llamado `Casa`**
(abstraído por hojas) y se muestra **en tiempo real** en el frontend.

```
┌────────────┐   polling 5s   ┌───────────────────┐   sync 30s   ┌──────────────────────────┐
│  Frontend   │ ─────────────> │  Backend (Java)   │ ───────────> │ Google Sheets  "Casa"    │
│ React + TS  │  REST /api     │  Spring Boot      │  Apps Script│  (una hoja por entidad)  │
└────────────┘                 └───────────────────┘             └──────────────────────────┘
```

## Estructura

| Carpeta     | Contenido |
|-------------|-----------|
| `backend/`  | API REST en Java (Spring Boot 3.5). Calcula cobros, registra pagos y genera reportes. |
| `frontend/` | Aplicación React + TypeScript + Vite (trabaja con vite build). |
| `scripts/`  | `Code.gs`: el Apps Script que expone el spreadsheet `Casa` como API por hojas. |

### Hojas del spreadsheet `Casa` (la base de datos)

| Hoja | Qué guarda |
|------|-----------|
| `inquilinos` | nombre, celular, fecha ingreso, fecha salida, habilitado (activo/inactivo), habitaciones alquiladas, personas que habitan |
| `servicios` | nombre, costo mensual en Bs, unidad de medida (kWh, m³…), método de pago (CUARTOS o PERSONAS) y costos extra por refrigerador, ducha, luz de pasillo y herramienta |
| `servicios_inquilinos` | qué servicios se le cobran a cada inquilino + opciones de consumo (refrigeradores, ducha, luz pasillo, herramientas) |
| `cobros` | las líneas de cobro generadas mes a mes (reparto base + extra por consumo) |
| `pagos` | los pagos registrados: fecha, monto, servicio y periodo |

## Requisitos

- **Java 17 o superior** (probado con JDK 22)
- **Node.js 20+** (probado con Node 24)
- Opcional: cuenta de Google para conectar el spreadsheet real.

## Puesta en marcha

### 1. Sin Google (modo local, para probar ya)

El backend arranca en modo local automáticamente si no hay `deploy-id` configurado,
guardando todo en `backend/data/db.json` (misma abstracción por "hojas").

```bash
# terminal 1 — backend (usa el Maven wrapper incluido)
cd backend
mvnw.cmd spring-boot:run          # http://localhost:8080

# terminal 2 — frontend
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

El frontend usa *proxy* hacia `http://localhost:8080`; abre `http://localhost:5173`.

### 2. Con Google Sheets (producción)

**a) Crear el spreadsheet `Casa`** en Google Drive.

**b) Subir el Apps Script** (`scripts/Code.gs`):
1. En el spreadsheet: `Extensiones` → `Apps Script`.
2. Pega el contenido de `scripts/Code.gs` (reemplaza el archivo por defecto).
3. `Implementar` → `Nueva implementación` → tipo **Aplicación web**:
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona**.
4. Copia la URL que se genera (termina en `/exec`). El segmento **`/s/{ID}/exec`**
   es tu **ID de implementación**.

**c) Configurar el backend** en `backend/src/main/resources/application.properties`:

```properties
app.sheets.deploy-id=AQUI_EL_ID_DE_IMPLEMENTACION
app.sheets.mode=auto          # google | local | auto
app.sheets.nombre=Casa
app.sheets.sync-ms=30000      # cada cuánto el backend lee las hojas
```

También se puede pasar por variables de entorno:
`APP_SHEETS_DEPLOY_ID`, `APP_SHEETS_MODE`, `APP_SHEETS_SYNC_MS`.

**d) Arrancar igual que en el modo local.** El backend creará las hojas
automáticamente (con sus encabezados) la primera vez que sincronice.

> Nota sobre "tiempo real": Google Sheets no tiene notificaciones push; el backend
> re-lee las hojas cada 30 s (configurable) y el frontend consulta al backend cada 5 s.
> Cualquier edición en la hoja o desde la app aparece en la pantalla en pocos segundos.

## Flujo de uso

1. **Servicios**: crea los servicios con su costo mensual en Bs, el método de pago
   (por cuartos o por personas) y, si aplica, los precios extra por consumo.
2. **Inquilinos**: registra nombre, celular, fechas de ingreso/salida, cuántas
   habitaciones alquila y cuántas personas las habitan. Activa/desactiva su estado.
3. **Servicios del inquilino** (botón «Servicios» de cada inquilino): marca qué
   servicios se le cobran y las opciones adicionales (refrigeradores, ducha, luz de
   pasillo, herramientas eléctricas).
4. **Cobros**: elige el mes y presiona **«Generar cobros del periodo»**. El sistema
   reparte cada servicio entre los inquilinos suscritos:
   - `CUARTOS` → el costo se reparte según las habitaciones de cada uno.
   - `PERSONAS` → el costo se reparte según las personas de cada uno.
   - Los extras por consumo se suman a la base por inquilino.
5. **Pagos**: registra el pago (inquilino, servicio opcional, mes, fecha, monto, nota).
6. **Reportes**: detalle mensual (por inquilino, por servicio y línea por línea con
   exportación a CSV) o resumen general de todo.

## API del backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/snapshot` | todas las hojas (lo usa el front para el tiempo real) |
| GET | `/api/config` | estado de la conexión y periodos existentes |
| GET | `/api/dashboard` | resumen para el panel de inicio |
| GET/POST/PUT/DELETE | `/api/inquilinos` | CRUD de inquilinos (+ `/api/inquilinos/{id}/estado?habilitado=`) |
| GET/POST/PUT/DELETE | `/api/servicios` | CRUD de servicios |
| GET/PUT/DELETE | `/api/servicios-inquilinos`, `/api/inquilinos/{id}/servicios` | servicios y consumos por inquilino |
| GET | `/api/cobros?periodo=YYYY-MM` | cobros de un mes |
| POST | `/api/cobros/generar?periodo=YYYY-MM` | calcula y guarda los cobros del mes |
| GET/POST/DELETE | `/api/pagos` | registro de pagos |
| GET | `/api/reportes/mensual?periodo=YYYY-MM` | reporte mensual detallado |
| GET | `/api/reportes/general` | reporte general |

## Build de producción

```bash
cd backend && mvnw.cmd package          # genera target/alquileres-app-backend-1.0.0.jar
java -jar backend/target/alquileres-app-backend-1.0.0.jar

cd frontend && npm run build            # genera frontend/dist (sírvete con cualquier web server)
```

## Desplegar en Vercel (sin backend Java)

El frontend puede funcionar de DOS formas:

- **Modo local (desarrollo):** usa el backend Java (`npm run dev` con proxy a
  `http://localhost:8080`). No se necesita `VITE_API_URL`.
- **Modo script (producción/Vercel):** el frontend habla **directamente** con la
  Web App de Google Sheets (Apps Script). No hace falta ningún servidor: cobros,
  reportes, dashboard y CRUD están portados al propio `scripts/Code.gs`.

El modo se elige solo: si `VITE_API_URL` apunta a `script.google.com`, se usa el
modo script (polling cada 15 s para cuidar las cuotas de Apps Script); si está
vacía, se usa el backend local (polling cada 5 s).

### Pasos

**1) Actualiza el Apps Script (paso manual, necesario).** Vuelve a desplegar el
`scripts/Code.gs` en el spreadsheet `Casa`:
1. Abre el spreadsheet en Google Sheets.
2. `Extensiones` → `Apps Script`.
3. Reemplaza el contenido del archivo `Code.gs` por el nuevo `scripts/Code.gs`.
4. `Implementar` → `Administrar implementaciones` → botón **Editar** de la web app
   existente → `Versión: Nueva versión` → `Implementar`.

La URL pública queda igual (termina en `/exec`), pero ya sirve la API completa.

**2) Sube el frontend a Vercel** (el `vercel.json` ya tiene el preset Vite):

```bash
cd frontend
npm i -g vercel
vercel --prod --yes
```

El `frontend/.env.production` ya apunta a la Web App de Google, así que el build
queda listo sin más configuración. Este archivo contiene la URL pública de la
App Script (no es un secreto); se puede cambiar en cualquier momento.

**3) Abre la URL de producción desde el celular.** La app funciona igual en el
navegador del teléfono: pantalla principal, tablas con scroll y modales como
"hojas" desde abajo. El polling se pausa solo si el navegador pausa la pestaña
en segundo plano (comportamiento normal de los móviles).

> Si prefieres seguir usando el backend Java en producción, elimina la línea
> `VITE_API_URL` de `.env.production` y configura en Vercel la variable de
> entorno `VITE_API_URL` con la URL de tu backend público (no olvides hospedar
> el JAR, por ejemplo en Render).

## Tests

```bash
# Backend Java: motor de cobros
cd backend
mvnw.cmd test

# Logica del Apps Script (port del motor de cobros y reportes)
cd scripts
npm run test  # o: node scripts/test-logica.js
```