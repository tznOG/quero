export function publicOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN;
  if (!configured) return new URL(request.url).origin;
  const url = new URL(configured);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('APP_ORIGIN must be an HTTP(S) origin without path, credentials or query.');
  }
  return url.origin;
}

// All browser access uses the canonical origin. Local development may configure HTTP.
export function requestOrigin(request: Request): string {
  return publicOrigin(request);
}
