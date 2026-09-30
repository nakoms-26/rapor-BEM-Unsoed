const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: "153.92.15.57",
    port: 3306,
    user: "u256329210_rapor",
    password: "M3DI<0MI3ANGGa",
    database: "u256329210_rapor",
  });

  const [interns] = await pool.query(
    "SELECT p.nim, p.nama_lengkap, p.unit_id, u.nama_unit FROM profiles p LEFT JOIN ref_units u ON p.unit_id = u.id WHERE p.role = 'internship'"
  );
  console.log(`Total interns: ${interns.length}`);
  const counts = {};
  for (const i of interns) {
    const unitName = i.nama_unit || "NO_UNIT";
    counts[unitName] = (counts[unitName] || 0) + 1;
  }
  console.log("Interns count per unit:", counts);

  // Check PPM interns specifically
  const ppmInterns = interns.filter(i => (i.nama_unit || "").toLowerCase().includes("pengendali"));
  console.log("\nPPM interns:", ppmInterns);

  // Check who is evaluating interns currently
  const [evaluators] = await pool.query(
    "SELECT DISTINCT irs.penilai_nim, p.nama_lengkap, p.role FROM intern_rapor_scores irs LEFT JOIN profiles p ON irs.penilai_nim = p.nim"
  );
  console.log("\nDistinct intern evaluators so far:", evaluators);

  // Check pj_assignments for all role = 'pj_ppm_intern'
  const [pjPpmUsers] = await pool.query(
    "SELECT p.nim, p.nama_lengkap, p.role, p.unit_id, u.nama_unit FROM profiles p LEFT JOIN ref_units u ON p.unit_id = u.id WHERE p.role = 'pj_ppm_intern'"
  );
  console.log("\nPJ PPM Intern users:", pjPpmUsers);

  const [pjAssignmentsPpm] = await pool.query(
    "SELECT pja.*, p.nama_lengkap, u.nama_unit FROM pj_assignments pja JOIN profiles p ON pja.nim = p.nim LEFT JOIN ref_units u ON pja.target_unit_id = u.id WHERE p.role = 'pj_ppm_intern'"
  );
  console.log("\nPJ Assignments for role pj_ppm_intern:", pjAssignmentsPpm);

  await pool.end();
}

run().catch(console.error);
