// Supabase direkt pg bağlantısı - farklı host formatları
const { Client } = require('pg');

const PASSWORD = 'Canfinans2026';
const PROJECT_REF = 'wygkdtlbjvdkhvvhkvxc';

const configs = [
  {
    label: 'Direct IPv4 pooler (6543)',
    host: `${PROJECT_REF}.supabase.co`,
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  {
    label: 'Pooler (aws-0-eu-central-1) session 5432',
    host: `aws-0-eu-central-1.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  {
    label: 'Pooler (aws-0-eu-central-1) transaction 6543',
    host: `aws-0-eu-central-1.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: PASSWORD,
    ssl: { rejectUnauthorized: false }
  }
];

async function tryConfig(config) {
  const { label, ...pgConfig } = config;
  const client = new Client({ ...pgConfig, connectionTimeoutMillis: 15000 });
  try {
    console.log(`\nDeneniyor: ${label}`);
    await client.connect();
    console.log(`✅ BAĞLANDI!`);
    
    const res = await client.query(
      "SELECT column_name, data_type, is_nullable, column_default " +
      "FROM information_schema.columns " +
      "WHERE table_schema = 'public' AND table_name = 'payment_instructions' " +
      "ORDER BY ordinal_position"
    );
    
    console.log('\n=== CANLI DB: payment_instructions SÜTUNLARI ===');
    res.rows.forEach(r => {
      console.log(`  ${r.column_name.padEnd(30)} | ${String(r.data_type).padEnd(25)} | null:${r.is_nullable}`);
    });
    
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables " +
      "WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('\n=== TÜM PUBLIC TABLOLAR ===');
    tables.rows.forEach(r => console.log(' -', r.table_name));
    
    await client.end();
    return true;
  } catch(e) {
    console.log(`❌ HATA: ${e.message}`);
    try { await client.end(); } catch(_) {}
    return false;
  }
}

async function run() {
  for (const config of configs) {
    const ok = await tryConfig(config);
    if (ok) process.exit(0);
  }
  console.log('\n⚠️ Tüm bağlantı denemeleri başarısız.');
  process.exit(1);
}

run();
