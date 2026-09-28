# Discord Bot Hosting

Dashboard y control plane para alojar un único bot de Discord en Python con Render, Cloudflare R2, Neon y Cloudflare Pages.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/discord-bot-hosting run dev` — run the static dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required production env: see `.env.example` and `DEPLOYMENT.md`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/discord-bot-hosting/` — frontend React/Vite estático, sin acceso directo a Discord/R2/Neon.
- `artifacts/api-server/src/routes/` — API Express bajo `/api`.
- `artifacts/api-server/src/services/` — supervisor Python, R2, Neon, logs, archivos y variables.
- `bot/` — un solo proceso `discord.py`, con Cogs independientes y persistencia Neon.
- `lib/api-spec/openapi.yaml` — contrato HTTP fuente de verdad.
- `render.yaml`, `.env.example`, `DEPLOYMENT.md` — despliegue y configuración.

## Architecture decisions

- Cloudflare Pages solo sirve el dashboard; Render es el único lugar que ejecuta Python y administra el proceso.
- R2 es la fuente persistente de archivos; un bucket vacío bloquea el arranque en vez de borrar o inventar archivos.
- Todos los Cogs viven dentro de un único proceso `discord.py`; un error al cargar un Cog se registra y los demás continúan.
- Variables creadas desde el dashboard se cifran con `SESSION_SECRET` antes de guardarse en Neon y nunca se devuelven al frontend.
- En producción la API exige un Bearer token de Clerk; en desarrollo local la autenticación se puede omitir para inspección del dashboard.

## Product

El dashboard muestra estado real del proceso y gateway de Discord, ejecuta start/stop/restart con protección contra procesos duplicados, administra archivos R2 sin reinicios automáticos, instala dependencias, filtra y exporta logs acotados, y permite gestionar variables enmascaradas.

## User preferences

- La arquitectura debe mantener Pages, Render, R2, Neon y Discord separados; no introducir procesos por Cog ni simulaciones de estado.

## Gotchas

- Hay que configurar Render/R2/Neon/Clerk antes de iniciar el bot. Un `GET /api/healthz` saludable no implica que el bot pueda iniciar.
- Los archivos deben estar en la raíz lógica del bucket R2 (`main.py`, `requirements.txt`, `cogs/...`, `utils/...`), no bajo `bot/`.
- Los cambios de archivos quedan pendientes hasta reiniciar explícitamente el bot.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
