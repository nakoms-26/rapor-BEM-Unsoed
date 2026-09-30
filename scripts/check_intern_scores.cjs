const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: "153.92.15.57",
    port: 3306,
    user: "u256329210_rapor",
    password: "M3DI<0MI3ANGGa",
    database: "u256329210_rapor",
  });

  const [scores] = await pool.query(
    "SELECT irs.id, irs.user_nim, p_user.nama_lengkap as intern_name, u.nama_unit, irs.penilai_nim, p_eval.nama_lengkap as penilai_name, irs.total_avg FROM intern_rapor_scores irs JOIN profiles p_user ON irs.user_nim = p_user.nim LEFT JOIN ref_units u ON p_user.unit_id = u.id LEFT JOIN profiles p_eval ON irs.penilai_nim = p_eval.nim"
  );
  console.log(`Total intern_rapor_scores: ${scores.length}`);
  console.table(scores.slice(0, 20));

  await pool.end();
}

run().catch(console.error);
