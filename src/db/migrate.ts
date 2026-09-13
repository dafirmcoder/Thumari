import { config } from '../config.js';
import { createDatabase, applyMigrations } from './index.js';

async function main() {
  console.log(`Running migrations against ${config.databaseFile}...`);
  const { db } = createDatabase(config.databaseFile);
  await applyMigrations(db);
  console.log('Migrations complete.');
}

main().catch(console.error);
