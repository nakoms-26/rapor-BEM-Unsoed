/**
 * Comprehensive System Audit Script
 * Tests: rapor save (staff & intern), update, delete, publish flow
 */
const mysql = require("mysql2/promise");
const crypto = require("crypto");

const DB_CONFIG = {
  host: "153.92.15.57",
  port: 3306,
  user: "u256329210_rapor",
  password: "M3DI<0MI3ANGGa",
  database: "u256329210_rapor",
  decimalNumbers: true,
};

let pool;
const results = [];

function log(category, status, message) {
  const icon = status === "OK" ? "✅" : status === "WARN" ? "⚠️" : "❌";
  console.log(`${icon} [${category}] ${message}`);
  results.push({ category, status, message });
}

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function testDatabaseConnection() {
  try {
    pool = await mysql.createPool(DB_CONFIG);
    const rows = await query("SELECT 1 as ok");
    log("DB", "OK", "Database connection successful");
  } catch (e) {
    log("DB", "FAIL", `Database connection failed: ${e.message}`);
    process.exit(1);
  }
}

async function testTablesExist() {
  const tables = [
    "profiles", "ref_units", "rapor_periods", "rapor_scores", "rapor_details",
    "intern_rapor_scores", "intern_rapor_details", "intern_sub_indicator_templates",
    "kemenko_sub_indicator_templates", "pj_assignments", "evaluator_unit_assignments",
    "app_sessions",
  ];
  for (const table of tables) {
    try {
      await query(`SELECT 1 FROM \`${table}\` LIMIT 1`);
      log("TABLES", "OK", `Table '${table}' exists`);
    } catch (e) {
      log("TABLES", "FAIL", `Table '${table}' missing: ${e.message}`);
    }
  }
}

async function testRaporScoresSchema() {
  try {
    const cols = await query("SHOW COLUMNS FROM rapor_scores");
    const colNames = cols.map((c) => c.Field);
    const required = ["id", "user_nim", "periode_id", "penilai_nim", "report_type", "total_avg"];
    for (const col of required) {
      if (colNames.includes(col)) {
        log("SCHEMA", "OK", `rapor_scores.${col} exists`);
      } else {
        log("SCHEMA", "FAIL", `rapor_scores.${col} MISSING`);
      }
    }
    // Check catatan column
    if (colNames.includes("catatan")) {
      log("SCHEMA", "OK", "rapor_scores.catatan exists (migration applied)");
    } else {
      log("SCHEMA", "WARN", "rapor_scores.catatan MISSING — catatan save will be skipped");
    }
  } catch (e) {
    log("SCHEMA", "FAIL", `Failed to check rapor_scores schema: ${e.message}`);
  }
}

async function testInternRaporScoresSchema() {
  try {
    const cols = await query("SHOW COLUMNS FROM intern_rapor_scores");
    const colNames = cols.map((c) => c.Field);
    const required = ["id", "user_nim", "periode_id", "penilai_nim", "total_avg", "catatan"];
    for (const col of required) {
      if (colNames.includes(col)) {
        log("SCHEMA", "OK", `intern_rapor_scores.${col} exists`);
      } else {
        log("SCHEMA", "FAIL", `intern_rapor_scores.${col} MISSING`);
      }
    }
  } catch (e) {
    log("SCHEMA", "FAIL", `Failed to check intern_rapor_scores schema: ${e.message}`);
  }
}

