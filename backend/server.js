import 'dotenv/config';
import { app } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`VAULT CORE API listening on ${port}`));

async function shutdown() {
  server.close();
  await pool.end();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
