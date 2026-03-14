/**
 * Convex Auth token validation config.
 *
 * This file is evaluated at DEPLOY TIME, not at runtime, so
 * process.env.CONVEX_SITE_URL would be undefined here. The site URL must be
 * hardcoded. It matches the `iss` claim in JWTs issued by @convex-dev/auth,
 * which uses CONVEX_SITE_URL (the built-in runtime variable) as the issuer.
 *
 * `@convex-dev/auth` serves its OIDC discovery endpoint and JWKs via the HTTP
 * routes registered in convex/http.ts (`auth.addHttpRoutes(http)`):
 *   GET {domain}/.well-known/openid-configuration
 *   GET {domain}/.well-known/jwks.json
 */
export default {
  providers: [
    {
      domain: "https://frugal-pigeon-938.convex.site",
      applicationID: "convex",
    },
  ],
};
