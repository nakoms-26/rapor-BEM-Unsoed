import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const env = readFileSync(".env", "utf8");
const envVars = {};
for (const line of env.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx !== -1) {
    envVars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
}

async function main() {
  console.log("Menghubungkan ke MySQL:", envVars.MYSQL_HOST, envVars.MYSQL_DATABASE);
  const pool = mysql.createPool({
    host: envVars.MYSQL_HOST,
    port: Number(envVars.MYSQL_PORT),
    user: envVars.MYSQL_USER,
    password: envVars.MYSQL_PASSWORD,
    database: envVars.MYSQL_DATABASE,
    decimalNumbers: true,
  });

  // 1. Verifikasi tabel profiles & akun admin
  const [profiles] = await pool.query("SELECT nim, nama_lengkap, role FROM profiles WHERE role = 'admin' LIMIT 3");
  console.log("✅ Admin profiles:", profiles);

  // 2. Verifikasi tabel rapor_scores & rapor_details
  const [scores] = await pool.query("SELECT COUNT(*) as count FROM rapor_scores");
  const [details] = await pool.query("SELECT COUNT(*) as count FROM rapor_details");
  console.log("✅ Total rapor_scores:", scores[0].count);
  console.log("✅ Total rapor_details:", details[0].count);

  // 3. Verifikasi query bertingkat (simulasi auth session)
  const testToken = "test_token_" + Date.now();
  await pool.query("INSERT INTO app_sessions (id, session_token, nim, expires_at, created_at) VALUES (UUID(), ?, ?, NOW() + INTERVAL 1 DAY, NOW())", [testToken, profiles[0].nim]);
  console.log("✅ Berhasil insert session uji");

  const [sessionRows] = await pool.query("SELECT * FROM app_sessions WHERE session_token = ?", [testToken]);
  console.log("✅ Berhasil query session uji:", sessionRows[0]?.nim);

  await pool.query("DELETE FROM app_sessions WHERE session_token = ?", [testToken]);
  console.log("✅ Berhasil delete session uji");

  await pool.end();
  console.log("\nSELURUH PENGUJIAN INTEGRASI DATABASE MYSQL BERHASIL 100%!");
}

main().catch(console.error);
