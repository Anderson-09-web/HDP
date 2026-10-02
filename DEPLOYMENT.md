# Discord Bot Hosting

La plataforma se divide en dos despliegues y no ejecuta el bot en el navegador:

- **Cloudflare Pages**: `artifacts/discord-bot-hosting` como sitio estático. Crea el proyecto desde **Workers & Pages → Create application → Pages → Connect to Git** (no desde Workers). Mantén el **Root directory** en la raíz del repositorio, porque el build usa el workspace de pnpm. Define `SKIP_DEPENDENCY_INSTALL=1` y `PNPM_VERSION=10.11.1`. En el campo **Build command** pega únicamente:

  ```sh
  pnpm install --frozen-lockfile && pnpm --filter @workspace/discord-bot-hosting run build
  ```

  En **Build output directory** escribe `artifacts/discord-bot-hosting/dist/public`. El mismo directorio está declarado en `wrangler.toml`, cuyo campo `name` debe coincidir con el nombre del proyecto Pages (actualmente `hdp`). **Pages conectado a Git no pide Deploy command**: publica automáticamente al terminar el build. Si el formulario pide **Build command** y **Deploy command**, estás en el flujo de **Workers Builds**, no en Pages conectado a Git; vuelve y elige Pages. No pegues el texto «Build command» dentro del valor del campo: provocaría `/bin/sh: Build: not found`. En **Settings → Environment variables** configura `VITE_API_BASE_URL=https://hdp-dwys.onrender.com` y `VITE_CLERK_PUBLISHABLE_KEY` con la clave pública de la misma instancia de Clerk que usa Render. No añadas `/api` a la URL. Vuelve a desplegar Pages después de cambiar variables de build.
- **Render**: `render.yaml` ejecuta únicamente `artifacts/api-server`. Ese proceso administra el único proceso Python del bot.
- **Cloudflare R2**: contiene los archivos del bot. El bucket debe incluir `main.py`, `requirements.txt`, `cogs/` y `utils/` en la raíz del objeto. Nunca se borra el bucket durante un reinicio.
- **Neon**: `DATABASE_URL` apunta al Postgres de Neon. La API crea `bot_env` y `bot_config` si no existen; los Cogs usan `bot_config` para configuraciones persistentes.

## Arranque inicial de R2

Antes de pulsar **Start bot**, sube por el explorador de archivos el `main.py`, `requirements.txt`, `utils/` y los Cogs. También puedes copiar el contenido de `bot/` desde este repositorio al bucket preservando las rutas relativas. Si el bucket está vacío, el supervisor se niega a arrancar para evitar ejecutar un estado incompleto.

Desde el panel, **Files → Cargar archivos iniciales** carga el contenido de `bot/` directamente al bucket. Solo crea archivos que falten; repetir la acción conserva los archivos ya editados. Después, guarda `DISCORD_TOKEN` en **Settings** (se cifra y se persiste en Neon) o configúralo como variable protegida de Render. Inicia el bot desde Overview y consulta Logs. El botón de dependencias actualiza `requirements.txt` y prueba a instalar el paquete en Render.

## Variables requeridas en Render

Configura en Render las variables listadas en `.env.example`. `SESSION_SECRET`, `CLERK_SECRET_KEY`, `DATABASE_URL` y las claves R2 son secretos; no se devuelven al frontend. `FRONTEND_URL` debe ser el dominio exacto de Cloudflare Pages (`https://hdp-1xo.pages.dev`). `DISCORD_TOKEN` puede configurarse aquí o desde Settings; el secreto guardado en el panel se cifra en Neon y se pasa al proceso del bot al iniciarlo.

## Auth

En desarrollo local, la API permite operar sin Clerk únicamente para facilitar el arranque del dashboard. En producción exige un Bearer token válido de Clerk. Como el API está en otro origen (Render), el frontend añade el token de la sesión automáticamente y Render lo verifica con `CLERK_SECRET_KEY`. Las dos claves deben pertenecer a la misma instancia.

### Clerk sin dominio propio

Clerk exige un dominio Production confirmado y bajo tu control. El hostname gratuito `*.pages.dev` pertenece al hosting y no se puede confirmar con tus propios registros DNS; una clave `pk_live_` no es compatible con ese dominio. El código de este repositorio no establece `CLERK_FRONTEND_API`, `Clerk-Frontend-Api` ni `Clerk-Proxy-Url`: el Frontend API se obtiene de la clave pública. El proxy oficial puede reemplazar el CNAME del Frontend API, pero no convierte un hostname `pages.dev` en un dominio Production confirmado.

Sin comprar un dominio, la alternativa compatible es usar el par de claves de la instancia **Development** de Clerk: `VITE_CLERK_PUBLISHABLE_KEY` (`pk_test_…`) en Cloudflare Pages y la clave secreta coincidente (`sk_test_…`) en Render. Esto autentica contra la instancia Development y sus cuentas separadas; no es la instancia Production ni debe usarse para datos o usuarios de producción. Después de cambiar las variables, vuelve a desplegar Pages y reinicia el servicio de Render. Nunca pongas la clave secreta en Pages ni la compartas.