async function testRaporSaveUpdateDelete() {
  const TEST_NIM = "__AUDIT_TEST_NIM__";
  const TEST_PENILAI = "__AUDIT_PENILAI__";
  const testId = crypto.randomUUID();

  try {
    // Get a valid period
    const periods = await query("SELECT id FROM rapor_periods LIMIT 1");
    if (!periods.length) {
      log("RAPOR_SAVE", "WARN", "No periods found, skipping save test");
      return;
    }
    const periodeId = periods[0].id;

    // 1. INSERT test
    await query(
      "INSERT INTO rapor_scores (id, user_nim, periode_id, penilai_nim, report_type, total_avg) VALUES (?, ?, ?, ?, ?, ?)",
      [testId, TEST_NIM, periodeId, TEST_PENILAI, "staf_unit", 85.5]
    );
    log("RAPOR_SAVE", "OK", "INSERT rapor_scores succeeded");

    // 2. Verify INSERT
    const inserted = await query("SELECT * FROM rapor_scores WHERE id = ?", [testId]);
    if (inserted.length === 1 && Number(inserted[0].total_avg) === 85.5) {
      log("RAPOR_SAVE", "OK", "Inserted row verified correctly");
    } else {
      log("RAPOR_SAVE", "FAIL", `Insert verification failed: got ${inserted.length} rows`);
    }

    // 3. UPDATE test
    await query("UPDATE rapor_scores SET total_avg = ? WHERE id = ?", [90.0, testId]);
    const updated = await query("SELECT total_avg FROM rapor_scores WHERE id = ?", [testId]);
    if (updated.length === 1 && Number(updated[0].total_avg) === 90.0) {
      log("RAPOR_UPDATE", "OK", "UPDATE rapor_scores succeeded and verified");
    } else {
      log("RAPOR_UPDATE", "FAIL", "UPDATE verification failed");
    }

    // 4. UPDATE + SELECT (simulating the MySQLQueryBuilder pattern)
    await query("UPDATE rapor_scores SET total_avg = ? WHERE id = ?", [92.0, testId]);
    const selectAfterUpdate = await query("SELECT id FROM rapor_scores WHERE id = ? LIMIT 1", [testId]);
    if (selectAfterUpdate.length >= 1) {
      log("RAPOR_UPDATE", "OK", "UPDATE + SELECT fallback pattern works");
    } else {
      log("RAPOR_UPDATE", "WARN", "UPDATE + SELECT returned empty — fallback needed");
    }

    // 5. INSERT detail rows
    const detailId = crypto.randomUUID();
    await query(
      "INSERT INTO rapor_details (id, rapor_id, main_indicator_name, sub_indicator_name, score) VALUES (?, ?, ?, ?, ?)",
      [detailId, testId, "Keaktifan", "Test Sub Indicator", 4.0]
    );
    log("RAPOR_DETAIL", "OK", "INSERT rapor_details succeeded");

    const detailCheck = await query("SELECT * FROM rapor_details WHERE rapor_id = ?", [testId]);
    if (detailCheck.length >= 1) {
      log("RAPOR_DETAIL", "OK", `Detail row verified: ${detailCheck.length} row(s)`);
    } else {
      log("RAPOR_DETAIL", "FAIL", "Detail row verification failed");
    }

    // 6. DELETE detail rows
    await query("DELETE FROM rapor_details WHERE rapor_id = ?", [testId]);
    const detailDeleted = await query("SELECT * FROM rapor_details WHERE rapor_id = ?", [testId]);
    if (detailDeleted.length === 0) {
      log("RAPOR_DETAIL", "OK", "DELETE rapor_details succeeded");
    } else {
      log("RAPOR_DETAIL", "FAIL", "DELETE detail failed, rows still exist");
    }

    // 7. DELETE rapor
    await query("DELETE FROM rapor_scores WHERE id = ?", [testId]);
    const raporDeleted = await query("SELECT * FROM rapor_scores WHERE id = ?", [testId]);
    if (raporDeleted.length === 0) {
      log("RAPOR_DELETE", "OK", "DELETE rapor_scores succeeded");
    } else {
      log("RAPOR_DELETE", "FAIL", "DELETE rapor failed, row still exists");
    }
  } catch (e) {
    log("RAPOR_SAVE", "FAIL", `Error during rapor save/update/delete test: ${e.message}`);
    // Cleanup
    try {
      await query("DELETE FROM rapor_details WHERE rapor_id = ?", [testId]);
      await query("DELETE FROM rapor_scores WHERE id = ?", [testId]);
    } catch (_) {}
  }
}

