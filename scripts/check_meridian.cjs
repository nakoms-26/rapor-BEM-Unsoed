const mysql = require("mysql2/promise");

async function check() {
  const pool = mysql.createPool({
    host: "153.92.15.57",
    port: 3306,
    user: "u256329210_rapor",
    password: "M3DI<0MI3ANGGa",
    database: "u256329210_rapor",
    decimalNumbers: true,
  });

  const nims = ["A1A025089", "K1C024052"];
  
  console.log("=== PROFILES ===");
  const [profiles] = await pool.query(
    "SELECT p.nim, p.nama_lengkap, p.role, p.is_pj_kemenkoan, p.unit_id, u.nama_unit, u.kategori FROM profiles p LEFT JOIN ref_units u ON p.unit_id = u.id WHERE p.nim IN (?, ?)",
    nims
  );
  console.log(JSON.stringify(profiles, null, 2));

  console.log("\n=== PJ ASSIGNMENTS ===");
  const [pjas] = await pool.query(
    "SELECT pja.*, u.nama_unit, u.kategori FROM pj_assignments pja LEFT JOIN ref_units u ON pja.target_unit_id = u.id WHERE pja.nim IN (?, ?)",
    nims
  );
  console.log(JSON.stringify(pjas, null, 2));

  console.log("\n=== EVALUATOR UNIT ASSIGNMENTS ===");
  const [euas] = await pool.query(
    "SELECT eua.*, u.nama_unit, u.kategori FROM evaluator_unit_assignments eua LEFT JOIN ref_units u ON eua.target_unit_id = u.id WHERE eua.evaluator_nim IN (?, ?)",
    nims
  );
  console.log(JSON.stringify(euas, null, 2));

  console.log("\n=== ALL UNITS (PPM, Risdat, PSDM, Rismed) ===");
  const [units] = await pool.query(
    "SELECT id, nama_unit, kategori, parent_id FROM ref_units WHERE nama_unit LIKE '%pengendali%' OR nama_unit LIKE '%riset%' OR nama_unit LIKE '%psdm%' OR nama_unit LIKE '%rismed%'"
  );
  console.log(JSON.stringify(units, null, 2));

  console.log("\n=== INTERN PROFILES in PPM ===");
  const ppmUnits = units.filter(u => u.nama_unit.toLowerCase().includes("pengendali"));
  for (const u of ppmUnits) {
    const [interns] = await pool.query(
      "SELECT nim, nama_lengkap, role, unit_id FROM profiles WHERE unit_id = ?",
      [u.id]
    );
    console.log(`Unit ${u.nama_unit} (${u.id}):`, interns);
  }

  console.log("\n=== ALL INTERNS in profiles ===");
  const [allInterns] = await pool.query(
    "SELECT p.nim, p.nama_lengkap, p.unit_id, u.nama_unit FROM profiles p LEFT JOIN ref_units u ON p.unit_id = u.id WHERE p.role = 'internship'"
  );
  console.log(`Total interns: ${allInterns.length}`);
  console.log("Interns sample / distribution by unit:");
  const dist = {};
  allInterns.forEach(i => {
    dist[i.nama_unit || 'NO_UNIT'] = (dist[i.nama_unit || 'NO_UNIT'] || 0) + 1;
  });
  console.log(dist);

  await pool.end();
}

check().catch(console.error);
