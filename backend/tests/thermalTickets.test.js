const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createFixture } = require('./helpers/planningFixture');
const { purchaseDate, fareLines } = require('../src/services/receiptFormat');
const mail = require('../src/services/emailService');
const realSend = mail.enviarBoletoEmail;
const sent = [];
mail.enviarBoletoEmail = async data => { sent.push(data); return { exito: true, enviadoReal: false }; };
let fixture, server, base;
const migration = fs.readFileSync(path.join(__dirname,'../database/05_boletos_termicos_tarifas.sql'),'utf8');
function cedula(n) {
  const digits = ('180' + String(n).padStart(6,'0')).split('').map(Number);
  const sum = digits.reduce((total,d,i) => total + (i % 2 ? d : d * 2 > 9 ? d * 2 - 9 : d * 2),0);
  return digits.join('') + (10 - sum % 10) % 10;
}
const passenger = (id, type = 'NORMAL') => ({ asiento_id: id, nombre: 'Pasajero de prueba', cedula: cedula(id), tipo_pasajero: type, precio: -100 });
async function request(route, method = 'GET', data) {
  const response = await fetch(base+route, { method, headers: { 'Content-Type':'application/json', Authorization: `Bearer ${fixture.createSession(4)}` }, body: data && JSON.stringify(data) });
  return { status: response.status, data: await response.json() };
}
const sale = (passengers, extras = {}) => request('/venta-ventanilla','POST',{programacion_id:1,pasajeros:passengers,...extras});
async function untilSent() {
  for (let i=0;i<100 && !sent.length;i++) await new Promise(resolve => setTimeout(resolve,5));
  assert.equal(sent.length,1);
  return sent[0];
}
before(async () => {
  fixture = await createFixture();
  server = fixture.app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(async () => {
  await fixture.seed(); sent.length=0;
  await fixture.pool.query('TRUNCATE asientos RESTART IDENTITY CASCADE');
  await fixture.pool.query(`INSERT INTO asientos(bus_id,numero_asiento,fila,columna,categoria)
    SELECT 1,n,(n-1)/4+1,(n-1)%4+1,CASE WHEN n<=8 THEN 'VIP' ELSE 'NORMAL' END FROM generate_series(1,40) n`);
  await fixture.pool.query("UPDATE frecuencias SET precio_base=5.01 WHERE id=1");
  await fixture.pool.query("INSERT INTO programacion_viajes(id,frecuencia_id,bus_id,fecha_viaje,hora_salida_programada) VALUES(1,1,1,'2100-01-01','08:00')");
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await fixture.database.close(); mail.enviarBoletoEmail=realSend;
});

test('taquilla calcula los cuatro tipos en servidor, redondea centavos y guarda desglose',async () => {
  const result = await sale(['NORMAL','MENOR','TERCERA_EDAD','DISCAPACIDAD'].map((type,i)=>passenger(i+1,type)));
  assert.equal(result.status,201); assert.equal(Number(result.data.reserva.total),12.54);
  assert.ok(result.data.reserva.comprado_en);
  const receipt = (await request(`/reservas/${result.data.codigo_reserva}`)).data;
  assert.deepEqual(receipt.boletos.map(b=>Number(b.precio)),[5.01,2.51,2.51,2.51]);
  assert.deepEqual(receipt.boletos.map(b=>Number(b.descuento)),[0,2.5,2.5,2.5]);
  assert.ok(receipt.boletos.every(b=>Number(b.tarifa_base)===5.01 && b.codigo_qr));
  assert.ok(receipt.boletos.every(b=>b.nombre_pasajero==='Pasajero de prueba'));
});

test('cliente conserva el tramo proporcional y normaliza NIÑO sin alterar el nombre',async () => {
  await fixture.pool.query("UPDATE frecuencias SET origen='Quito',destino='Loja',paradas_intermedias=ARRAY['Latacunga','Ambato','Riobamba','Cuenca'],precio_base=20 WHERE id=1");
  const result = await request('/reservas','POST',{programacion_id:1,asientos:[9],pasajeros:[passenger(9,'NIÑO')],tramo:{inicio:1,fin:4}});
  assert.equal(result.status,201); assert.equal(Number(result.data.reserva.total),6);
  assert.equal(result.data.reserva.comprado_en,null);
  const r=(await request(`/reservas/${result.data.reserva.codigo_reserva}`)).data;
  assert.equal(r.origen,'Latacunga'); assert.equal(r.destino,'Cuenca');
  assert.equal(r.boletos[0].tipo_pasajero,'MENOR'); assert.equal(Number(r.boletos[0].tarifa_base),12);
});

test('identidad, tipo, nombre, correo y tramo inválidos revierten la operación',async () => {
  for (const changes of [{cedula:'1111111111'},{nombre:''},{tipo_pasajero:'DESCUENTO_LIBRE'},{tipo_pasajero:['NORMAL']}]) {
    assert.equal((await sale([{...passenger(1),...changes}])).status,400);
  }
  assert.equal((await sale([passenger(1)],{tramo:{inicio:1,fin:0}})).status,400);
  assert.equal((await sale([passenger(1)],{email:{correo:'falso'}})).status,400);
  assert.equal((await sale([passenger(1),{...passenger(2),cedula:cedula(1)}])).status,400);
  assert.equal((await fixture.pool.query('SELECT COUNT(*)::int n FROM reservas')).rows[0].n,0);
});

test('la tarifa se conserva aunque luego cambie el catálogo',async () => {
  const result=await sale([passenger(1,'TERCERA_EDAD')]);
  await fixture.pool.query("UPDATE frecuencias SET precio_base=50 WHERE id=1");
  const receipt=(await request(`/reservas/${result.data.codigo_reserva}`)).data;
  assert.equal(Number(receipt.boletos[0].tarifa_base),5.01);
  assert.equal(Number(receipt.total),2.51);
});

test('aprobar la compra web registra la hora de pago y notifica con todos los desgloses',async () => {
  const result=await request('/reservas','POST',{programacion_id:1,asientos:[9],pasajeros:[passenger(9,'DISCAPACIDAD')],email:'receptor@prueba.test'});
  assert.equal(result.status,201);
  assert.equal((await fetch(`${base}/reservas/${result.data.reserva.codigo_reserva}/boletos/1/pdf`)).status,404);
  const approval=await request(`/reservas/${result.data.reserva.id}/aprobar`,'PUT',{});
  assert.equal(approval.status,200); assert.ok(approval.data.reserva.comprado_en);
  const notification=await untilSent();
  assert.equal(notification.emailDestinatario,'receptor@prueba.test'); assert.ok(notification.comprado_en);
  assert.equal(notification.boletos[0].tipo_pasajero,'DISCAPACIDAD');
  assert.equal((await request(`/reservas/${result.data.reserva.id}/aprobar`,'PUT',{})).status,409);
  assert.equal(sent.length,1);
});

test('correo de taquilla lleva sello de compra y no usa un destinatario ficticio',async () => {
  const r=await sale([passenger(1,'MENOR')],{email:' Receptor@Prueba.test '});
  assert.equal(r.status,201); const notification=await untilSent();
  assert.equal(notification.emailDestinatario,'receptor@prueba.test');
  assert.ok(notification.comprado_en); assert.equal(notification.boletos[0].tipo_pasajero,'MENOR');
});

test('reimpresión pagada conserva QR y abordaje, tiene ancho 80 mm y rechaza boletos ajenos',async () => {
  const result=await sale([passenger(1,'TERCERA_EDAD')]);
  const code=result.data.codigo_reserva;
  const r=(await request(`/reservas/${code}`)).data, b=r.boletos[0];
  await fixture.pool.query('UPDATE detalle_boletos SET validado_en_puerta=TRUE WHERE id=$1',[b.id]);
  for (let i=0;i<2;i++) {
    const response=await fetch(`${base}/reservas/${code}/boletos/${b.id}/pdf`);
    assert.equal(response.status,200); assert.match(response.headers.get('content-type'),/application\/pdf/);
    assert.match(response.headers.get('cache-control'),/no-store/);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.match(bytes.toString('latin1'),/\/MediaBox \[0 0 226\.771654/);
    assert.match(bytes.toString('latin1'),/\/Count 1\b/);
    if (process.env.CR07_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.CR07_EVIDENCE_DIR,{recursive:true});
      fs.writeFileSync(path.join(process.env.CR07_EVIDENCE_DIR,'boleto-80mm-prueba.pdf'),bytes);
    }
  }
  assert.equal((await fetch(`${base}/reservas/${code}/boletos/999999/pdf`)).status,404);
  const current=(await request(`/reservas/${code}`)).data;
  assert.equal(current.boletos[0].codigo_qr,b.codigo_qr); assert.equal(current.boletos[0].validado_en_puerta,true);
  assert.equal((await fixture.pool.query('SELECT COUNT(*)::int n FROM reservas')).rows[0].n,1);
  assert.equal((await sale([passenger(1)])).status,409);
});

test('migración repetible y boleto histórico no inventan descuentos ni hora de compra',async () => {
  const {rows:[r]}=await fixture.pool.query("INSERT INTO reservas(programacion_id,codigo_reserva,total,estado) VALUES(1,'OLD-001',3.5,'PAGADO') RETURNING *");
  await fixture.pool.query("INSERT INTO detalle_boletos(reserva_id,asiento_id,nombre_pasajero,cedula_pasajero,precio,codigo_qr) VALUES($1,1,'Histórico','0000000000',3.5,'QR-ANTIGUO')",[r.id]);
  await fixture.database.exec(migration); await fixture.database.exec(migration);
  const receipt=(await request('/reservas/OLD-001')).data;
  assert.equal(receipt.comprado_en,null); assert.equal(receipt.boletos[0].tipo_pasajero,null);
  assert.equal(Number(receipt.boletos[0].precio),3.5); assert.equal(receipt.boletos[0].codigo_qr,'QR-ANTIGUO');
  assert.match(fareLines(receipt.boletos[0]).join(' '),/histórico no registrado/);
  assert.equal((await fetch(`${base}/reservas/OLD-001/boletos/${receipt.boletos[0].id}/pdf`)).status,200);
});

test('correo muestra fecha de compra Ecuador, desglose y escapa contenido del catálogo',() => {
  const html=mail.generarPlantillaBoleto({cooperativa:'<script>falso</script>',origen:'Ambato',destino:'Quito',fecha:'2100-01-01',hora:'08:00',asientos:[1],total:2.5,reservaId:'TAQ-PRUEBA',comprado_en:'2026-11-20T20:00:15Z',boletos:[{numero_asiento:1,categoria:'VIP',tipo_pasajero:'TERCERA_EDAD',tarifa_base:5,descuento:2.5,precio:2.5}]},'cid:codigo_qr_boleto');
  assert.match(html,/20\/11\/2026, 15:00:15/); assert.match(html,/Salida del viaje/);
  assert.match(html,/Descuento \(50%\)/); assert.match(html,/Tarifa base/);
  assert.ok(!html.includes('<script>')); assert.match(html,/&lt;script&gt;/);
  assert.match(purchaseDate('2026-11-20 20:00:15'),/15:00:15/);
});

test('el formato térmico admite textos largos sin generar páginas adicionales',async () => {
  const {buildTicketPdf}=require('../src/services/ticketService');
  const bytes=await buildTicketPdf({cooperativa_nombre:'Cooperativa de Transportes de Prueba '.repeat(3),codigo_reserva:'TAQ-LARGO',fecha_viaje:'2100-01-01',hora_salida_programada:'08:00',origen:'Terminal de origen de prueba '.repeat(3),destino:'Terminal de destino de prueba '.repeat(3),numero_disco:15,creado_en:'2026-11-20T20:00:15Z'},
    {id:1,numero_asiento:40,categoria:'NORMAL',nombre_pasajero:'Pasajero de prueba con nombres largos '.repeat(3),cedula_pasajero:'1800000018',precio:3.5});
  assert.match(bytes.toString('latin1'),/\/Count 1\b/);
  if (process.env.CR07_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.CR07_EVIDENCE_DIR,'boleto-80mm-textos-largos.pdf'),bytes);
});

test('la base de datos rechaza un desglose inconsistente sin alterar el boleto',async () => {
  const result=await sale([passenger(1,'MENOR')]);
  await assert.rejects(fixture.pool.query('UPDATE detalle_boletos SET descuento=100 WHERE reserva_id=$1',[result.data.reserva.id]),/boleto_desglose_cr07/);
  const receipt=(await request(`/reservas/${result.data.codigo_reserva}`)).data;
  assert.equal(Number(receipt.boletos[0].descuento),2.5);
});

test('el historial autenticado muestra el tramo comprado, no la ruta completa',async () => {
  const secretBefore=process.env.HISTORY_TOKEN_SECRET;
  process.env.HISTORY_TOKEN_SECRET='clave-aislada-cr07-solo-para-pruebas-2026';
  try {
    await fixture.pool.query("UPDATE frecuencias SET origen='Quito',destino='Loja',paradas_intermedias=ARRAY['Latacunga','Cuenca'],precio_base=15 WHERE id=1");
    const result=await request('/reservas','POST',{programacion_id:1,asientos:[9],pasajeros:[passenger(9)],email:'historial@prueba.test',tramo:{inicio:1,fin:2}});
    assert.equal(result.status,201);
    const payload=Buffer.from(JSON.stringify({purpose:'purchase-history',email:'historial@prueba.test',expires:Date.now()+60000})).toString('base64url');
    const token=payload+'.'+require('node:crypto').createHmac('sha256',process.env.HISTORY_TOKEN_SECRET).update(payload).digest('base64url');
    const response=await fetch(base+'/mis-compras',{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(response.status,200); const [row]=await response.json();
    assert.equal(row.origen,'Latacunga'); assert.equal(row.destino,'Cuenca');
    assert.equal(Number(row.total),5); assert.equal(row.total_pasajeros,1);
  } finally {
    if (secretBefore===undefined) delete process.env.HISTORY_TOKEN_SECRET;
    else process.env.HISTORY_TOKEN_SECRET=secretBefore;
  }
});
