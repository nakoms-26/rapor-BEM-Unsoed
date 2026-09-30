const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: "153.92.15.57",
    port: 3306,
    user: "u256329210_rapor",
    password: "M3DI<0MI3ANGGa",
    database: "u256329210_rapor",
  });

  const [cols] = await pool.query(
    "SHOW COLUMNS FROM pj_assignments LIKE 'scope'"
  );
  console.log("pj_assignments.scope column:", cols);

  await pool.end();
}

run().catch(console.error);