async function testInternRaporSaveUpdateDelete() {
  const TEST_NIM = "__AUDIT_INTERN_NIM__";
  const TEST_PENILAI = "__AUDIT_PENILAI__";
  const testId = crypto.randomUUID();

  try {
    const periods = await query("SELECT id FROM rapor_periods LIMIT 1");
    if (!periods.length) {
      log("INTERN_SAVE", "WARN", "No periods found, skipping intern save test");
      return;
    }
    const periodeId = periods[0].id;

    // INSERT
    await query(
      "INSERT INTO intern_rapor_scores (id, user_nim, periode_id, penilai_nim, total_avg, catatan) VALUES (?, ?, ?, ?, ?, ?)",
      [testId, TEST_NIM, periodeId, TEST_PENILAI, 78.5, "Test catatan"]
    );
    log("INTERN_SAVE", "OK", "INSERT intern_rapor_scores succeeded");

    // Verify
    const inserted = await query("SELECT * FROM intern_rapor_scores WHERE id = ?", [testId]);
    if (inserted.length === 1) {
      log("INTERN_SAVE", "OK", "Intern rapor insert verified");
    } else {
      log("INTERN_SAVE", "FAIL", "Intern rapor insert verification failed");
    }

    // UPDATE
    await query("UPDATE intern_rapor_scores SET total_avg = ? WHERE id = ?", [82.0, testId]);
    const updated = await query("SELECT total_avg FROM intern_rapor_scores WHERE id = ?", [testId]);
    if (updated.length === 1 && Number(updated[0].total_avg) === 82.0) {
      log("INTERN_UPDATE", "OK", "UPDATE intern_rapor_scores succeeded");
    } else {
      log("INTERN_UPDATE", "FAIL", "UPDATE intern verification failed");
    }

    // Detail INSERT
    const detailId = crypto.randomUUID();
    await query(
      "INSERT INTO intern_rapor_details (id, rapor_id, main_indicator_name, sub_indicator_name, score) VALUES (?, ?, ?, ?, ?)",
      [detailId, testId, "Keaktifan", "Test Intern Sub", 3.5]
    );
    log("INTERN_DETAIL", "OK", "INSERT intern_rapor_details succeeded");

    // Cleanup
    await query("DELETE FROM intern_rapor_details WHERE rapor_id = ?", [testId]);
    await query("DELETE FROM intern_rapor_scores WHERE id = ?", [testId]);
    log("INTERN_DELETE", "OK", "Cleanup intern test data succeeded");
  } catch (e) {
    log("INTERN_SAVE", "FAIL", `Intern rapor test error: ${e.message}`);
    try {
      await query("DELETE FROM intern_rapor_details WHERE rapor_id = ?", [testId]);
      await query("DELETE FROM intern_rapor_scores WHERE id = ?", [testId]);
    } catch (_) {}
  }
}

async function testPeriodPublish() {
  try {
    const periods = await query("SELECT id, status FROM rapor_periods LIMIT 1");
    if (!periods.length) {
      log("PUBLISH", "WARN", "No periods found");
      return;
    }
    const period = periods[0];
    const originalStatus = period.status;

    // Test toggle to draft
    await query("UPDATE rapor_periods SET status = 'draft' WHERE id = ?", [period.id]);
    const afterDraft = await query("SELECT status FROM rapor_periods WHERE id = ?", [period.id]);
    if (afterDraft[0].status === "draft") {
      log("PUBLISH", "OK", "Period status update to 'draft' works");
    } else {
      log("PUBLISH", "FAIL", "Period status update to 'draft' failed");
    }

    // Toggle to published
    await query("UPDATE rapor_periods SET status = 'published' WHERE id = ?", [period.id]);
    const afterPublish = await query("SELECT status FROM rapor_periods WHERE id = ?", [period.id]);
    if (afterPublish[0].status === "published") {
      log("PUBLISH", "OK", "Period status update to 'published' works");
    } else {
      log("PUBLISH", "FAIL", "Period status update to 'published' failed");
    }

    // Restore original status
    await query("UPDATE rapor_periods SET status = ? WHERE id = ?", [originalStatus, period.id]);
    log("PUBLISH", "OK", `Period status restored to '${originalStatus}'`);
  } catch (e) {
    log("PUBLISH", "FAIL", `Period publish test error: ${e.message}`);
  }
}

async function testMeridianRoleIntegration() {
  try {
    // Check Meridian profiles exist
    const meridians = await query("SELECT nim, nama_lengkap, unit_id FROM profiles WHERE role = 'the_meridian'");
    log("MERIDIAN", "OK", `Found ${meridians.length} Meridian profile(s)`);

    for (const m of meridians) {
      // Check pj_assignments
      const assignments = await query(
        "SELECT scope, target_unit_id FROM pj_assignments WHERE nim = ? AND is_active = 1",
        [m.nim]
      );
      if (assignments.length > 0) {
        const scopes = assignments.map((a) => `${a.scope}`).join(", ");
        log("MERIDIAN", "OK", `${m.nama_lengkap} (${m.nim}) has ${assignments.length} assignment(s): [${scopes}]`);
      } else {
        log("MERIDIAN", "WARN", `${m.nama_lengkap} (${m.nim}) has NO active pj_assignments`);
      }

      // Check if they appear in rapor (as penilai or target)
      const asPenilai = await query("SELECT COUNT(*) as cnt FROM rapor_scores WHERE penilai_nim = ?", [m.nim]);
      const asTarget = await query("SELECT COUNT(*) as cnt FROM rapor_scores WHERE user_nim = ?", [m.nim]);
      const asInternPenilai = await query("SELECT COUNT(*) as cnt FROM intern_rapor_scores WHERE penilai_nim = ?", [m.nim]);
      log("MERIDIAN", "OK", `${m.nama_lengkap}: penilai=${asPenilai[0].cnt} staf rapor, target=${asTarget[0].cnt} rapor, intern_penilai=${asInternPenilai[0].cnt}`);
    }
  } catch (e) {
    log("MERIDIAN", "FAIL", `Meridian integration test error: ${e.message}`);
  }
}

