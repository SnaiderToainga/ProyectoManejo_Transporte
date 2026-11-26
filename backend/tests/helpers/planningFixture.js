const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');

async function createFixture() {
  const database = new PGlite();
  const schema = readFileSync(path.join(__dirname, '../../database/01_schema.sql'), 'utf8');
  const migration = readFileSync(path.join(__dirname, '../../database/04_planificacion_hojas_ruta.sql'), 'utf8');
  await database.exec(schema);
  // Columnas y rol incorporados antes de CR-08 en la base v1.7.0.
  await database.exec(`ALTER TABLE usuarios ADD COLUMN cedula VARCHAR(15), ADD COLUMN bus_id INT REFERENCES buses(id);
    ALTER TABLE usuarios DROP CONSTRAINT usuarios_rol_check;
    ALTER TABLE usuarios ADD CHECK(rol IN ('SUPERADMIN','ADMIN_COOP','OFICINISTA','CLIENTE','CHOFER'));`);
  await database.exec(migration);
  await database.exec(migration);
  await database.exec(readFileSync(path.join(__dirname, '../../database/05_boletos_termicos_tarifas.sql'), 'utf8'));
  // CR-14: redes sociales y canales de soporte de la cooperativa.
  await database.exec(readFileSync(path.join(__dirname, '../../database/09_cr14_branding_soporte.sql'), 'utf8'));
  let queue = Promise.resolve();
  async function connect() {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    return { query: async (sql, params) => {
      const result = await database.query(sql, params);
      return { ...result, rowCount: result.affectedRows || result.rows.length };
    }, release };
  }
  const pool = { connect, query: async (sql, params) => {
    const client = await connect();
    try { return await client.query(sql, params); } finally { client.release(); }
  } };
  // Sustitución exclusiva del proceso de pruebas. Nunca carga DATABASE_URL.
  require.cache[require.resolve('../../src/config/db')] = { exports: { query: pool.query, pool } };
  const express = require('express');
  const app = express();
  const bookingController = require('../../src/controllers/bookingController');
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), bookingController.procesarWebhookStripe);
  app.use(express.json());
  app.use('/api/admin', require('../../src/routes/adminRoutes'));
  app.use('/api/clientes', require('../../src/routes/customerRoutes'));
  app.use('/api/planificacion', require('../../src/routes/planningRoutes'));
  app.use('/api', require('../../src/routes/catalogRoutes'));
  app.use('/api', require('../../src/routes/officeRoutes'));
  app.use('/api/oficina', require('../../src/routes/officeRoutes'));
  app.use('/api', require('../../src/routes/bookingRoutes'));
  app.use('/api/chofer', require('../../src/routes/choferRoutes'));
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  const { createSession } = require('../../src/services/sessionAccess');
  const { hashPassword } = require('../../src/services/passwords');
  const passwordHash = await hashPassword('Prueba2026*');

  async function seed() {
    await database.exec('TRUNCATE cooperativas, usuarios RESTART IDENTITY CASCADE');
    await database.exec(`INSERT INTO cooperativas(nombre,ruc) VALUES('Cooperativa de prueba','1890012345001'),('Otra cooperativa','1890022345001');
      INSERT INTO buses(cooperativa_id,numero_disco,placa,capacidad)
        SELECT 1,n,'TEST-' || n,40 FROM generate_series(1,5) n;
      INSERT INTO buses(cooperativa_id,numero_disco,placa,capacidad) VALUES(2,6,'TEST-6',40);
      INSERT INTO asientos(bus_id,numero_asiento,fila,columna,categoria)
        SELECT b.id,n,(n-1)/4+1,(n-1)%4+1,CASE WHEN n<=8 THEN 'VIP' ELSE 'NORMAL' END
        FROM buses b CROSS JOIN generate_series(1,40) n;
      INSERT INTO frecuencias(cooperativa_id,resolucion_ant,origen,destino,hora_salida,precio_base)
        SELECT 1,'ANT-RES-TEST-' || n,'Ambato','Destino ' || n,'08:00',5 FROM generate_series(1,3) n;
      INSERT INTO frecuencias(cooperativa_id,resolucion_ant,origen,destino,hora_salida,precio_base)
        VALUES(2,'ANT-RES-TEST-4','Otra ciudad','Otra ruta','09:00',5),(1,'ANT-RES-TEST-5','Centro','Terminal','10:00',1);
      INSERT INTO sucursales(cooperativa_id,nombre,localidad) VALUES(1,'Terminal de prueba','Ambato'),(2,'Otra oficina','Quito');
      INSERT INTO grupos_buses(cooperativa_id,nombre,tipo_operacion,inicio_ciclo) VALUES(1,'Flota 3+2','INTERPROVINCIAL','2100-01-01');
      INSERT INTO grupos_frecuencias(cooperativa_id,nombre,tipo_operacion) VALUES(1,'Rutas 3+2','INTERPROVINCIAL');
      INSERT INTO grupo_bus_miembros SELECT n,1 FROM generate_series(1,5) n;
      INSERT INTO grupo_frecuencia_miembros SELECT n,1 FROM generate_series(1,3) n;
      INSERT INTO grupo_vinculos VALUES(1,1);`);
    for (const [id, role, coop] of [[1, 'SUPERADMIN', null], [2, 'ADMIN_COOP', 1], [3, 'ADMIN_COOP', 2], [4, 'OFICINISTA', 1], [5, 'CLIENTE', null], [6, 'CHOFER', 1]]) {
      await pool.query(`INSERT INTO usuarios(id,nombre,correo,rol,password_hash,cooperativa_id,bus_id,sucursal_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, `Usuario ${role}`, `${role.toLowerCase()}${id}@prueba.test`, role, passwordHash, coop,
        role === 'CHOFER' ? 1 : null, role === 'OFICINISTA' ? 1 : null]);
    }
    await pool.query("SELECT setval(pg_get_serial_sequence('usuarios','id'),6)");
  }
  await seed();
  return { app, pool, database, seed, createSession, migration };
}

module.exports = { createFixture };
