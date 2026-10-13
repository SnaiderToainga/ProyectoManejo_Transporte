const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Conectado a la base de datos Supabase');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};