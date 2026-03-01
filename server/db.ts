import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DB_PATH:
 * - Prefer `process.env.DB_PATH`.
 * - Default: ./data/sqlite.db
 * - Backward-compat: if legacy ./sqlite.db exists and ./data/sqlite.db doesn't, keep using legacy.
 */
const defaultPath = path.resolve(__dirname, "..", "data", "sqlite.db");
const legacyPath = path.resolve(__dirname, "..", "sqlite.db");

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : (fs.existsSync(defaultPath) ? defaultPath : (fs.existsSync(legacyPath) ? legacyPath : defaultPath));

// Ensure directory exists for the chosen DB path
try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch {
  // ignore
}

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
export const resolvedDbPath = dbPath;
