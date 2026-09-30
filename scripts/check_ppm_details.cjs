const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: "153.92.15.57",
    port: 3306,
    user: "u256329210_rapor",
    password: "M3DI<0MI3ANGGa",
    database: "u256329210_rapor",
  });

  console.log("=== USERS in PPM (Biro Pengendali & Penjamin Mutu) ===");
  const [ppmUsers] = await pool.query(
    "SELECT p.nim, p.nama_lengkap, p.role, p.is_pj_kemenkoan, p.unit_id FROM profiles p WHERE p.unit_id = '72583272-f223-4793-b149-ff7f288b1df3' ORDER BY p.role, p.nama_lengkap"
  );
  console.table(ppmUsers);

  console.log("\n=== ALL PJ ASSIGNMENTS FOR PPM UNIT ===");
  const [pjas] = await pool.query(
    "SELECT pja.*, p.nama_lengkap, p.role, u.nama_unit FROM pj_assignments pja JOIN profiles p ON pja.nim = p.nim LEFT JOIN ref_units u ON pja.target_unit_id = u.id WHERE pja.target_unit_id = '72583272-f223-4793-b149-ff7f288b1df3'"
  );
  console.table(pjas);

  console.log("\n=== ANY INTERN RAPOR SCORES FOR PPM USERS? ===");
  const ppmNims = ppmUsers.map(u => u.nim);
  const [irs] = await pool.query(
    "SELECT * FROM intern_rapor_scores WHERE user_nim IN (?)",
    [ppmNims]
  );
  console.log("Intern rapor scores for PPM users:", irs);

  console.log("\n=== ANY STAFF RAPOR SCORES FOR PPM USERS? ===");
  const [srs] = await pool.query(
    "SELECT user_nim, COUNT(*) as cnt FROM rapor_scores WHERE user_nim IN (?) GROUP BY user_nim",
    [ppmNims]
  );
  console.table(srs);

  await pool.end();
}

run().catch(console.error);
