'use strict';
const fs=require('node:fs'),path=require('node:path');
const {Client}=require('pg');
(async()=>{
 if(!process.env.DATABASE_URL) throw Error('DATABASE_URL required');
 const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try {
  await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('finance-migrations'))");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of fs.readdirSync(path.join(__dirname,'../db/migrations')).filter(x=>x.endsWith('.sql')).sort()) {
   if((await client.query('SELECT name FROM schema_migrations WHERE name=$1',[name])).rows.length) continue;
   await client.query(fs.readFileSync(path.join(__dirname,'../db/migrations',name),'utf8'));
   await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);console.log('Applied '+name);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
})().catch(()=>{console.error('Migration failed. Check database configuration and schema; no partial migration committed.');process.exitCode=1;});
