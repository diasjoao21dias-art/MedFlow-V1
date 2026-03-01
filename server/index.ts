import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrations";

const app = express();

// Trust proxy in production (needed for correct protocol/host on common PaaS)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Basic security headers (kept permissive to avoid breaking Vite dev / SPA)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// Lightweight CSRF mitigation for cookie-based sessions.
// Blocks cross-site POST/PUT/PATCH/DELETE when the browser sends an Origin/Referer that
// doesn't match the current host. (Disable with CSRF_CHECK=false)
app.use((req, res, next) => {
  if (process.env.CSRF_CHECK === "false") return next();
  if (process.env.NODE_ENV !== "production") return next();

  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Only enforce when the browser provides origin/referer (curl/healthchecks often won't).
  const source = (typeof origin === "string" && origin) || (typeof referer === "string" && referer) || "";
  if (!source) return next();

  const host = req.get("host");
  if (!host) return next();

  // Prefer X-Forwarded-Proto when behind proxy
  const xfProto = (req.headers["x-forwarded-proto"] as string | undefined) || "";
  const proto = xfProto.split(",")[0].trim() || (req.secure ? "https" : "http");
  const expectedOrigin = `${proto}://${host}`;

  // Accept exact match or same-origin referer
  if (typeof origin === "string") {
    if (origin !== expectedOrigin) return res.status(403).json({ message: "CSRF bloqueado (origem inválida)" });
  } else if (typeof referer === "string") {
    if (!referer.startsWith(expectedOrigin)) return res.status(403).json({ message: "CSRF bloqueado (referer inválido)" });
  }

  return next();
});


const httpServer = createServer(app);

// Ensure uploads directory exists (configurable via UPLOAD_DIR)
// NOTE: For hosts with ephemeral disks (e.g., Render), set UPLOAD_DIR to a persistent disk mount path.
const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploads as static files
app.use("/uploads", express.static(uploadsDir));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  runMigrations();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      // No Windows local, reusePort pode causar erros dependendo da versão do Node/OS
      reusePort: process.platform !== "win32", 
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
