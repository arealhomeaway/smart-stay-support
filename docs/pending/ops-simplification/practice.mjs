import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const db = new PGlite();
try {
 await db.exec(await readFile(new URL('./practice-setup.sql', import.meta.url), 'utf8'));
 await db.exec(await readFile(new URL('./apply.sql', import.meta.url), 'utf8'));
 console.log('Isolated schema application passed; behavior and undo checks still required.');
} catch (error) {
 console.error('Isolated practice failed:', error instanceof Error ? error.message : String(error));
 process.exitCode = 1;
} finally { await db.close(); }
