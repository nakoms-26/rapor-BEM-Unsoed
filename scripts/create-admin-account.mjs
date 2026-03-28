import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function normalizeNim(nim) {
  return String(nim ?? "").replace(/\s+/g, "").toUpperCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = parseArgs(process.argv.slice(2));
const nim = normalizeNim(args.nim);
const namaLengkap = String(args.name ?? "").trim();
const password = String(args.password ?? "");
const role = String(args.role ?? "admin").trim();
const requestedUnit = String(args.unit ?? "Biro PPM").trim();

if (!nim || !namaLengkap || !password) {
  console.error("Usage: npm run create:admin -- --nim H1D024096 --name \"Admin BEM\" --password \"secret123\" [--role admin] [--unit \"Biro PPM\"]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: namedUnit } = await supabase
  .from("ref_units")
  .select("id, nama_unit")
  .eq("nama_unit", requestedUnit)
  .limit(1)
  .single();

let unit = namedUnit;
if (!unit) {
  const { data: fallbackUnit } = await supabase
    .from("ref_units")
    .select("id, nama_unit")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  unit = fallbackUnit;
}

if (!unit) {
  console.error("Tidak ada unit di ref_units. Jalankan migration awal terlebih dahulu.");
  process.exit(1);
}

const { error: profileError } = await supabase.from("profiles").upsert(
  {
    nim,
    nama_lengkap: namaLengkap,
    unit_id: unit.id,
    role,
  },
  { onConflict: "nim" },
);

if (profileError) {
  console.error(`Gagal menyimpan profile: ${profileError.message}`);
  process.exit(1);
}

const { error: accountError } = await supabase.from("app_accounts").upsert(
  {
    nim,
    password_hash: hashPassword(password),
  },
  { onConflict: "nim" },
);

if (accountError) {
  console.error(`Gagal menyimpan account: ${accountError.message}`);
  process.exit(1);
}

console.log(`Akun berhasil disiapkan untuk ${nim} (${namaLengkap}) dengan role ${role} pada unit ${unit.nama_unit}.`);
