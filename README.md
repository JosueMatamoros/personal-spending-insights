# Mis Gastos 🌿

App personal (PWA) que lee los avisos de compra de **BAC, BCR y Banco Popular** que llegan a
Gmail, los guarda en una hoja de Google Sheets y muestra un reporte mensual en colones.

```
Gmail ──(cada 15 min)──▶ Apps Script ──▶ Google Sheets ◀── App web (React PWA)
```

## Carpetas

| Carpeta | Qué es |
|---|---|
| `apps-script/Code.gs` | Lee los correos, clasifica y expone la API |
| `web/` | La app (React + Vite + PWA) |

## 1. Instalar el Apps Script (una sola vez, en la cuenta de Gmail que recibe los avisos)

1. Entrar a <https://sheets.new> con la cuenta de Gmail que recibe los avisos y nombrar la hoja **Mis Gastos**.
2. Menú **Extensiones → Apps Script**.
3. Borrar el contenido de `Código.gs` y pegar todo `apps-script/Code.gs`. Guardar (💾).
4. En **Configuración del proyecto** (⚙️), confirmar que la zona horaria es **(GMT-06:00) Costa Rica**.
5. Arriba elegir la función **`configurar`** y presionar **Ejecutar**.
   - Google pide permisos: *Revisar permisos → elegir la cuenta → Configuración avanzada → Ir a Mis Gastos (no seguro) → Permitir*.
     (Dice "no seguro" solo porque es un script propio, no publicado.)
   - En el **Registro de ejecución** aparece la **🔑 clave de acceso**. Anotarla.
6. **Implementar → Nueva implementación → tipo "Aplicación web"**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Copiar la **URL** que termina en `/exec`.

> La URL sola no da acceso: cada consulta exige la clave. Si se necesita ver la clave otra vez, ejecutar `verClave`.
> Para probar la lectura sin guardar nada: ejecutar `probarLectura` y revisar el registro.

## 2. Abrir la app

En la pantalla de inicio se pega la **URL** y la **clave**. Para instalarla en el celular:
- **iPhone (Safari):** Compartir → *Agregar a pantalla de inicio*.
- **Android (Chrome):** menú ⋮ → *Instalar app*.

Para ver un ejemplo sin conectar nada: abrir la app con `#demo` al final de la dirección.

## Cómo clasifica

1. **Reglas aprendidas** (hoja `Reglas`): cuando se cambia la categoría de un gasto en la app, el comercio
   queda guardado y los próximos gastos de ese comercio caen solos en esa categoría.
2. **Palabras clave** (`PALABRAS_CLAVE` en `Code.gs`): Automercado → Supermercado, Uber → Transporte, etc.
3. Si nada coincide → **Otros**.

Los **SINPE** se clasifican por la *Descripción* que se escribe al hacerlos (ej. "alquiler", "super", "uber").

Notas:
- Solo cuentan compras **aprobadas** (BCR) y de tipo **COMPRA** (BAC / Popular). Los SINPE solo si son débitos.
- Cada gasto se identifica por su número de referencia, así nunca se duplica.
- Compras en dólares se convierten con `TIPO_CAMBIO_USD` (₡505, ajustable en `Code.gs`).
- Se cargan gastos desde el **1 de noviembre 2026** (`FECHA_INICIO`).

## Desarrollo

```bash
cd web
npm install
npm run dev        # http://localhost:5173/#demo
npm run build      # genera web/dist para publicar
```

Opcional: crear `web/.env` con `VITE_API_URL=<url /exec>` para que la app solo pida la clave.
