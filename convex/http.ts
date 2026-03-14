import { httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * HTTP router.
 *
 * Registers the Convex Auth HTTP routes under their default paths:
 *   POST /api/auth/signin   – initiates a sign-in session
 *   POST /api/auth/signout  – invalidates the current session
 *   GET  /api/auth/session  – returns the current session metadata
 *
 * Additional custom HTTP routes (e.g. file upload callbacks) can be
 * added here with `http.route(...)`.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
