/**
 * Origins allowed to call the API directly with credentials. In production
 * the frontend proxies every call through its own origin, so only
 * FRONTEND_URL is listed there (SEC-20: no http://localhost:3000, which any
 * local page or tool could claim). Elsewhere localhost is added for dev.
 */
export function corsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = [env.FRONTEND_URL];
  if (env.NODE_ENV !== 'production') origins.push('http://localhost:3000');
  return [
    ...new Set(
      origins
        .filter((o): o is string => Boolean(o?.trim()))
        .map((o) => o.trim().replace(/\/+$/, '')),
    ),
  ];
}
