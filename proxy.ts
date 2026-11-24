import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  if (process.env.ENFORCE_HTTPS === 'true') {
    const canonical = new URL(process.env.APP_ORIGIN!);
    if (
      canonical.protocol !== 'https:' ||
      canonical.pathname !== '/' ||
      canonical.username ||
      canonical.search ||
      canonical.hash
    )
      throw new Error('APP_ORIGIN must be an HTTPS origin');
    const host = request.headers.get('host');
    // This switch requires an origin port isolated from LAN and other callers.
    const scheme =
      process.env.ORIGIN_PROXY_ONLY === 'true' ? request.headers.get('x-forwarded-proto') : null;
    if (
      request.nextUrl.pathname !== '/api/health' &&
      (scheme !== 'https' || host !== canonical.host)
    ) {
      if (!['GET', 'HEAD'].includes(request.method))
        return NextResponse.json(
          { error: 'Use o endereço HTTPS do projeto.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      const target = new URL(canonical);
      target.pathname = request.nextUrl.pathname;
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 308);
    }
  }
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const headers = new Headers(request.headers);
  // Replace incoming values; neither the nonce nor the policy is client-controlled.
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg).*)'],
};
