import { generateLicenseKey, getLicenseSecret } from "../server/license";

function parseDays(argv: string[]) {
  const idx = argv.findIndex(a => a === "--days" || a === "-d");
  if (idx >= 0 && argv[idx + 1]) return Number(argv[idx + 1]);
  // allow `npm run license:generate -- 30`
  const last = argv[argv.length - 1];
  if (last && /^\d+$/.test(last)) return Number(last);
  return NaN;
}

const days = parseDays(process.argv.slice(2));
if (!Number.isFinite(days) || days <= 0) {
  console.log("Uso:");
  console.log("  npm run license:generate -- --days 30");
  console.log("  npm run license:generate -- 30");
  process.exit(1);
}

// Ensure secret exists (and is persisted on disk when possible)
getLicenseSecret();

const key = generateLicenseKey(days);

console.log("\n===== MEDFLOW LICENSE KEY =====\n");
console.log(key);
console.log("\n==============================\n");
console.log(`Dias: ${days}`);
console.log("Agora cole essa chave na página Admin → Licença para ativar.\n");
