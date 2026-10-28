/**
 * Aproximação, no navegador, do caminho "só cor" do Axios Cassava IA (backend/hsv_utils.py).
 * Usada SOMENTE pelo MockPredictionService para que o modo sem servidor reaja à foto enviada.
 * Não é o modelo de IA: não há EfficientNet aqui, por isso model_probability é sempre null.
 * Diferença conhecida: o servidor usa operações morfológicas do OpenCV; aqui há apenas um
 * fechamento simples para incluir manchas pequenas dentro da folha.
 */

export interface ColorAnalysis {
  ratio: number;
  leafMask: Uint8Array;
  infectionMask: Uint8Array;
}

/** RGB → HSV na escala do OpenCV (H 0–180, S e V 0–255). */
export function rgbToHsvCv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : (d / max) * 255;
  return [Math.round(h / 2), Math.round(s), max];
}

function inRange(h: number, s: number, v: number, lo: [number, number, number], hi: [number, number, number]) {
  return h >= lo[0] && h <= hi[0] && s >= lo[1] && s <= hi[1] && v >= lo[2] && v <= hi[2];
}

/** Dilatação/erosão quadrada de raio r (para o fechamento morfológico). */
function morph(mask: Uint8Array, w: number, h: number, r: number, dilate: boolean): Uint8Array {
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  // passe horizontal
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        const v = mask[y * w + xx];
        if (dilate ? v : !v) { acc = dilate ? 1 : 0; break; }
      }
      tmp[y * w + x] = acc;
    }
  }
  // passe vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        const v = tmp[yy * w + x];
        if (dilate ? v : !v) { acc = dilate ? 1 : 0; break; }
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

export function analyseColors(data: Uint8ClampedArray, width: number, height: number): ColorAnalysis {
  const n = width * height;
  const leafRaw = new Uint8Array(n);
  const lesion = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const [h, s, v] = rgbToHsvCv(r, g, b);
    const greenDominant = g > r + 8 && g > b + 8 && g > 45;
    leafRaw[i] = inRange(h, s, v, [24, 45, 35], [96, 255, 245]) && greenDominant ? 1 : 0;
    const yellowBrown = inRange(h, s, v, [8, 90, 45], [45, 255, 235]);
    const necroticDark = inRange(h, s, v, [0, 35, 20], [35, 180, 125]);
    const healthyGreen = g > r + 12 && g > b + 12 && s > 60;
    lesion[i] = (yellowBrown || necroticDark) && !healthyGreen ? 1 : 0;
  }
  const r = Math.max(2, Math.round(Math.min(width, height) * 0.006));
  const leafMask = morph(morph(leafRaw, width, height, r, true), width, height, r, false);
  const infectionMask = new Uint8Array(n);
  let leafCount = 0;
  let infCount = 0;
  for (let i = 0; i < n; i++) {
    if (leafMask[i]) {
      leafCount++;
      if (lesion[i]) {
        infectionMask[i] = 1;
        infCount++;
      }
    }
  }
  return { ratio: leafCount ? infCount / leafCount : 0, leafMask, infectionMask };
}

/** Mesma regra de severidade do servidor (classify_severity). */
export function classifySeverity(ratio: number): 'Leve' | 'Moderada' | 'Grave' {
  if (ratio < 0.03) return 'Leve';
  if (ratio < 0.15) return 'Moderada';
  return 'Grave';
}

/** Pinta o overlay como create_overlay: folha em verde translúcido, lesões em vermelho. */
export function paintOverlay(data: Uint8ClampedArray, a: ColorAnalysis): void {
  const n = a.leafMask.length;
  for (let i = 0; i < n; i++) {
    if (a.infectionMask[i]) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 93;
      data[i * 4 + 2] = 93;
    } else if (a.leafMask[i]) {
      data[i * 4] = Math.round(87 * 0.42 + data[i * 4] * 0.58);
      data[i * 4 + 1] = Math.round(184 * 0.42 + data[i * 4 + 1] * 0.58);
      data[i * 4 + 2] = Math.round(70 * 0.42 + data[i * 4 + 2] * 0.58);
    }
  }
}
