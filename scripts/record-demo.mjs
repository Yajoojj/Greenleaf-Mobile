// Grava respostas REAIS do Axios Cassava IA para o modo demonstração.
// Uso: API_URL=https://sua-api.onrender.com node scripts/record-demo.mjs
// Antes, troque public/demo/folha-{sadia,leve,moderada,grave}.jpg por fotos reais (até 8 MB, JPEG).
// O script envia cada foto para POST /predict, salva o overlay em public/demo e
// reescreve src/services/fixtures/demo-cases.json. Confira se cada foto caiu no estado esperado.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = process.env.API_URL?.replace(/\/+$/, '');
if (!API || !API.startsWith('https://')) {
  console.error('Defina API_URL com https://');
  process.exit(1);
}

const ids = ['sadia', 'leve', 'moderada', 'grave'];
const out = [];
for (const id of ids) {
  const path = resolve(`public/demo/folha-${id}.jpg`);
  const form = new FormData();
  form.append('image', new Blob([readFileSync(path)], { type: 'image/jpeg' }), `folha-${id}.jpg`);
  const res = await fetch(`${API}/predict`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const body = await res.json();
  const [, b64] = String(body.overlay).split(',', 2);
  writeFileSync(resolve(`public/demo/folha-${id}-overlay.png`), Buffer.from(b64, 'base64'));
  body.overlay = `/demo/folha-${id}-overlay.png`;
  out.push({ id, image: `/demo/folha-${id}.jpg`, response: body });
  console.log(id, '→', body.class, body.severity, `${(body.ratio * 100).toFixed(1)}%`);
}
writeFileSync(resolve('src/services/fixtures/demo-cases.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log('Pronto. Rode `npm test` para validar os casos gravados.');
