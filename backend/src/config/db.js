const { Pool, types } = require('pg');
require('dotenv').config();

// OID 1114 = TIMESTAMP (sin zona horaria). Supabase almacena en UTC;
// forzamos al driver a tratarlo como UTC para evitar desplazamiento de zona horaria local (-5 horas)
types.setTypeParser(1114, str => (str ? new Date(str.replace(' ', 'T') + 'Z') : null));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
});

let connectedLogged = false;
pool.on('connect', () => {
  if (!connectedLogged) {
    connectedLogged = true;
    console.log('Conectado a la base de datos Supabase');
  }
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
