import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const protectedRoutes = ['/dashboard'];
const authRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes, and internal Next.js paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  // Check for access token in cookies or headers
  const accessToken = request.cookies.get('cs_access_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname === route || pathname.startsWith(route + '/')
  );
  const isAuthRoute = authRoutes.some((route) =>
    pathname === route || pathname.startsWith(route + '/')
  );

  // If accessing a protected route without a token
  if (isProtectedRoute && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If accessing login while already authenticated, redirect to dashboard
  if (isAuthRoute && accessToken) {
    try {
      // Validate token by calling the backend
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      // Token invalid, clear cookie and allow login page
      const response = NextResponse.next();
      response.cookies.delete('cs_access_token');
      return response;
    }
  }

  // Add security headers
  const response = NextResponse.next();

  // Prevent caching of authenticated pages
  if (isProtectedRoute) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
  }

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
