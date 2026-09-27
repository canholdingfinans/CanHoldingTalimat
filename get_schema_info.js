const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Canfinans2026@db.wygkdtlbjvdkhvvhkvxc.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  console.log('--- COLUMNS ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payment_instructions'
    ORDER BY ordinal_position;
  `);
  console.table(cols.rows);

  console.log('\n--- TRIGGERS ---');
  const triggers = await client.query(`
    SELECT trigger_name, action_statement, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table = 'payment_instructions';
  `);
  console.table(triggers.rows);

  console.log('\n--- RLS POLICIES ---');
  const policies = await client.query(`
    SELECT polname, polcmd, polqual, polwithcheck 
    FROM pg_policy 
    WHERE polrelid = 'payment_instructions'::regclass;
  `);
  console.table(policies.rows);

  console.log('\n--- CONSTRAINTS ---');
  const constraints = await client.query(`
    SELECT
      tc.constraint_name, 
      tc.constraint_type,
      kcu.column_name
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'payment_instructions';
  `);
  console.table(constraints.rows);

  await client.end();
}

run().catch(console.error);
