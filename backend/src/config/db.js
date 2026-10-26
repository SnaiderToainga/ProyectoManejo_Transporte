const { Pool, types } = require('pg');
require('dotenv').config();

// OID 1114 = TIMESTAMP (sin zona horaria). Supabase almacena en UTC;
// forzamos al driver a tratarlo como UTC para evitar desplazamiento de zona horaria local (-5 horas)
types.setTypeParser(1114, str => (str ? new Date(str.replace(' ', 'T') + 'Z') : null));

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
