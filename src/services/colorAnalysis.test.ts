import { describe, expect, it } from 'vitest';
import { analyseColors, classifySeverity, paintOverlay, rgbToHsvCv } from './colorAnalysis';

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

const LEAF: [number, number, number] = [50, 122, 42];
const SOIL: [number, number, number] = [92, 70, 50];
const CHLOROSIS: [number, number, number] = [179, 189, 52];

describe('rgbToHsvCv', () => {
  it('usa a escala do OpenCV (H 0–180)', () => {
    expect(rgbToHsvCv(255, 0, 0)).toEqual([0, 255, 255]);
    expect(rgbToHsvCv(0, 255, 0)).toEqual([60, 255, 255]);
    expect(rgbToHsvCv(0, 0, 255)).toEqual([120, 255, 255]);
  });
});

describe('classifySeverity (igual ao servidor)', () => {
  it.each([
    [0, 'Leve'],
    [0.0299, 'Leve'],
    [0.03, 'Moderada'],
    [0.1499, 'Moderada'],
    [0.15, 'Grave'],
  ] as const)('%f → %s', (ratio, sev) => expect(classifySeverity(ratio)).toBe(sev));
});

describe('analyseColors', () => {
  it('folha verde sobre solo não tem manchas', () => {
    const w = 60;
    const data = image(w, w, (x, y) => (Math.hypot(x - 30, y - 30) < 20 ? LEAF : SOIL));
    expect(analyseColors(data, w, w).ratio).toBe(0);
  });

  it('mancha clorótica dentro da folha aumenta a taxa', () => {
    const w = 60;
    const data = image(w, w, (x, y) => {
      if (Math.hypot(x - 30, y - 30) >= 20) return SOIL;
      return x > 30 && y > 30 ? CHLOROSIS : LEAF;
    });
    const a = analyseColors(data, w, w);
    expect(a.ratio).toBeGreaterThan(0.15);
    paintOverlay(data, a);
    const i = (40 * w + 40) * 4;
    expect([data[i], data[i + 1], data[i + 2]]).toEqual([255, 93, 93]);
  });
});
