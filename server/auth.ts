import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { User } from "@shared/schema";

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string) {
  if (!stored.startsWith("$2")) {
    return supplied === stored;
  }
  return await bcrypt.compare(supplied, stored);
}

export function sanitizeUser(user: any) {
  if (!user) return user;
  const { 
    password, 
    ...sanitized 
  } = user;
  return sanitized;
}

export function setupAuth(app: Express) {
  const isProduction = app.get("env") === "production";
  const sessionSecret = process.env.SESSION_SECRET;

  if (isProduction && !sessionSecret) {
    console.error("ERRO CRÍTICO: SESSION_SECRET não está definida no ambiente de produção.");
    console.error("O servidor não pode iniciar sem uma chave de sessão segura em produção.");
    process.exit(1);
  }

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret || "r3pl1t_s3cr3t_k3y_12345",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  };

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());


  // Basic brute-force protection for login (no extra dependencies)
  const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const LOGIN_MAX_ATTEMPTS = 10; // attempts per IP per window
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  const loginLimiter = (req: any, res: any, next: any) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (req.ip || (typeof forwarded === "string" ? forwarded : Array.isArray(forwarded) ? forwarded[0] : "") || "unknown")
      .toString()
      .split(",")[0]
      .trim();

    const now = Date.now();
    const current = loginAttempts.get(ip);

    if (!current || now > current.resetAt) {
      loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
      return next();
    }

    if (current.count >= LOGIN_MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    }

    current.count += 1;
    loginAttempts.set(ip, current);
    return next();
  };


  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.isActive) {
          return done(null, false, { message: "Usuário não encontrado ou inativo" });
        }
        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Senha incorreta" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", loginLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Falha na autenticação" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        return res.json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(sanitizeUser(req.user));
    } else {
      res.status(401).json({ message: "Não autenticado" });
    }
  });
}
