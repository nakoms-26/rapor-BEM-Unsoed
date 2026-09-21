import mysql, { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import crypto from "node:crypto";
import { Database } from "@/types/database";

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: Pool | undefined;
}

export function getMySQLPool(): Pool {
  if (!globalThis.__mysqlPool) {
    const host = process.env.MYSQL_HOST || "153.92.15.57";
    const port = Number(process.env.MYSQL_PORT || 3306);
    const user = process.env.MYSQL_USER || "u256329210_rapor";
    const password = process.env.MYSQL_PASSWORD || "M3DI<0MI3ANGGa";
    const database = process.env.MYSQL_DATABASE || "u256329210_rapor";

    globalThis.__mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 15,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      decimalNumbers: true,
      typeCast: function (field: any, next: () => any) {
        if (field.type === "TINY" && field.length === 1) {
          const val = field.string();
          return val === null ? null : val === "1";
        }
        return next();
      },
    });
  }
  return globalThis.__mysqlPool;
}

export interface QueryResult<T = any> {
  data: T | null;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
  count?: number | null;
}

const TABLE_ALIASES: Record<string, string> = {
  kemenko_sub_indicators: "kemenko_sub_indicator_templates",
};

// Tables where `id` column is a UUID that should be automatically generated if not supplied
const UUID_ID_TABLES = new Set([
  "ref_units",
  "app_sessions",
  "rapor_periods",
  "rapor_scores",
  "rapor_details",
  "pj_assignments",
  "evaluator_unit_assignments",
  "kemenko_sub_indicator_templates",
  "intern_rapor_scores",
  "intern_rapor_details",
  "intern_sub_indicator_templates",
]);

type Tables = Database["public"]["Tables"];

