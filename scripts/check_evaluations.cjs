const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: "153.92.15.57",
    port: 3306,
    user: "u256329210_rapor",
    password: "M3DI<0MI3ANGGa",
    database: "u256329210_rapor",
  });

  const [abuEvaluated] = await pool.query(
    "SELECT rs.user_nim, p.nama_lengkap, u.nama_unit, COUNT(*) as cnt FROM rapor_scores rs JOIN profiles p ON rs.user_nim = p.nim LEFT JOIN ref_units u ON p.unit_id = u.id WHERE rs.penilai_nim = 'A1A025089' GROUP BY rs.user_nim, p.nama_lengkap, u.nama_unit"
  );
  console.log("Users evaluated by Abu (A1A025089):");
  console.table(abuEvaluated);

  const [mutiaEvaluated] = await pool.query(
    "SELECT rs.user_nim, p.nama_lengkap, u.nama_unit, COUNT(*) as cnt FROM rapor_scores rs JOIN profiles p ON rs.user_nim = p.nim LEFT JOIN ref_units u ON p.unit_id = u.id WHERE rs.penilai_nim = 'K1C024052' GROUP BY rs.user_nim, p.nama_lengkap, u.nama_unit"
  );
  console.log("Users evaluated by Mutia (K1C024052):");
  console.table(mutiaEvaluated);

  await pool.end();
}

run().catch(console.error);
