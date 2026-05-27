const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function test() {
  const dbPath = path.join(__dirname, 'resources/stardict.db');
  console.log('DB Path:', dbPath);

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  console.log('File size:', fileBuffer.length);

  const db = new SQL.Database(fileBuffer);

  // Get tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\nTables:', tables[0]?.values);

  const tableName = 'stardict';
  console.log('Using table:', tableName);

  // Get columns
  const columns = db.exec(`PRAGMA table_info(${tableName})`);
  console.log('\nColumns:');
  for (const col of columns[0].values) {
    console.log(`  ${col[1]} (${col[2]})`);
  }

  // Count rows
  const count = db.exec(`SELECT COUNT(*) FROM ${tableName}`);
  console.log('\nTotal rows:', count[0]?.values[0]?.[0]);

  // Get first 5 words
  console.log('\nFirst 5 words:');
  const first5 = db.exec(`SELECT word, phonetic, translation, tag FROM ${tableName} LIMIT 5`);
  for (const row of first5[0].values) {
    console.log(`  word="${row[0]}", phonetic="${row[1]}", translation="${row[2]?.substring(0, 50)}...", tag="${row[3]}"`);
  }

  // Test search for 'a%' using word column
  console.log("\nSearch for 'a%' in word column:");
  const search = db.exec(`SELECT word, tag FROM ${tableName} WHERE LOWER(word) LIKE 'a%' LIMIT 10`);
  console.log('Results count:', search[0]?.values?.length || 0);
  if (search[0]?.values) {
    for (const row of search[0].values) {
      console.log(`  word="${row[0]}", tag="${row[1]}"`);
    }
  }

  // Test search for 'ab%'
  console.log("\nSearch for 'ab%' in word column:");
  const search2 = db.exec(`SELECT word, tag FROM ${tableName} WHERE LOWER(word) LIKE 'ab%' LIMIT 10`);
  console.log('Results count:', search2[0]?.values?.length || 0);
  if (search2[0]?.values) {
    for (const row of search2[0].values) {
      console.log(`  word="${row[0]}", tag="${row[1]}"`);
    }
  }

  // Test with parameter binding
  console.log("\nTest with parameter binding:");
  const stmt = db.prepare(`SELECT word, tag FROM ${tableName} WHERE LOWER(word) LIKE LOWER(:pattern) LIMIT 10`);
  stmt.bind({ ':pattern': 'a%' });
  let count2 = 0;
  while (stmt.step()) {
    const values = stmt.get();
    console.log(`  word="${values[0]}", tag="${values[1]}"`);
    count2++;
    if (count2 >= 3) break;
  }
  stmt.free();
  console.log('Total found:', count2);

  db.close();
}

test().catch(console.error);
