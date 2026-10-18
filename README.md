# Alquileres App v2

Sistema para administrar los **pagos por servicios y alquiler de una casa** con varios
inquilinos. La información vive en un **spreadsheet de Google Sheets** (una hoja por
entidad) y se muestra casi en tiempo real en el frontend.

```
┌────────────┐  versión c/6 s ┌──────────────────────────┐
│  Frontend  │ ─────────────> │ Apps Script (Code.gs)    │  producción (Vercel)
│ React + TS │   ?key=CLAVE   │ sobre la planilla "Casa" │
└────────────┘                └──────────────────────────┘
       │ polling 5 s           ┌───────────────────┐  sync 30 s   ┌──────────────┐
       └──────────────────────>│ Backend Java      │ ───────────> │ Apps Script  │  desarrollo
          X-Api-Key: CLAVE     │ Spring Boot 3.5   │  o JSON local└──────────────┘
                               └───────────────────┘
```

## Estructura

| Carpeta     | Contenido |
|-------------|-----------|
| `scripts/`  | `Code.gs`: API completa sobre la planilla (es la que usa producción) + `test-logica.js`. |
| `frontend/` | React + TypeScript + Vite. |
| `backend/`  | API REST Java (Spring Boot). Misma lógica que `Code.gs`; útil para desarrollo local. |

### Hojas de la planilla

| Hoja | Qué guarda |
|------|-----------|
| `inquilinos` | nombre, celular, fecha ingreso/salida, habilitado, habitaciones, personas, `cobraAlquiler`, `alquilerBs` |
| `servicios` | nombre, unidad de medida, método de reparto (`CUARTOS` o `PERSONAS`) y lista de tipos de extra |
| `asignaciones` | por **mes**, qué servicios se cobran a cada inquilino y sus extras (cantidades) |
| `pagos` | facturas de servicios (pago **sin** inquilino) y pagos de inquilinos |
| `cobros` | líneas de cobro generadas mes a mes |
| `servicios_inquilinos` | configuración heredada (ya no interviene en el cálculo) |

Puedes agregar columnas propias a cualquier hoja (notas, colores…): la app solo escribe
sus columnas y **conserva las demás**.

## Reglas de cálculo

- **Factura**: cada mes registras el importe real de cada servicio (pantalla *Facturas*).
- **Reparto**: la factura se divide entre los inquilinos asignados ese mes según su
  factor = cuartos (o personas) + 1 por cada extra. La diferencia de centavos por
  redondeo va al de mayor factor, así la suma cuadra exacta con la factura.
- **Alquiler**: si el inquilino tiene `cobraAlquiler`, se cobra `alquilerBs` completo en
  cada mes en que habite la casa (al regenerar todo el mes).
- **Activo en el mes**: habilitado, con ingreso antes del fin de mes y sin salida antes
  del inicio del mes.
- **Pagos**: se aplican primero al mes que indican y el sobrante a la deuda más antigua.
- **Cambiar una factura** ya repartida recalcula sus cobros con los mismos pesos.
  Una factura con pagos de inquilinos no se puede eliminar (se corrige el monto).
- **Reajustar pesos** de un servicio se bloquea solo si un inquilino ya pagó *ese*
  servicio en ese mes.
- **Eliminar** un inquilino o servicio con cobros/pagos no está permitido (se
  deshabilita); sin historial se elimina junto con sus asignaciones.
- "Hoy" y el mes actual se calculan en la zona horaria `America/La_Paz`.

## Velocidad

- **Abre al instante**: cada dispositivo guarda la última copia de los datos y la muestra
  mientras consulta si hay cambios (se borra al cerrar sesión).
- **Consulta liviana**: cada 6 s solo se pregunta la *versión* de los datos
  (`?action=version`); los datos completos se piden únicamente cuando cambian. Con la
  pestaña en segundo plano no se consulta.
- **Caché en el script**: la respuesta completa (`sync`) se guarda en `CacheService` por
  versión; las lecturas repetidas no vuelven a leer la planilla.
- **Guardar sin esperar dos veces**: cada escritura devuelve los datos actualizados en la
  misma respuesta (`?conSync=1`).
- **Reportes y panel se calculan en el navegador**: no llaman al servidor.
- Una edición manual en la planilla cambia la versión mediante el disparador simple
  `onEdit`; si Google no lo ejecutara, la caché igual expira a los 2 minutos.

## Reportes

| Reporte | Para quién | Qué muestra |
|---------|-----------|-------------|
| **Resumen del mes** | Administrador | Frase resumen, cobrado/pagado/falta, por inquilino y por servicio, aviso si un reparto no cuadra con su factura. |
| **Estado de cuenta** | Inquilino | Mes por mes: cada cargo con la explicación del cálculo («Factura de Luz Bs 348 repartida entre 13 partes; te corresponden 2…»), pagos y saldo. Imprimible y con botón **Enviar por WhatsApp**. |
| **Historial anual** | Administrador | Gráfico cobrado vs pagado por mes, facturas por servicio y situación de cada inquilino mes a mes. |
| Detalle del mes / Por inquilino | Administrador | Tablas detalladas anteriores (con exportación CSV). |

