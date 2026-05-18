import type { MiddlewareHandler } from 'astro'

// ─────────────────────────────────────────────
// IN-MEMORY RATE LIMITER
// Tracks request counts per IP address.
// A Map is fine for a single Cloud Run instance.
// If you ever scale to multiple instances, swap
// this for a Redis-backed solution.
// ─────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Config per endpoint
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  '/api/contact': { maxRequests: 5, windowMs: 15 * 60 * 1000 },  // 5 per 15 min
}

function getRealIP(request: Request): string {
  // Cloud Run passes the real client IP in this header
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function isRateLimited(ip: string, endpoint: string): boolean {
  const limit = RATE_LIMITS[endpoint]
  if (!limit) return false  // no limit configured for this endpoint

  const now = Date.now()
  const key = `${ip}:${endpoint}`
  const entry = rateLimitStore.get(key)

  // If no entry or window has expired, start a fresh window
  if (!entry || now - entry.windowStart > limit.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return false
  }

  // Increment count and check against limit
  entry.count++
  if (entry.count > limit.maxRequests) {
    return true
  }

  return false
}

// Clean up expired entries every 30 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    const endpoint = key.split(':')[1]
    const limit = Object.values(RATE_LIMITS).find(
      (_, i) => Object.keys(RATE_LIMITS)[i] === endpoint
    )
    if (limit && now - entry.windowStart > limit.windowMs) {
      rateLimitStore.delete(key)
    }
  }
}, 30 * 60 * 1000)

// ─────────────────────────────────────────────
// MIDDLEWARE HANDLER
// Astro runs this before every request.
// ─────────────────────────────────────────────
export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request } = context
  const url = new URL(request.url)
  const path = url.pathname

  // Only apply rate limiting to POST requests on configured endpoints
  if (request.method === 'POST' && RATE_LIMITS[path]) {
    const ip = getRealIP(request)

    if (isRateLimited(ip, path)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many requests. Please wait a few minutes and try again.'
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  // Request is allowed — continue to the page or API endpoint
  return next()
}