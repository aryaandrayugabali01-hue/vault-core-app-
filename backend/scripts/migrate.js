import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../database/migrations');

async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum_sha256 TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const filenames = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const filename of filenames) {
    const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const { rows } = await pool.query('SELECT checksum_sha256 FROM schema_migrations WHERE filename=$1', [filename]);
    if (rows[0]) {
      if (rows[0].checksum_sha256 !== checksum) throw new Error(`Applied migration was modified: ${filename}`);
      console.log(`skip ${filename}`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename,checksum_sha256) VALUES ($1,$2)', [filename, checksum]);
      await client.query('COMMIT');
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}

main().catch((error) => {
  console.error('[migrations]', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
