# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Router v7 application deployed to Cloudflare Workers. It uses server-side rendering (SSR) with React 19, TailwindCSS v4 for styling, and TypeScript throughout.

## Architecture

### Deployment Model
- **Runtime**: Cloudflare Workers (edge runtime)
- **Entry point**: `workers/app.ts` (configured in `wrangler.jsonc`)
- **SSR**: Server-side rendering enabled via React Router v7

### Key Files
- `workers/app.ts`: Cloudflare Worker entry point that creates the request handler and passes Cloudflare context (`env`, `ctx`) to the React Router app
- `app/entry.server.tsx`: Server-side rendering logic with bot detection using `isbot`
- `app/routes.ts`: Route configuration (file-based routing)
- `app/root.tsx`: Root React component and layout
- `react-router.config.ts`: React Router configuration (SSR enabled, unstable Vite environment API enabled)
- `vite.config.ts`: Vite configuration with Cloudflare, TailwindCSS, and React Router plugins
- `wrangler.jsonc`: Cloudflare Workers configuration

### TypeScript Configuration
The project uses a composite TypeScript setup with three tsconfig files:
- `tsconfig.json`: Base configuration with project references
- `tsconfig.node.json`: For Node.js tooling (vite.config.ts)
- `tsconfig.cloudflare.json`: For app and worker code with DOM types

### Type Generation
- `npm run cf-typegen` generates Cloudflare Worker types from `wrangler.jsonc` into `worker-configuration.d.ts`
- `react-router typegen` generates route types (happens during typecheck)
- These run automatically on `postinstall`

### Routing
Routes are defined in `app/routes.ts` using the React Router v7 route config format. Import route builders from `@react-router/dev/routes` and define routes as an array.

### Cloudflare Context
Access Cloudflare bindings and context in loaders/actions via:
```typescript
export async function loader({ context }: Route.LoaderArgs) {
  const { env, ctx } = context.cloudflare;
  // env contains bindings (KV, D1, R2, etc.)
  // ctx is the ExecutionContext
}
```

## Common Commands

### Development
```bash
npm run dev              # Start dev server with HMR at http://localhost:5173
```

### Type Checking
```bash
npm run typecheck        # Run TypeScript compiler, generate types
npm run cf-typegen       # Generate Cloudflare Worker types only
```

### Building
```bash
npm run build            # Production build
npm run preview          # Preview production build locally
```

### Deployment
```bash
npm run deploy           # Build and deploy to Cloudflare Workers (production)
npx wrangler versions upload   # Deploy preview URL
npx wrangler versions deploy   # Promote preview to production
```

### Wrangler CLI
```bash
npx wrangler dev         # Alternative dev server using Wrangler
npx wrangler tail        # View live logs from production
npx wrangler types       # Alias for cf-typegen
```

## Development Notes

### Adding Routes
1. Create route component in `app/routes/`
2. Register in `app/routes.ts` using route config format
3. Types are auto-generated on next typecheck

### Adding Cloudflare Bindings
1. Add binding configuration to `wrangler.jsonc` (KV, D1, R2, etc.)
2. Run `npm run cf-typegen` to update types
3. Access via `context.cloudflare.env` in loaders/actions

### Path Aliases
- `~/*` resolves to `./app/*` (configured in tsconfig)
- Example: `import { something } from "~/utils/helpers"`

### Styling
TailwindCSS v4 is configured via `@tailwindcss/vite` plugin. Styles are imported in `app/app.css`.
