const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Canfinans2026@db.wygkdtlbjvdkhvvhkvxc.supabase.co:5432/postgres',
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  const tables = {};
  for (const row of res.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(`${row.column_name} (${row.data_type})`);
  }

  for (const [table, columns] of Object.entries(tables)) {
    console.log(`\nTable: ${table}`);
    columns.forEach(c => console.log(`  - ${c}`));
  }

  await client.end();
}

run().catch(console.error);
