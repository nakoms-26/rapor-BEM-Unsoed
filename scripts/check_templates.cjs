const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: "153.92.15.57",
    port: 3306,
    user: "u256329210_rapor",
    password: "M3DI<0MI3ANGGa",
    database: "u256329210_rapor",
  });

  const [spiTemplates] = await pool.query(
    "SELECT * FROM intern_sub_indicator_templates WHERE kemenko_unit_id = '90cb7958-5ed5-43bf-a0d5-7b9ed13f2ae8' OR kemenko_unit_id = '72583272-f223-4793-b149-ff7f288b1df3'"
  );
  console.log("Intern sub indicator templates for SPI/PPM:", spiTemplates);

  const [allKemenkoTemplates] = await pool.query(
    "SELECT DISTINCT kemenko_unit_id, u.nama_unit FROM intern_sub_indicator_templates t LEFT JOIN ref_units u ON t.kemenko_unit_id = u.id"
  );
  console.log("Kemenko units with intern templates:", allKemenkoTemplates);

  await pool.end();
}

run().catch(console.error);
