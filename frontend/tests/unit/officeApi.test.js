import { test } from 'node:test';
import assert from 'node:assert/strict';
import { officeRequest } from '../../src/lib/officeApi.js';

test('taquilla sin token falla antes de hacer peticiones', async () => {
  await assert.rejects(officeRequest({rol:'SUPERADMIN'},'/venta-ventanilla'),{status:401});
});
test('taquilla envía el token y conserva errores de sesión y concurrencia',async()=>{
  const previous=globalThis.fetch;let captured;
  globalThis.fetch=async(url,options)=>{captured=options;return {ok:false,status:409,json:async()=>({error:'Asiento ocupado',asientos_ocupados:[9]})};};
  try {
    await assert.rejects(officeRequest({token:'sesion-ficticia',rol:'SUPERADMIN'},'/venta-ventanilla',{method:'POST',data:{programacion_id:1}}),error=>error.status===409&&error.occupied[0]===9);
    assert.equal(captured.headers.Authorization,'Bearer sesion-ficticia');
    assert.equal(captured.headers['x-user-role'],undefined);
    assert.deepEqual(JSON.parse(captured.body),{programacion_id:1});
  } finally {globalThis.fetch=previous;}
});
