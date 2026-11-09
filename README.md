# Mis Gastos 🌿

App personal (PWA) de gastos: lee los avisos de **BAC, BCR y Banco Popular** (compras, SINPE y
transferencias) desde Gmail y muestra un reporte mensual en colones. Tiene gastos **personales** y
**grupos** compartidos (ej. "Tour a caballo") donde varios usuarios agregan gastos.

```
Gmail ──(Apps Script, cada 15 min)──▶ Backend (Render, /api/gastos) ──▶ Postgres (Neon, esquema "gastos")
                                                 ▲
                                      App web (React PWA, GitHub Pages)
```

| Carpeta | Qué es |
|---|---|
| `apps-script/Code.gs` | Lector de Gmail: convierte cada aviso del banco en gasto y lo manda al backend |
| `web/` | La app (React + Vite + PWA) |

El backend vive en el repo del negocio (`backend/gastos/`), en su propio esquema de Postgres.

## Usuarios

- Se crean con `node scripts/gastos-crear-usuarios.mjs` (en el backend): cada uno recibe un **código de activación**.
- En la app: *Primera vez u olvidé la contraseña* → código + cédula + contraseña nueva. Después se entra con cédula y contraseña.
- Sesión de **1 mes**, bloqueo de 15 min tras 5 intentos, **Face ID** opcional en el celular.
- Solo los usuarios con `lee_correo` reciben gastos del correo (por ahora, Josué). Los demás agregan a mano.

## Grupos

- *+ Grupo* crea un grupo y elige quiénes están. Cada grupo tiene sus propias categorías y su reporte, con cuánto puso cada quien.
- Un gasto personal se puede **mandar a un grupo** (sale de lo personal) y devolver.
- El botón **+** agrega un gasto a mano en lo personal o en el grupo abierto.

## Notificaciones

Ajustes ⚙️ → *Notificaciones*. En iPhone primero hay que agregar la app a la pantalla de inicio
(Safari → Compartir → *Agregar a inicio*). Cada gasto nuevo llega como aviso; al tocarlo se abre para clasificarlo.

## Apps Script (lector de Gmail)

1. En el proyecto de Apps Script pegar `apps-script/Code.gs`.
2. ⚙️ Configuración del proyecto → **Propiedades del script**:
   - `GASTOS_BACKEND_URL` = `https://<backend>.onrender.com/api/gastos`
   - `GASTOS_INGEST_TOKEN` = la misma clave que `GASTOS_INGEST_TOKEN` en Render
3. Ejecutar `migrarHojaAlBackend` (una vez, si había datos en la hoja de Google) y luego `configurar`.
4. (Opcional, para el botón 🔄) Implementar como aplicación web y poner su URL en `GASTOS_SCRIPT_URL` en Render.

`revisarCorreos` muestra en el registro qué correos de los bancos se convierten en gasto y cuáles no.

## Cómo clasifica

1. **Reglas aprendidas**: al cambiar la categoría de un gasto, los próximos de ese comercio caen solos ahí.
2. **Palabras clave** (`backend/gastos/categorizar.js`): Automercado → Supermercado, Uber → Transporte, etc.
3. Si nada coincide → **Por clasificar**.

Las categorías se editan en Ajustes → *Categorías*. Un gasto se puede **eliminar** (con *Deshacer*); el correo no lo vuelve a agregar.

## Desarrollo

```bash
cd web
npm install
npm run dev        # http://localhost:5173/#demo
```

`web/.env`: `VITE_API_URL=https://<backend>.onrender.com/api/gastos`
