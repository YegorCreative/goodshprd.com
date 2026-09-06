'use strict';
let pool;
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('Database not configured');
  if (!pool) pool = new (require('pg').Pool)({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  return pool;
}
function database(source = getPool()) {
  return {
    query: (sql, params) => source.query(sql, params),
    async transaction(work) {
      const client = await source.connect();
      try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
  };
}
module.exports = { database };