async function testSpecificUsers() {
  // Test the two specific users mentioned by the user
  const userNims = ["A1A025089", "K1C024052"];
  for (const nim of userNims) {
    try {
      const profile = await query("SELECT nim, nama_lengkap, role, unit_id FROM profiles WHERE nim = ?", [nim]);
      if (!profile.length) {
        log("USERS", "WARN", `User ${nim} not found in profiles`);
        continue;
      }
      const p = profile[0];
      log("USERS", "OK", `${p.nama_lengkap} (${nim}) — role: ${p.role}`);

      // Check assignments
      const assignments = await query(
        "SELECT scope, target_unit_id FROM pj_assignments WHERE nim = ? AND is_active = 1",
        [nim]
      );
      log("USERS", "OK", `  → ${assignments.length} active pj_assignment(s)`);
      for (const a of assignments) {
        const unit = await query("SELECT nama_unit FROM ref_units WHERE id = ?", [a.target_unit_id]);
        log("USERS", "OK", `    scope=${a.scope}, unit=${unit[0]?.nama_unit ?? "?"}`);
      }

      // Check rapor_scores as target
      const staffRapors = await query("SELECT COUNT(*) as cnt FROM rapor_scores WHERE user_nim = ?", [nim]);
      log("USERS", "OK", `  → ${staffRapors[0].cnt} rapor_scores (as target)`);

      // Check rapor_scores as penilai
      const asEvaluator = await query("SELECT COUNT(*) as cnt FROM rapor_scores WHERE penilai_nim = ?", [nim]);
      log("USERS", "OK", `  → ${asEvaluator[0].cnt} rapor_scores (as penilai)`);

      // Check intern_rapor_scores as penilai
      const asInternEval = await query("SELECT COUNT(*) as cnt FROM intern_rapor_scores WHERE penilai_nim = ?", [nim]);
      log("USERS", "OK", `  → ${asInternEval[0].cnt} intern_rapor_scores (as penilai)`);
    } catch (e) {
      log("USERS", "FAIL", `Error checking user ${nim}: ${e.message}`);
    }
  }
}

