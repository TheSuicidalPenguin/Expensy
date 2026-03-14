/**
 * Convex Auth token validation config.
 *
 * This file is evaluated at DEPLOY TIME, not at runtime. We read the site URL
 * from the deployment environment to avoid hardcoding it. It matches the `iss`
 * claim in JWTs issued by @convex-dev/auth, which uses CONVEX_SITE_URL (the
 * built-in runtime variable) as the issuer.
 *
 * `@convex-dev/auth` serves its OIDC discovery endpoint and JWKs via the HTTP
 * routes registered in convex/http.ts (`auth.addHttpRoutes(http)`):
 *   GET {domain}/.well-known/openid-configuration
 *   GET {domain}/.well-known/jwks.json
 */
export default {
  providers: [
    {
      domain:
        process.env.CONVEX_SITE_URL ??
        (() => {
          throw new Error("Missing CONVEX_SITE_URL for auth.config.ts");
        })(),
      applicationID: "convex",
    },
  ],
};
