import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Cria o pool de conexões com SSL habilitado (exigido pelo Supabase)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Helper simples para executar queries diretas
export const query = (text, params) => pool.query(text, params);