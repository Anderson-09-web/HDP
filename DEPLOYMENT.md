# Discord Bot Hosting

La plataforma se divide en dos despliegues y no ejecuta el bot en el navegador:

- **Cloudflare Pages**: `artifacts/discord-bot-hosting` como sitio estático. Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/discord-bot-hosting run build`. Output: `artifacts/discord-bot-hosting/dist/public`.
- **Render**: `render.yaml` ejecuta únicamente `artifacts/api-server`. Ese proceso administra el único proceso Python del bot.
- **Cloudflare R2**: contiene los archivos del bot. El bucket debe incluir `main.py`, `requirements.txt`, `cogs/` y `utils/` en la raíz del objeto. Nunca se borra el bucket durante un reinicio.
- **Neon**: `DATABASE_URL` apunta al Postgres de Neon. La API crea `bot_env` y `bot_config` si no existen; los Cogs usan `bot_config` para configuraciones persistentes.

## Arranque inicial de R2

Antes de pulsar **Start bot**, sube por el explorador de archivos el `main.py`, `requirements.txt`, `utils/` y los Cogs. También puedes copiar el contenido de `bot/` desde este repositorio al bucket preservando las rutas relativas. Si el bucket está vacío, el supervisor se niega a arrancar para evitar ejecutar un estado incompleto.

## Variables requeridas en Render

Configura en Render las variables listadas en `.env.example`. `DISCORD_TOKEN`, `SESSION_SECRET`, `CLERK_SECRET_KEY`, `DATABASE_URL` y las claves R2 son secretos; no se devuelven al frontend. `FRONTEND_URL` debe ser el dominio exacto de Cloudflare Pages.

## Auth

En desarrollo local, la API permite operar sin Clerk únicamente para facilitar el arranque del dashboard. En producción exige un Bearer token válido de Clerk. El frontend añade el token de la sesión automáticamente cuando `VITE_CLERK_PUBLISHABLE_KEY` está configurada.