export class MySQLQueryBuilder<TRow = any, TResult = TRow[]>
  implements PromiseLike<QueryResult<TResult>>
{
  private table: string;
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectedColumns: string = "*";
  private hasSelect: boolean = false;
  private headOnly: boolean = false;
  private countExact: boolean = false;
  private conditions: string[] = [];
  private params: any[] = [];
  private orders: string[] = [];
  private limitVal?: number;
  private offsetVal?: number;
  private insertData?: any | any[];
  private updateData?: Record<string, any>;
  private singleMode: "none" | "single" | "maybeSingle" = "none";

  constructor(table: string) {
    this.table = TABLE_ALIASES[table] || table;
  }

  select(
    columns: string = "*",
    options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }
  ): this {
    this.hasSelect = true;
    this.selectedColumns = columns;
    if (options?.head) {
      this.headOnly = true;
    }
    if (options?.count === "exact") {
      this.countExact = true;
    }
    return this;
  }

  eq(column: string, value: any): this {
    if (value === null || value === undefined) {
      this.conditions.push(`\`${column}\` IS NULL`);
    } else {
      this.conditions.push(`\`${column}\` = ?`);
      this.params.push(value);
    }
    return this;
  }

  neq(column: string, value: any): this {
    if (value === null || value === undefined) {
      this.conditions.push(`\`${column}\` IS NOT NULL`);
    } else {
      this.conditions.push(`\`${column}\` != ?`);
      this.params.push(value);
    }
    return this;
  }

  in(column: string, values: any[]): this {
    if (!values || values.length === 0) {
      this.conditions.push("1 = 0");
    } else {
      const placeholders = values.map(() => "?").join(", ");
      this.conditions.push(`\`${column}\` IN (${placeholders})`);
      this.params.push(...values);
    }
    return this;
  }

  is(column: string, value: any): this {
    if (value === null || value === undefined) {
      this.conditions.push(`\`${column}\` IS NULL`);
    } else {
      this.conditions.push(`\`${column}\` = ?`);
      this.params.push(value);
    }
    return this;
  }

  gte(column: string, value: any): this {
    this.conditions.push(`\`${column}\` >= ?`);
    this.params.push(value);
    return this;
  }

  lte(column: string, value: any): this {
    this.conditions.push(`\`${column}\` <= ?`);
    this.params.push(value);
    return this;
  }

  gt(column: string, value: any): this {
    this.conditions.push(`\`${column}\` > ?`);
    this.params.push(value);
    return this;
  }

  lt(column: string, value: any): this {
    this.conditions.push(`\`${column}\` < ?`);
    this.params.push(value);
    return this;
  }

  like(column: string, pattern: string): this {
    this.conditions.push(`\`${column}\` LIKE ?`);
    this.params.push(pattern);
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.conditions.push(`\`${column}\` LIKE ?`);
    this.params.push(pattern);
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const dir = options?.ascending === false ? "DESC" : "ASC";
    this.orders.push(`\`${column}\` ${dir}`);
    return this;
  }

  limit(count: number): this {
    this.limitVal = count;
    return this;
  }

  range(from: number, to: number): this {
    this.limitVal = Math.max(0, to - from + 1);
    this.offsetVal = Math.max(0, from);
    return this;
  }

  single(): MySQLQueryBuilder<TRow, TRow> {
    this.singleMode = "single";
    this.limitVal = 1;
    return this as any;
  }

  maybeSingle(): MySQLQueryBuilder<TRow, TRow | null> {
    this.singleMode = "maybeSingle";
    this.limitVal = 1;
    return this as any;
  }

  insert(data: any | any[]): MySQLQueryBuilder<TRow, any> {
    this.action = "insert";
    this.insertData = data;
    return this as any;
  }

  update(data: Record<string, any>): MySQLQueryBuilder<TRow, null> {
    this.action = "update";
    this.updateData = data;
    return this as any;
  }

  delete(): MySQLQueryBuilder<TRow, null> {
    this.action = "delete";
    return this as any;
  }

  upsert(
    data: any | any[],
    _options?: { onConflict?: string; ignoreDuplicates?: boolean }
  ): MySQLQueryBuilder<TRow, any> {
    this.action = "upsert";
    this.insertData = data;
    return this as any;
  }

  private buildWhereClause(): string {
    if (this.conditions.length === 0) return "";
    return ` WHERE ${this.conditions.join(" AND ")}`;
  }

  private formatSelectColumns(cols: string): string {
    const trimmed = cols.trim();
    if (trimmed === "*") return "*";

    return trimmed
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((col) => {
        if (col.includes("(") || col.includes(" as ") || col.includes(" AS ")) {
          return col;
        }
        return `\`${col}\``;
      })
      .join(", ");
  }

  async execute(): Promise<QueryResult<TResult>> {
    const pool = getMySQLPool();

    try {
      if (this.action === "select") {
        let totalCount: number | null = null;

        // Head only: SELECT COUNT(*)
        if (this.headOnly || this.countExact) {
          const countSql = `SELECT COUNT(*) as countVal FROM \`${this.table}\`${this.buildWhereClause()}`;
          const [countRows] = await pool.query<RowDataPacket[]>(countSql, this.params);
          totalCount = Number(countRows[0]?.countVal ?? 0);

          if (this.headOnly) {
            return { data: null, error: null, count: totalCount };
          }
        }

        const colsSql = this.formatSelectColumns(this.selectedColumns);
        let sql = `SELECT ${colsSql} FROM \`${this.table}\`${this.buildWhereClause()}`;

        if (this.orders.length > 0) {
          sql += ` ORDER BY ${this.orders.join(", ")}`;
        }

        const queryParams = [...this.params];

        if (this.limitVal !== undefined) {
          sql += ` LIMIT ?`;
          queryParams.push(this.limitVal);
          if (this.offsetVal !== undefined) {
            sql += ` OFFSET ?`;
            queryParams.push(this.offsetVal);
          }
        }

        const [rows] = await pool.query<RowDataPacket[]>(sql, queryParams);

        if (this.singleMode === "single") {
          if (!rows || rows.length === 0) {
            return {
              data: null,
              error: {
                message: "JSON object requested, multiple (or no) rows returned",
                code: "PGRST116",
              },
              count: totalCount,
            };
          }
          return { data: rows[0] as unknown as TResult, error: null, count: totalCount };
        }

        if (this.singleMode === "maybeSingle") {
          if (!rows || rows.length === 0) {
            return { data: null, error: null, count: totalCount };
          }
          return { data: rows[0] as unknown as TResult, error: null, count: totalCount };
        }

        return { data: rows as unknown as TResult, error: null, count: totalCount };
      }

      if (this.action === "insert" || this.action === "upsert") {
        const rawRows = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        if (rawRows.length === 0) {
          return { data: (Array.isArray(this.insertData) ? [] : null) as unknown as TResult, error: null };
        }

        const preparedRows = rawRows.map((row) => {
          const copy = { ...row };
          if (UUID_ID_TABLES.has(this.table) && !copy.id) {
            copy.id = crypto.randomUUID();
          }
          return copy;
        });

        const columns = Object.keys(preparedRows[0]);
        const colListSql = columns.map((c) => `\`${c}\``).join(", ");
        const rowPlaceholders = `(${columns.map(() => "?").join(", ")})`;
        const allPlaceholders = preparedRows.map(() => rowPlaceholders).join(", ");

        const insertParams: any[] = [];
        for (const row of preparedRows) {
          for (const col of columns) {
            const val = row[col];
            insertParams.push(val === undefined ? null : val);
          }
        }

        let sql = `INSERT INTO \`${this.table}\` (${colListSql}) VALUES ${allPlaceholders}`;

        if (this.action === "upsert") {
          const updateAssignments = columns
            .filter((c) => c !== "id")
            .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
            .join(", ");
          if (updateAssignments) {
            sql += ` ON DUPLICATE KEY UPDATE ${updateAssignments}`;
          }
        }

        await pool.query<ResultSetHeader>(sql, insertParams);

        const returnData = Array.isArray(this.insertData) ? preparedRows : preparedRows[0];
        return { data: returnData as unknown as TResult, error: null };
      }

      if (this.action === "update") {
        if (!this.updateData || Object.keys(this.updateData).length === 0) {
          return { data: null, error: null };
        }

        const keys = Object.keys(this.updateData);
        const setSql = keys.map((k) => `\`${k}\` = ?`).join(", ");
        const updateParams = keys.map((k) => {
          const val = this.updateData![k];
          return val === undefined ? null : val;
        });

        const whereClause = this.buildWhereClause();
        const sql = `UPDATE \`${this.table}\` SET ${setSql}${whereClause}`;
        const finalParams = [...updateParams, ...this.params];

        await pool.query<ResultSetHeader>(sql, finalParams);

        if (this.hasSelect) {
          const colsSql = this.formatSelectColumns(this.selectedColumns);
          const selectSql = `SELECT ${colsSql} FROM \`${this.table}\`${whereClause} LIMIT 1`;
          const [updatedRows] = await pool.query<RowDataPacket[]>(selectSql, this.params);
          if (this.singleMode === "single" || this.singleMode === "maybeSingle") {
            return { data: (updatedRows[0] ?? null) as unknown as TResult, error: null };
          }
          return { data: updatedRows as unknown as TResult, error: null };
        }

        return { data: null, error: null };
      }

      if (this.action === "delete") {
        const sql = `DELETE FROM \`${this.table}\`${this.buildWhereClause()}`;
        await pool.query<ResultSetHeader>(sql, this.params);
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[MySQLQueryBuilder] Error in ${this.action} on '${this.table}':`, err);
      return {
        data: null,
        error: { message: err?.message || String(err), code: err?.code },
      };
    }
  }

  then<TResult1 = QueryResult<TResult>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<TResult>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function createMySQLClient() {
  return {
    from: <
      TTable extends keyof Tables | (string & {}),
      TRow = TTable extends keyof Tables ? Tables[TTable]["Row"] : any
    >(
      table: TTable
    ) => new MySQLQueryBuilder<TRow>(table as string),
  };
}
