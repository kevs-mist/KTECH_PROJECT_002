import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 1. Strict Content Security Policy (CSP)
  // Allows connections to Firebase Auth, Supabase DB & Storage, and maps APIs
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://*.supabase.co https://*.google.com https://*.googleapis.com https://www.gstatic.com;
    media-src 'self' blob: data: https://*.supabase.co;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com;
    font-src 'self' data: https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-src 'self' https://*.firebaseapp.com;
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set("Content-Security-Policy", cspHeader);

  // 2. Clickjacking Protection
  response.headers.set("X-Frame-Options", "DENY");

  // 3. MIME-Type Sniffing Protection
  response.headers.set("X-Content-Type-Options", "nosniff");

  // 4. Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // 5. Strict Transport Security (HSTS)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // 6. Permissions Policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(self), payment=()"
  );

  return response;
}

// Apply middleware to all routes except static resources
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)"
  ]
};
