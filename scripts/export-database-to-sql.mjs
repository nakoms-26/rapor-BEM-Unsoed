import { readFileSync, existsSync, createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Load environment variables from .env
function loadEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!existsSync(envPath)) {
    throw new Error(".env file not found in project root!");
  }
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper to escape SQL values safely for standard SQL / MySQL / MariaDB
function escapeSqlValue(val) {
  if (val === null || val === undefined) {
    return "NULL";
  }
  if (typeof val === "boolean") {
    return val ? "1" : "0";
  }
  if (typeof val === "number") {
    return Number.isFinite(val) ? String(val) : "NULL";
  }
  if (typeof val === "object") {
    val = JSON.stringify(val);
  }
  const str = String(val)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\x1a/g, "\\Z");
  return `'${str}'`;
}

// Fetch all rows from a table using chunked pagination (handles 34k+ rows)
async function fetchAllRowsFromTable(tableName, orderCol = "id", batchSize = 1000, concurrency = 6) {
  const { count, error: countErr } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (countErr) {
    console.warn(`[${tableName}] Head count failed, falling back to sequential fetch:`, countErr.message);
    const all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order(orderCol, { ascending: true })
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return all;
  }

  const total = count ?? 0;
  if (total === 0) return [];

  if (total <= batchSize) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order(orderCol, { ascending: true })
      .range(0, batchSize - 1);
    if (error) throw error;
    return data ?? [];
  }

  const chunks = [];
  for (let from = 0; from < total; from += batchSize) {
    chunks.push({ from, to: from + batchSize - 1 });
  }

  const results = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (chunk, bIdx) => {
        const targetIdx = i + bIdx;
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .order(orderCol, { ascending: true })
          .range(chunk.from, chunk.to);
        if (error) throw error;
        results[targetIdx] = data ?? [];
      })
    );
  }

  return results.flat();
}

