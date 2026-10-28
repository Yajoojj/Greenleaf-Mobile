// Grava respostas REAIS da GreenLeaf IA v2 para o modo demonstração.
// Uso: API_URL=https://greenleaf-ia.onrender.com node scripts/record-demo.mjs
// Envia cada foto de public/demo/folha-{sadia,leve,moderada,grave,mosaico}.jpg para POST /predict,
// salva o overlay JPEG (contorno amarelo = onde a IA olhou) em public/demo e reescreve
// src/services/fixtures/demo-cases.json. O rótulo de cada exemplo no app vem da resposta, não do nome do arquivo.
// folha-mosaico.jpg é a foto 1226263276.jpg (CMD) do conjunto de TESTE da IA (training/data/splits.csv).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = process.env.API_URL?.replace(/\/+$/, '');
if (!API || !API.startsWith('https://')) {
  console.error('Defina API_URL com https://');
  process.exit(1);
}

const ids = ['sadia', 'leve', 'moderada', 'grave', 'mosaico'];
const out = [];
for (const id of ids) {
  const path = resolve(`public/demo/folha-${id}.jpg`);
  const form = new FormData();
  form.append('image', new Blob([readFileSync(path)], { type: 'image/jpeg' }), `folha-${id}.jpg`);
  const res = await fetch(`${API}/predict`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const body = await res.json();
  const [head, b64] = String(body.overlay).split(',', 2);
  if (head !== 'data:image/jpeg;base64') throw new Error(`${id}: overlay não é JPEG (servidor antigo?)`);
  writeFileSync(resolve(`public/demo/folha-${id}-overlay.jpg`), Buffer.from(b64, 'base64'));
  body.overlay = `/demo/folha-${id}-overlay.jpg`;
  out.push({ id, image: `/demo/folha-${id}.jpg`, response: body });
  console.log(id, '→', body.class, body.severity, body.other_disease ?? '-', body.diagnosis?.label, body.model_version);
}
writeFileSync(resolve('src/services/fixtures/demo-cases.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log('Pronto. Rode `npm test` para validar os casos gravados.');
