// The API only serves JSON/CSV, so framing, referrers and embedding are all denied.
export function securityHeaders(environment: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-site',
  };
  if (['staging', 'production'].includes(environment))
    headers['Strict-Transport-Security'] =
      'max-age=31536000; includeSubDomains';
  return headers;
}