## Seguridad: clave de acceso

Todas las llamadas exigen una clave. Sin clave configurada, el script rechaza todo.

1. En el editor de Apps Script ejecuta **una vez** la función `generarClave()`
   (menú *Ejecutar*). Copia la clave que aparece en *Registro de ejecución*.
   (También puedes definirla a mano en *Configuración del proyecto → Propiedades del
   script → `API_KEY`*.)
2. Al abrir la app, cada dispositivo pide la clave una vez y la recuerda.
   *Cerrar sesión* (barra lateral) la borra de ese dispositivo.
3. Para cambiarla, vuelve a ejecutar `generarClave()`: todos los dispositivos deberán
   ingresarla de nuevo.

## Puesta en marcha

### Producción: Apps Script + Vercel

1. Abre la planilla → `Extensiones` → `Apps Script`, reemplaza `Code.gs` con
   `scripts/Code.gs` y guarda.
2. Ejecuta `generarClave()` (ver arriba) y autoriza los permisos que pida.
3. `Implementar` → `Administrar implementaciones` → **Editar** → `Versión: Nueva versión`
   → `Implementar`. La URL `/exec` no cambia.
   (Primera vez: `Nueva implementación` → *Aplicación web*, ejecutar como **Yo**,
   acceso **Cualquier persona**; la clave es la que protege los datos.)
4. En Vercel (o en `frontend/.env.production`, que no se sube a git) define
   `VITE_API_URL=https://script.google.com/macros/s/<ID>/exec` y despliega:
   ```bash
   cd frontend
   vercel --prod --yes
   ```

### Desarrollo local con el backend Java

Requisitos: Java 17+ y Node 20+.

```bash
# 1) secretos locales (no se suben a git)
cd backend
copy secrets.properties.example secrets.properties   # y completa los valores
mvnw.cmd spring-boot:run                              # http://localhost:8080

# 2) frontend
cd frontend
npm install
npm run dev                                           # http://localhost:5173
```

`backend/secrets.properties` (o variables de entorno equivalentes):

| Propiedad | Variable | Uso |
|-----------|----------|-----|
| `app.sheets.deploy-id` | `APP_SHEETS_DEPLOY_ID` | ID de implementación del script. Vacío = modo local (`data/db.json`). |
| `app.sheets.script-key` | `APP_SHEETS_SCRIPT_KEY` | La clave `API_KEY` del script. |
| `app.security.api-key` | `APP_SECURITY_API_KEY` | Clave que el frontend envía al backend (`X-Api-Key`). Vacía = sin protección (solo desarrollo). |
| `app.security.cors-origins` | `APP_SECURITY_CORS_ORIGINS` | Orígenes permitidos (por defecto `http://localhost:5173`). |

Si `VITE_API_URL` está vacía el frontend usa el backend local (proxy de Vite, polling
5 s); si apunta a `script.google.com` usa el Apps Script (consulta la versión cada 6 s). El polling no
superpone consultas y se pausa con la pestaña en segundo plano.

## API

### Apps Script (`?action=...&key=CLAVE`)

| Método | Acción |
|--------|--------|
| GET | `snapshot`, `sync`, `config`, `dashboard`, `reporte.mensual&periodo=`, `reporte.general`, `cobros[&periodo=]`, `diagnostico&periodo=` |
| GET | `version` (solo la versión de los datos) |
| POST | `inquilinos.crear/actualizar/eliminar/estado`, `servicios.crear/actualizar/eliminar`, `asignaciones.guardar/eliminar/copiar&origen=&destino=`, `servicios_inquilinos.guardar/eliminar`, `pagos.crear/eliminar`, `cobros.generar`, `cobros.generarServicio`, `cobros.editarPeso` |

Responden `{ ok: true, data }` o `{ ok: false, error }`; las escrituras con `&conSync=1` agregan `sync`. Los errores de clave empiezan
con `NO_AUTORIZADO` o `NO_CONFIGURADA`.

### Backend Java (`/api`, cabecera `X-Api-Key`)

| Método | Ruta |
|--------|------|
| GET | `/snapshot`, `/config`, `/dashboard`, `/reportes/mensual?periodo=`, `/reportes/general` |
| CRUD | `/inquilinos` (+ `POST /inquilinos/{id}/estado?habilitado=`), `/servicios`, `/asignaciones`, `/servicios-inquilinos` |
| GET/POST/DELETE | `/pagos` |
| GET/POST | `/cobros?periodo=`, `/cobros/generar?periodo=`, `/cobros/generarServicio?periodo=&servicioId=`, `/cobros/editarPeso?periodo=&servicioId=` |

Errores: 400 datos inválidos, 401 clave, 409 operación no permitida (p. ej. eliminar con historial).

## Tests

```bash
node scripts/test-logica.js        # lógica de Code.gs (sin Google)
cd backend && mvnw.cmd test        # backend Java
cd frontend && npm run build       # chequeo de tipos + build
```
