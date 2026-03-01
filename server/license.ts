import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sqlite } from "./db";

type DecodedLicense = {
  v: number;
  days: number;
  iat: number; // unix seconds
  exp: number; // unix seconds
};

const SECRET_FILE = path.resolve(process.cwd(), ".license_secret");

function base64UrlEncode(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(str: string) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(s, "base64");
}

export function getLicenseSecret(): string {
  if (process.env.LICENSE_SECRET && process.env.LICENSE_SECRET.trim().length >= 16) {
    return process.env.LICENSE_SECRET.trim();
  }
  // Local dev/desktop installs: persist a secret file so keys remain valid across restarts.
  if (fs.existsSync(SECRET_FILE)) {
    const content = fs.readFileSync(SECRET_FILE, "utf-8").trim();
    if (content.length >= 16) return content;
  }
  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(SECRET_FILE, generated, { encoding: "utf-8", flag: "w" });
  } catch {
    // ignore (read-only filesystem); fall back to generated in-memory secret
  }
  return generated;
}

export function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf-8").digest("hex");
}

export function decodeAndVerifyLicenseKey(key: string): { decoded: DecodedLicense } {
  const trimmed = key.trim();
  const normalized = trimmed.startsWith("MF1-") ? trimmed.slice(4) : trimmed;
  const [payloadB64, sigB64] = normalized.split(".");
  if (!payloadB64 || !sigB64) throw new Error("Chave inválida");

  const secret = getLicenseSecret();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadB64, "utf-8")
    .digest();
  const provided = base64UrlDecode(sigB64);
  // timing-safe compare
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error("Assinatura inválida");
  }

  const payloadJson = base64UrlDecode(payloadB64).toString("utf-8");
  const parsed = JSON.parse(payloadJson) as DecodedLicense;
  if (!parsed || parsed.v !== 1) throw new Error("Versão da licença inválida");
  if (!Number.isFinite(parsed.iat) || !Number.isFinite(parsed.exp) || parsed.exp <= parsed.iat) {
    throw new Error("Dados da licença inválidos");
  }
  return { decoded: parsed };
}

// --- DB helpers (single row id=1) ---
export function ensureLicenseTable() {
  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY,
        key_hash TEXT,
        issued_at INTEGER,
        expires_at INTEGER,
        activated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`
    )
    .run();

  // Ensure row exists
  sqlite
    .prepare("INSERT OR IGNORE INTO licenses (id) VALUES (1)")
    .run();
}

type LicenseRow = {
  id: number;
  key_hash: string | null;
  issued_at: number | null;
  expires_at: number | null;
  activated_at: string | null;
};

function readRow(): LicenseRow {
  ensureLicenseTable();
  const row = sqlite.prepare("SELECT * FROM licenses WHERE id = 1").get() as LicenseRow;
  return row;
}

let cache: { at: number; row: LicenseRow } | null = null;
const CACHE_MS = 5_000;

export function getLicenseStatus() {
  const nowMs = Date.now();
  if (cache && nowMs - cache.at < CACHE_MS) {
    return buildStatus(cache.row);
  }
  const row = readRow();
  cache = { at: nowMs, row };
  return buildStatus(row);
}

function buildStatus(row: LicenseRow) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = row.expires_at ?? null;
  const issuedAt = row.issued_at ?? null;
  const active = !!expiresAt && expiresAt > now;
  const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 86400)) : null;
  const keyHint = row.key_hash ? `${row.key_hash.slice(0, 6)}…${row.key_hash.slice(-6)}` : null;
  return { active, expiresAt, issuedAt, daysRemaining, keyHint };
}

export function activateLicenseKey(key: string) {
  const { decoded } = decodeAndVerifyLicenseKey(key);
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp <= now) {
    throw new Error("Licença expirada");
  }

  const keyHash = sha256Hex(key.trim());

  ensureLicenseTable();
  sqlite
    .prepare(
      "UPDATE licenses SET key_hash = ?, issued_at = ?, expires_at = ?, activated_at = CURRENT_TIMESTAMP WHERE id = 1"
    )
    .run(keyHash, decoded.iat, decoded.exp);

  cache = null;
  const status = getLicenseStatus();
  return {
    active: status.active,
    expiresAt: decoded.exp,
    issuedAt: decoded.iat,
    daysRemaining: status.daysRemaining ?? 0,
  };
}

export function isLicenseValidOrThrow() {
  const status = getLicenseStatus();
  if (!status.active) {
    throw new Error("Licença inválida ou expirada");
  }
  return status;
}

// Utility for generator script (kept here so format stays consistent)
export function generateLicenseKey(days: number) {
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 0 || d > 3650) {
    throw new Error("Dias inválidos (1 a 3650)");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: DecodedLicense = {
    v: 1,
    days: d,
    iat: now,
    exp: now + d * 86400,
  };
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  const secret = getLicenseSecret();
  const sig = crypto.createHmac("sha256", secret).update(payloadB64, "utf-8").digest();
  const sigB64 = base64UrlEncode(sig);
  return `MF1-${payloadB64}.${sigB64}`;
}
