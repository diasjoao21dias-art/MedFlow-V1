import { sqlite } from "./db";
import { ensureLicenseTable } from "./license";

/**
 * Lightweight, runtime-safe migrations for single-file sqlite installations.
 * This project ships with an existing sqlite.db, so we can't rely on a separate
 * migration runner in dev.
 */
export function runMigrations() {
  try {
    // Licenses table
    ensureLicenseTable();

    // Patients: soft archive support
    const cols = sqlite.prepare("PRAGMA table_info(patients)").all() as Array<{ name: string }>;
    const colNames = new Set(cols.map(c => c.name));

    if (!colNames.has("is_archived")) {
      sqlite.prepare("ALTER TABLE patients ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0").run();
    }
    if (!colNames.has("archived_at")) {
      sqlite.prepare("ALTER TABLE patients ADD COLUMN archived_at TEXT").run();
    }
  } catch (err) {
    // Don't crash the app for a best-effort migration.
    console.error("Migration error:", err);
  }
}
