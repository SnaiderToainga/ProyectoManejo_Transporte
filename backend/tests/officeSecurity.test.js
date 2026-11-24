const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('./helpers/planningFixture');
let fixture, server, base;
const aliases = [
  ['GET','/oficina/reservas-pendientes'],['GET','/oficina/pendientes'],['GET','/oficina/comprobantes'],
  ['GET','/reservas-pendientes'],['GET','/reservas/pendientes'],
  ['PUT','/reservas/1/aprobar'],['PUT','/reservas/1/rechazar'],
  ['PUT','/oficina/reservas/1/aprobar'],['PUT','/oficina/reservas/1/rechazar'],
  ['PUT','/oficina/reservas/1/validar'],['POST','/oficina/reservas/1/validar'],
  ['PUT','/oficina/validar-comprobante/1'],['PUT','/reservas/1/validar'],
  ['POST','/oficina/venta-ventanilla'],['POST','/oficina/ventas'],['POST','/venta-ventanilla'],
  ['GET','/oficina/hoja-ruta'],['GET','/hoja-ruta'],
  ['PUT','/oficina/hoja-ruta/1/estado'],['PUT','/hoja-ruta/1/estado']
];
async function request(route,{method='GET',user=4,data,headers={}}={}) {
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',
    ...(user ? {Authorization:`Bearer ${fixture.createSession(user)}`} : {}),...headers},
    body:data===undefined?undefined:JSON.stringify(data)});
  return {status:response.status,data:await response.json()};
}
const saleData = seat => ({programacion_id:2,pasajeros:[{asiento_id:seat,nombre:'Pasajero de prueba',cedula:'1710034065',tipo_pasajero:'NORMAL',precio:0}]});
before(async()=>{
  fixture=await createFixture();server=fixture.app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(async()=>{
  await fixture.seed();
  await fixture.pool.query("INSERT INTO usuarios(id,nombre,correo,rol,password_hash,cooperativa_id) VALUES(7,'Otra taquilla','oficina@otra.test','OFICINISTA','no-login',2)");
  await fixture.pool.query("SELECT setval(pg_get_serial_sequence('usuarios','id'),7)");
  await fixture.pool.query("INSERT INTO programacion_viajes(id,frecuencia_id,bus_id,fecha_viaje,hora_salida_programada) VALUES(1,1,1,'2100-01-01','08:00'),(2,4,6,'2100-01-01','09:00')");
  await fixture.pool.query("INSERT INTO reservas(id,programacion_id,codigo_reserva,total,estado,expira_en) VALUES(1,1,'OWN-001',5,'PENDIENTE','2100-01-02'),(2,2,'OTHER-001',5,'PENDIENTE','2100-01-02')");
  await fixture.pool.query(`INSERT INTO detalle_boletos(reserva_id,asiento_id,nombre_pasajero,cedula_pasajero,precio)
    SELECT r.id,a.id,'Prueba','1710034065',5 FROM reservas r JOIN programacion_viajes pv ON pv.id=r.programacion_id
    JOIN asientos a ON a.bus_id=pv.bus_id AND a.numero_asiento=1`);
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await fixture.database.close();});

test('todos los alias y ambos montajes rechazan anónimos antes de operar',async()=>{
  for(const prefix of ['', '/oficina']) for(const [method,path] of aliases) {
    const result=await request(prefix+path,{method,user:null,data:method==='GET'?undefined:{}});
    assert.equal(result.status,401,method+' '+prefix+path);
  }
  assert.equal((await request('/boletos/validar-qr',{method:'POST',user:null,data:{}})).status,401);
  assert.equal((await fixture.pool.query("SELECT COUNT(*)::int n FROM reservas WHERE estado<>'PENDIENTE'")).rows[0].n,0);
});

test('clientes, choferes y gerentes no obtienen permisos de taquilla por sus cabeceras',async()=>{
  for(const user of [2,5,6]) for(const [method,path] of aliases) {
    const result=await request(path,{method,user,data:method==='GET'?undefined:{},headers:{'x-user-role':'SUPERADMIN','x-user-cooperativa-id':'1'}});
    assert.equal(result.status,403,method+' '+path+' user '+user);
  }
  assert.equal((await request('/venta-ventanilla',{method:'POST',user:null,data:{},headers:{'x-user-role':'SUPERADMIN'}})).status,401);
  assert.equal((await request('/reservas-pendientes',{headers:{Authorization:`Bearer ${fixture.createSession(4)}alterado`}})).status,401);
});

test('bandeja y hoja de ruta solo devuelven la cooperativa de la sesión',async()=>{
  const own=await request('/reservas-pendientes?cooperativa_id=2');
  assert.equal(own.status,200);assert.deepEqual(own.data.map(r=>r.id),[1]);
  const route=await request('/oficina/hoja-ruta?fecha=2100-01-01&cooperativa_id=2');
  assert.equal(route.status,200);assert.deepEqual(route.data.map(r=>r.id),[1]);
  assert.deepEqual((await request('/reservas-pendientes',{user:7})).data.map(r=>r.id),[2]);
  assert.equal((await request('/reservas-pendientes',{user:1})).data.length,2);
  assert.equal((await request('/hoja-ruta?fecha=2100-01-01',{user:1})).data.length,2);
});

test('venta, aprobación, rechazo y estados ajenos fallan sin modificar datos',async()=>{
  const foreignSeat=(await fixture.pool.query('SELECT id FROM asientos WHERE bus_id=6 AND numero_asiento=2')).rows[0].id;
  for(const route of ['/venta-ventanilla','/oficina/ventas','/oficina/oficina/venta-ventanilla']) {
    assert.equal((await request(route,{method:'POST',data:{...saleData(foreignSeat),cooperativa_id:1},headers:{'x-user-role':'SUPERADMIN'}})).status,403);
  }
  for(const route of ['/reservas/2/aprobar','/oficina/reservas/2/rechazar','/reservas/2/validar']) {
    assert.equal((await request(route,{method:'PUT',data:{accion:'APROBAR'}})).status,403);
  }
  assert.equal((await request('/hoja-ruta/2/estado',{method:'PUT',data:{estado:'EN_RUTA'}})).status,403);
  const {rows:[r]}=await fixture.pool.query("SELECT estado,(SELECT estado FROM programacion_viajes WHERE id=2) viaje FROM reservas WHERE id=2");
  assert.equal(r.estado,'PENDIENTE');assert.equal(r.viaje,'PROGRAMADO');
  assert.equal((await fixture.pool.query('SELECT COUNT(*)::int n FROM reservas')).rows[0].n,2);
});

test('oficinista propio y SuperAdmin pueden operar; estados no retroceden',async()=>{
  assert.equal((await request('/reservas/1/aprobar',{method:'PUT',data:{}})).status,200);
  assert.equal((await request('/reservas/2/rechazar',{method:'PUT',user:1,data:{}})).status,200);
  assert.equal((await request('/hoja-ruta/1/estado',{method:'PUT',data:{estado:'FINALIZADO'}})).status,409);
  assert.equal((await request('/hoja-ruta/1/estado',{method:'PUT',data:{estado:'EN_RUTA'}})).status,200);
  assert.equal((await request('/hoja-ruta/1/estado',{method:'PUT',data:{estado:'FINALIZADO'}})).status,200);
  assert.equal((await request('/hoja-ruta/1/estado',{method:'PUT',data:{estado:'PROGRAMADO'}})).status,400);
  assert.equal((await request('/hoja-ruta/1/estado',{method:'PUT',data:{estado:{nombre:'EN_RUTA'}}})).status,400);
  assert.equal((await request('/hoja-ruta/1/estado',{method:'PUT',data:{estado:'EN_RUTA'}})).status,409);
});

test('revocar rol o cooperativa invalida permisos aunque el token siga firmado',async()=>{
  const headers={Authorization:`Bearer ${fixture.createSession(4)}`};
  await fixture.pool.query("UPDATE usuarios SET rol='CLIENTE' WHERE id=4");
  assert.equal((await request('/reservas-pendientes',{headers})).status,403);
  await fixture.pool.query("UPDATE usuarios SET rol='OFICINISTA',cooperativa_id=NULL WHERE id=4");
  assert.ok([401,403].includes((await request('/reservas-pendientes',{headers})).status));
  await fixture.pool.query("UPDATE usuarios SET cooperativa_id=1 WHERE id=4");
  await fixture.pool.query('UPDATE cooperativas SET activo=FALSE WHERE id=1');
  assert.equal((await request('/reservas-pendientes',{headers})).status,401);
});

test('la validación QR antigua exige sesión, cooperativa y no admite reuso',async()=>{
  await fixture.pool.query("UPDATE reservas SET estado='PAGADO' WHERE id=2");
  const ticket=(await fixture.pool.query('SELECT id FROM detalle_boletos WHERE reserva_id=2')).rows[0].id;
  const data={boleto_id:ticket,codigo_reserva:'OTHER-001'};
  assert.equal((await request('/boletos/validar-qr',{method:'POST',data})).status,404);
  assert.equal((await request('/boletos/validar-qr',{method:'POST',user:5,data})).status,403);
  assert.equal((await request('/boletos/validar-qr',{method:'POST',user:7,data})).status,200);
  assert.equal((await request('/boletos/validar-qr',{method:'POST',user:7,data})).status,400);
});

test('la protección de taquilla conserva catálogo, login y consulta pública por código',async()=>{
  assert.equal((await request('/viajes?fecha=2100-01-01',{user:null})).status,200);
  assert.equal((await request('/reservas/OWN-001',{user:null})).status,200);
  assert.equal((await request('/admin/login',{method:'POST',user:null,data:{correo:'oficinista4@prueba.test',password:'Prueba2026*'}})).status,200);
});