async function testDataIntegrity() {
  try {
    // Check for orphaned rapor_details (details without parent rapor_scores)
    const orphanedDetails = await query(
      "SELECT COUNT(*) as cnt FROM rapor_details rd LEFT JOIN rapor_scores rs ON rd.rapor_id = rs.id WHERE rs.id IS NULL"
    );
    if (orphanedDetails[0].cnt === 0) {
      log("INTEGRITY", "OK", "No orphaned rapor_details found");
    } else {
      log("INTEGRITY", "WARN", `${orphanedDetails[0].cnt} orphaned rapor_details (details without parent score)`);
    }

    // Check for orphaned intern_rapor_details
    const orphanedInternDetails = await query(
      "SELECT COUNT(*) as cnt FROM intern_rapor_details ird LEFT JOIN intern_rapor_scores irs ON ird.rapor_id = irs.id WHERE irs.id IS NULL"
    );
    if (orphanedInternDetails[0].cnt === 0) {
      log("INTEGRITY", "OK", "No orphaned intern_rapor_details found");
    } else {
      log("INTEGRITY", "WARN", `${orphanedInternDetails[0].cnt} orphaned intern_rapor_details`);
    }

    // Check for duplicate rapor (same user_nim + periode_id)
    const dupeStaff = await query(
      "SELECT user_nim, periode_id, COUNT(*) as cnt FROM rapor_scores GROUP BY user_nim, periode_id HAVING cnt > 1"
    );
    if (dupeStaff.length === 0) {
      log("INTEGRITY", "OK", "No duplicate rapor_scores (same user+period)");
    } else {
      log("INTEGRITY", "WARN", `${dupeStaff.length} duplicate rapor_scores entries found`);
      for (const d of dupeStaff.slice(0, 5)) {
        log("INTEGRITY", "WARN", `  → user=${d.user_nim}, period=${d.periode_id}, count=${d.cnt}`);
      }
    }

    // Check for duplicate intern rapor
    const dupeIntern = await query(
      "SELECT user_nim, periode_id, COUNT(*) as cnt FROM intern_rapor_scores GROUP BY user_nim, periode_id HAVING cnt > 1"
    );
    if (dupeIntern.length === 0) {
      log("INTEGRITY", "OK", "No duplicate intern_rapor_scores (same user+period)");
    } else {
      log("INTEGRITY", "WARN", `${dupeIntern.length} duplicate intern_rapor_scores entries found`);
    }

    // Count overall stats
    const totalStaffRapors = await query("SELECT COUNT(*) as cnt FROM rapor_scores");
    const totalInternRapors = await query("SELECT COUNT(*) as cnt FROM intern_rapor_scores");
    const totalDetails = await query("SELECT COUNT(*) as cnt FROM rapor_details");
    const totalInternDetails = await query("SELECT COUNT(*) as cnt FROM intern_rapor_details");
    const totalPeriods = await query("SELECT COUNT(*) as cnt FROM rapor_periods");
    const totalProfiles = await query("SELECT COUNT(*) as cnt FROM profiles");

    log("STATS", "OK", `Total profiles: ${totalProfiles[0].cnt}`);
    log("STATS", "OK", `Total periods: ${totalPeriods[0].cnt}`);
    log("STATS", "OK", `Total staff rapors: ${totalStaffRapors[0].cnt}`);
    log("STATS", "OK", `Total staff details: ${totalDetails[0].cnt}`);
    log("STATS", "OK", `Total intern rapors: ${totalInternRapors[0].cnt}`);
    log("STATS", "OK", `Total intern details: ${totalInternDetails[0].cnt}`);
  } catch (e) {
    log("INTEGRITY", "FAIL", `Data integrity check error: ${e.message}`);
  }
}

async function testRoleDistribution() {
  try {
    const roleCounts = await query("SELECT role, COUNT(*) as cnt FROM profiles GROUP BY role ORDER BY cnt DESC");
    for (const r of roleCounts) {
      log("ROLES", "OK", `${r.role}: ${r.cnt} users`);
    }
  } catch (e) {
    log("ROLES", "FAIL", `Role distribution error: ${e.message}`);
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  COMPREHENSIVE RAPOR SYSTEM AUDIT");
  console.log("═══════════════════════════════════════════\n");

  await testDatabaseConnection();
  console.log("\n--- Schema Checks ---");
  await testTablesExist();
  await testRaporScoresSchema();
  await testInternRaporScoresSchema();
  console.log("\n--- Role Distribution ---");
  await testRoleDistribution();
  console.log("\n--- Specific Users (A1A025089, K1C024052) ---");
  await testSpecificUsers();
  console.log("\n--- Meridian Role Integration ---");
  await testMeridianRoleIntegration();
  console.log("\n--- Staff Rapor CRUD ---");
  await testRaporSaveUpdateDelete();
  console.log("\n--- Intern Rapor CRUD ---");
  await testInternRaporSaveUpdateDelete();
  console.log("\n--- Period Publish Flow ---");
  await testPeriodPublish();
  console.log("\n--- Data Integrity ---");
  await testDataIntegrity();

  console.log("\n═══════════════════════════════════════════");
  console.log("  AUDIT SUMMARY");
  console.log("═══════════════════════════════════════════");
  const okCount = results.filter((r) => r.status === "OK").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  console.log(`✅ OK: ${okCount}  ⚠️ WARN: ${warnCount}  ❌ FAIL: ${failCount}`);

  if (failCount > 0) {
    console.log("\n❌ FAILED CHECKS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - [${r.category}] ${r.message}`);
    }
  }
  if (warnCount > 0) {
    console.log("\n⚠️ WARNINGS:");
    for (const r of results.filter((r) => r.status === "WARN")) {
      console.log(`  - [${r.category}] ${r.message}`);
    }
  }

  await pool.end();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