// Schema definitions in standard SQL (MySQL / MariaDB / generic SQL compatible)
const TABLE_DEFINITIONS = [
  {
    name: "ref_units",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`ref_units\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`nama_unit\` VARCHAR(255) NOT NULL,
  \`kategori\` VARCHAR(50) NOT NULL,
  \`parent_id\` VARCHAR(36) NULL,
  \`created_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`idx_ref_units_nama_unit\` (\`nama_unit\`),
  KEY \`idx_ref_units_parent_id\` (\`parent_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "profiles",
    orderCol: "nim",
    createSql: `CREATE TABLE IF NOT EXISTS \`profiles\` (
  \`nim\` VARCHAR(50) NOT NULL,
  \`nama_lengkap\` VARCHAR(255) NOT NULL,
  \`unit_id\` VARCHAR(36) NOT NULL,
  \`role\` VARCHAR(50) NOT NULL DEFAULT 'staff',
  \`created_at\` VARCHAR(35) NOT NULL,
  \`updated_at\` VARCHAR(35) NOT NULL,
  \`jurusan\` VARCHAR(255) NULL,
  \`tahun_angkatan\` INT NULL,
  \`can_access_kemenko_report\` TINYINT(1) NOT NULL DEFAULT 0,
  \`is_pj_kemenkoan\` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`nim\`),
  KEY \`idx_profiles_unit_id\` (\`unit_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "app_accounts",
    orderCol: "nim",
    createSql: `CREATE TABLE IF NOT EXISTS \`app_accounts\` (
  \`nim\` VARCHAR(50) NOT NULL,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`updated_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`nim\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "app_sessions",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`app_sessions\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`session_token\` VARCHAR(255) NOT NULL,
  \`nim\` VARCHAR(50) NOT NULL,
  \`expires_at\` VARCHAR(35) NOT NULL,
  \`created_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`idx_app_sessions_token\` (\`session_token\`),
  KEY \`idx_app_sessions_nim\` (\`nim\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "rapor_periods",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`rapor_periods\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`bulan\` INT NOT NULL,
  \`tahun\` INT NOT NULL,
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'draft',
  \`created_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "rapor_scores",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`rapor_scores\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`user_nim\` VARCHAR(50) NOT NULL,
  \`periode_id\` VARCHAR(36) NOT NULL,
  \`penilai_nim\` VARCHAR(50) NOT NULL,
  \`total_avg\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`catatan\` TEXT NULL,
  \`report_type\` VARCHAR(50) NOT NULL DEFAULT 'staf_unit',
  PRIMARY KEY (\`id\`),
  KEY \`idx_rapor_scores_user_nim\` (\`user_nim\`),
  KEY \`idx_rapor_scores_periode_id\` (\`periode_id\`),
  KEY \`idx_rapor_scores_penilai_nim\` (\`penilai_nim\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "rapor_details",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`rapor_details\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`rapor_id\` VARCHAR(36) NOT NULL,
  \`main_indicator_name\` TEXT NOT NULL,
  \`sub_indicator_name\` TEXT NOT NULL,
  \`score\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`catatan\` TEXT NULL,
  \`bentuk_tanggung_jawab\` TEXT NULL,
  \`nilai_kuantitatif_tanggung_jawab\` DECIMAL(5,2) NULL,
  \`skala\` TEXT NULL,
  \`nilai_kuantitatif_skala\` DECIMAL(5,2) NULL,
  \`nilai_kualitatif\` DECIMAL(5,2) NULL,
  \`nilai_akhir\` DECIMAL(5,2) NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_rapor_details_rapor_id\` (\`rapor_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "pj_assignments",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`pj_assignments\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`nim\` VARCHAR(50) NOT NULL,
  \`target_unit_id\` VARCHAR(36) NOT NULL,
  \`scope\` VARCHAR(50) NOT NULL,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`updated_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_pj_assignments_nim\` (\`nim\`),
  KEY \`idx_pj_assignments_unit\` (\`target_unit_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "evaluator_unit_assignments",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`evaluator_unit_assignments\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`evaluator_nim\` VARCHAR(50) NOT NULL,
  \`target_unit_id\` VARCHAR(36) NOT NULL,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`updated_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_evaluator_nim\` (\`evaluator_nim\`),
  KEY \`idx_evaluator_unit\` (\`target_unit_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "kemenko_sub_indicator_templates",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`kemenko_sub_indicator_templates\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`kemenko_unit_id\` VARCHAR(36) NOT NULL,
  \`main_indicator_name\` TEXT NOT NULL,
  \`sub_indicator_name\` TEXT NOT NULL,
  \`created_by_nim\` VARCHAR(50) NOT NULL,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`updated_at\` VARCHAR(35) NOT NULL,
  \`periode_id\` VARCHAR(36) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_kemenko_unit\` (\`kemenko_unit_id\`),
  KEY \`idx_kemenko_period\` (\`periode_id\`),
  KEY \`idx_kemenko_nim\` (\`created_by_nim\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "intern_rapor_scores",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`intern_rapor_scores\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`user_nim\` VARCHAR(50) NOT NULL,
  \`periode_id\` VARCHAR(36) NOT NULL,
  \`penilai_nim\` VARCHAR(50) NOT NULL,
  \`total_avg\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  \`catatan\` TEXT NULL,
  \`created_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_intern_scores_user\` (\`user_nim\`),
  KEY \`idx_intern_scores_period\` (\`periode_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "intern_rapor_details",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`intern_rapor_details\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`rapor_id\` VARCHAR(36) NOT NULL,
  \`main_indicator_name\` TEXT NOT NULL,
  \`sub_indicator_name\` TEXT NOT NULL,
  \`score\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`catatan\` TEXT NULL,
  \`bentuk_tanggung_jawab\` TEXT NULL,
  \`nilai_kuantitatif_tanggung_jawab\` DECIMAL(5,2) NULL,
  \`skala\` TEXT NULL,
  \`nilai_kuantitatif_skala\` DECIMAL(5,2) NULL,
  \`nilai_kualitatif\` DECIMAL(5,2) NULL,
  \`nilai_akhir\` DECIMAL(5,2) NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_intern_details_rapor\` (\`rapor_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
  {
    name: "intern_sub_indicator_templates",
    orderCol: "id",
    createSql: `CREATE TABLE IF NOT EXISTS \`intern_sub_indicator_templates\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`kemenko_unit_id\` VARCHAR(36) NOT NULL,
  \`periode_id\` VARCHAR(36) NOT NULL,
  \`main_indicator_name\` TEXT NOT NULL,
  \`sub_indicator_name\` TEXT NOT NULL,
  \`created_by_nim\` VARCHAR(50) NOT NULL,
  \`created_at\` VARCHAR(35) NOT NULL,
  \`updated_at\` VARCHAR(35) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_intern_tpl_unit\` (\`kemenko_unit_id\`),
  KEY \`idx_intern_tpl_period\` (\`periode_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  },
];

async function main() {
  console.log("=================================================================");
  console.log("   EXPORT DATABASE SUPABASE KE FILE SQL STANDAR (PORTABLE SQL)   ");
  console.log("=================================================================");
  console.log(`Menghubungkan ke Supabase: ${supabaseUrl}`);

  const outputFileName = "database_export_bem_unsoed.sql";
  const outputPath = path.join(projectRoot, outputFileName);
  const stream = createWriteStream(outputPath, { encoding: "utf8" });

  const write = (str) =>
    new Promise((resolve) => {
      if (!stream.write(str)) {
        stream.once("drain", resolve);
      } else {
        resolve();
      }
    });

  const startTime = Date.now();
  const dateStr = new Date().toISOString();

  // Header SQL
  await write(`-- =============================================================================\n`);
  await write(`-- DATABASE EXPORT: BEM UNSOED 2026\n`);
  await write(`-- Generated At: ${dateStr}\n`);
  await write(`-- Dialect: Standard SQL (Compatible with MySQL, MariaDB, and ANSI SQL engines)\n`);
  await write(`-- Source: Supabase PostgreSQL (Full Table & Data Migration Dump)\n`);
  await write(`-- Total Tables: ${TABLE_DEFINITIONS.length}\n`);
  await write(`-- =============================================================================\n\n`);
  await write(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  await write(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`);
  await write(`SET AUTOCOMMIT = 0;\n`);
  await write(`START TRANSACTION;\n`);
  await write(`SET NAMES utf8mb4;\n\n`);

  let grandTotalRows = 0;
  const summaryReport = [];

  for (const table of TABLE_DEFINITIONS) {
    const tStart = Date.now();
    process.stdout.write(`Sedang mengambil data '${table.name}'... `);

    // Fetch all rows
    const rows = await fetchAllRowsFromTable(table.name, table.orderCol);
    const count = rows.length;
    grandTotalRows += count;
    const fetchDuration = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(`${count.toLocaleString()} baris (${fetchDuration}s)`);

    summaryReport.push({ table: table.name, rows: count });

    // Write Table DDL
    await write(`-- -----------------------------------------------------------------------------\n`);
    await write(`-- Table structure for table \`${table.name}\`\n`);
    await write(`-- -----------------------------------------------------------------------------\n`);
    await write(`DROP TABLE IF EXISTS \`${table.name}\`;\n`);
    await write(`${table.createSql}\n\n`);

    if (count === 0) {
      await write(`-- No data for table \`${table.name}\`\n\n`);
      continue;
    }

    // Write Data Inserts in batches (e.g. 250 rows per batch)
    await write(`-- Dumping data for table \`${table.name}\` (${count} rows)\n`);

    const columns = Object.keys(rows[0]);
    const colListStr = columns.map((c) => `\`${c}\``).join(", ");
    const batchSize = 250;

    for (let b = 0; b < count; b += batchSize) {
      const slice = rows.slice(b, b + batchSize);
      await write(`INSERT INTO \`${table.name}\` (${colListStr}) VALUES\n`);

      const rowStrings = slice.map((row) => {
        const valStrings = columns.map((col) => escapeSqlValue(row[col]));
        return `(${valStrings.join(", ")})`;
      });

      await write(`${rowStrings.join(",\n")};\n\n`);
    }
  }

  // Footer SQL
  await write(`COMMIT;\n`);
  await write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  await write(`-- Export completed at ${new Date().toISOString()}\n`);

  await new Promise((resolve) => stream.end(resolve));

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=================================================================");
  console.log(`Export SELESAI dalam ${totalDuration} detik!`);
  console.log(`File SQL tersimpan di: ${outputPath}`);
  console.log(`Total data diekspor: ${grandTotalRows.toLocaleString()} baris`);
  console.log("=================================================================");
  console.table(summaryReport);
}

main().catch((err) => {
  console.error("Export GAGAL:", err);
  process.exit(1);
});
