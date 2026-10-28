"""Gera as imagens do modo demonstração, as respostas gravadas e os ícones do PWA.

Uso (fora do app; precisa de numpy, pillow e opencv-python-headless):

    python scripts/generate_demo_assets.py <caminho para Axios_Cassava_IA/backend>

As folhas são ILUSTRAÇÕES geradas por código (não são fotos). As respostas são
calculadas pelo próprio código do servidor (hsv_utils.py do Axios Cassava IA),
no caminho "só cor" (sem o modelo EfficientNet carregado), por isso
model_probability é null. Substitua por fotos reais e respostas reais com
scripts/record-demo.mjs assim que a API estiver publicada.
"""

from __future__ import annotations

import json
import math
import random
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DEMO = ROOT / "public" / "demo"
OUT_ICONS = ROOT / "public" / "icons"
OUT_FIXTURES = ROOT / "src" / "services" / "fixtures"

SIZE = 720
SCALE = 2  # desenha em 2x e reduz (antisserrilhado)


def lobe_polygon(cx, cy, angle, length, width, steps=40):
    left, right = [], []
    for i in range(steps + 1):
        t = i / steps
        # perfil lanceolado: base estreita, máximo perto de 45% e ponta fina
        w = width * (math.sin(math.pi * min(1.0, t * 1.08)) ** 0.9) * (1 - 0.15 * t)
        x = cx + math.cos(angle) * length * t
        y = cy + math.sin(angle) * length * t
        nx, ny = -math.sin(angle), math.cos(angle)
        left.append((x + nx * w / 2, y + ny * w / 2))
        right.append((x - nx * w / 2, y - ny * w / 2))
    return left + right[::-1]


def draw_leaf(rng: random.Random):
    s = SIZE * SCALE
    noise = np.random.default_rng(rng.randint(0, 10_000))

    # fundo: solo com textura
    soil = np.zeros((s, s, 3), dtype=np.float32)
    soil[:] = (92, 70, 50)
    soil += noise.normal(0, 14, (s, s, 1))
    soil += noise.normal(0, 6, (s, s, 3))
    bg = Image.fromarray(np.clip(soil, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(3))

    leaf_mask = Image.new("L", (s, s), 0)
    veins = Image.new("L", (s, s), 0)
    dm, dv = ImageDraw.Draw(leaf_mask), ImageDraw.Draw(veins)

    cx, cy = s * 0.5, s * 0.62
    lobes = 7
    base_angle = -math.pi / 2
    spread = math.radians(250)
    for i in range(lobes):
        a = base_angle - spread / 2 + spread * i / (lobes - 1)
        center_factor = 1 - abs(i - (lobes - 1) / 2) / ((lobes - 1) / 2)
        length = s * (0.26 + 0.17 * center_factor) * rng.uniform(0.95, 1.05)
        width = length * rng.uniform(0.25, 0.3)
        dm.polygon(lobe_polygon(cx, cy, a, length, width), fill=255)
        dv.line([(cx, cy), (cx + math.cos(a) * length * 0.95, cy + math.sin(a) * length * 0.95)], fill=255, width=5)
    # pecíolo (avermelhado, típico da mandioca)
    petiole = [(cx, cy), (cx + s * 0.05, cy + s * 0.2), (cx + s * 0.08, cy + s * 0.42)]

    leaf_rgb = np.zeros((s, s, 3), dtype=np.float32)
    yy, xx = np.mgrid[0:s, 0:s]
    shade = 1 - 0.18 * np.clip(np.hypot(xx - cx, yy - cy) / (s * 0.45), 0, 1)
    leaf_rgb[:] = (50, 122, 42)
    leaf_rgb *= shade[..., None]
    leaf_rgb += noise.normal(0, 4, (s, s, 3))
    v = np.array(veins.filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)[..., None] / 255
    leaf_rgb = leaf_rgb * (1 - 0.5 * v) + np.array((120, 170, 90)) * 0.5 * v

    leaf_img = Image.fromarray(np.clip(leaf_rgb, 0, 255).astype("uint8"))
    out = bg.copy()
    d = ImageDraw.Draw(out)
    d.line(petiole, fill=(150, 60, 70), width=14, joint="curve")
    out.paste(leaf_img, (0, 0), leaf_mask.filter(ImageFilter.GaussianBlur(1.2)))
    return out, np.array(leaf_mask) > 128


def add_lesions(img: Image.Image, mask: np.ndarray, rng: random.Random, spots: int, halo: tuple[float, float], core: tuple[float, float], blight: int = 0):
    """Manchas angulares encharcadas com halo clorótico e, nos casos graves,
    áreas de queima/amarelecimento nas pontas dos lóbulos."""
    s = img.size[0]
    ys, xs = np.nonzero(mask)
    halo_layer = Image.new("L", (s, s), 0)
    core_layer = Image.new("L", (s, s), 0)
    dh, dc = ImageDraw.Draw(halo_layer), ImageDraw.Draw(core_layer)

    def blob(draw, x, y, radius, sides, jitter):
        pts = []
        for j in range(sides):
            a = 2 * math.pi * j / sides + rng.uniform(-jitter, jitter)
            r = radius * rng.uniform(0.6, 1.2)
            pts.append((x + math.cos(a) * r, y + math.sin(a) * r))
        draw.polygon(pts, fill=255)

    for _ in range(spots):
        k = rng.randrange(len(xs))
        x, y = xs[k], ys[k]
        blob(dh, x, y, rng.uniform(*halo) * SCALE, 9, 0.25)
        blob(dc, x, y, rng.uniform(*core) * SCALE, 6, 0.4)
    for _ in range(blight):
        k = rng.randrange(len(xs))
        x, y = xs[k], ys[k]
        blob(dh, x, y, rng.uniform(30, 48) * SCALE, 12, 0.3)
        for _ in range(6):
            blob(dc, x + rng.uniform(-20, 20) * SCALE, y + rng.uniform(-20, 20) * SCALE, rng.uniform(2, 4) * SCALE, 6, 0.4)

    leaf = Image.fromarray((mask * 255).astype("uint8"))
    halo_mask = Image.fromarray(np.minimum(np.array(halo_layer.filter(ImageFilter.GaussianBlur(2 * SCALE))), np.array(leaf)))
    core_mask = Image.fromarray(np.minimum(np.array(core_layer.filter(ImageFilter.GaussianBlur(0.6 * SCALE))), np.array(leaf)))
    # amarelo-esverdeado (clorose) e marrom-escuro (tecido necrosado)
    img.paste((179, 189, 52), (0, 0), halo_mask)
    img.paste((104, 70, 34), (0, 0), core_mask)
    return img


def finish(img: Image.Image) -> Image.Image:
    return img.resize((SIZE, SIZE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.4))


def analyse(jpeg_path: Path, hsv_utils):
    """Reproduz main.py /predict no caminho sem modelo (HSV apenas)."""
    started = time.perf_counter()
    pil_image = Image.open(jpeg_path).convert("RGB")
    np_image = np.array(pil_image)
    leaf_mask = hsv_utils.segment_leaf(np_image)
    infection_mask = np.logical_and(leaf_mask, hsv_utils.segment_infection(np_image))
    total = float(leaf_mask.sum()) if leaf_mask.sum() > 0 else 1.0
    ratio = float(infection_mask.sum() / total)
    severity = hsv_utils.classify_severity(ratio)
    hsv_probability = min(ratio / 0.20, 1.0)
    probability = hsv_probability
    predicted = "Infectado" if (ratio >= 0.02 or probability >= 0.45) else "Saudavel"
    overlay = hsv_utils.create_overlay(np_image, leaf_mask, infection_mask)
    # Observação: main.py codifica o array RGB direto com cv2.imencode (que espera BGR),
    # o que troca vermelho e azul no overlay real. Aqui convertemos para BGR antes,
    # que é o comportamento pretendido (folha verde, lesão vermelha). Ver docs/decisoes.md.
    ok, buffer = cv2.imencode(".png", cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
    assert ok
    elapsed = int((time.perf_counter() - started) * 1000)
    return {
        "probability": probability,
        "model_probability": None,
        "hsv_probability": hsv_probability,
        "class": predicted,
        "ratio": ratio,
        "severity": severity,
        "processing_time_ms": elapsed,
    }, buffer.tobytes()


CASES = [
    # id, seed, manchas, raio do halo (px), raio do centro (px), áreas de queima
    ("sadia", 11, 0, (0, 0), (0, 0), 0),
    ("leve", 23, 22, (11, 14), (1.5, 2.5), 0),
    ("moderada", 37, 22, (10, 13), (1.5, 3), 1),
    ("grave", 41, 55, (8, 12), (2, 3.5), 5),
]


def make_icons():
    OUT_ICONS.mkdir(parents=True, exist_ok=True)

    def icon(size: int, maskable: bool) -> Image.Image:
        s = size * 4
        img = Image.new("RGB", (s, s), (31, 84, 26))
        d = ImageDraw.Draw(img)
        pad = s * (0.22 if maskable else 0.14)
        # folha estilizada: duas curvas
        cx, cy, r = s / 2, s / 2, (s - 2 * pad) / 2
        leaf = []
        for i in range(61):
            t = i / 60
            a = math.pi * t
            leaf.append((cx - r * 0.95 + 2 * r * 0.95 * t, cy + r * 0.55 * math.sin(a) * 1.0))
        for i in range(61):
            t = i / 60
            a = math.pi * t
            leaf.append((cx + r * 0.95 - 2 * r * 0.95 * t, cy - r * 0.55 * math.sin(a) * 1.0))
        leaf_img = Image.new("L", (s, s), 0)
        ImageDraw.Draw(leaf_img).polygon(leaf, fill=255)
        leaf_img = leaf_img.rotate(40, center=(cx, cy), resample=Image.BICUBIC)
        img.paste((126, 200, 106), (0, 0), leaf_img)
        vein = Image.new("L", (s, s), 0)
        ImageDraw.Draw(vein).line([(cx - r * 0.9, cy), (cx + r * 0.75, cy)], fill=255, width=max(2, s // 40))
        vein = vein.rotate(40, center=(cx, cy), resample=Image.BICUBIC)
        img.paste((31, 84, 26), (0, 0), vein)
        return img.resize((size, size), Image.LANCZOS)

    icon(192, False).save(OUT_ICONS / "icon-192.png")
    icon(512, False).save(OUT_ICONS / "icon-512.png")
    icon(512, True).save(OUT_ICONS / "icon-maskable-512.png")
    icon(180, True).save(OUT_ICONS / "apple-touch-icon.png")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    sys.path.insert(0, str(Path(sys.argv[1]).resolve()))
    import hsv_utils  # noqa: E402  (código do servidor real)

    OUT_DEMO.mkdir(parents=True, exist_ok=True)
    OUT_FIXTURES.mkdir(parents=True, exist_ok=True)
    manifest = []
    for case_id, seed, spots, halo, core, blight in CASES:
        rng = random.Random(seed)
        img, mask = draw_leaf(rng)
        if spots:
            img = add_lesions(img, mask, rng, spots, halo, core, blight)
        img = finish(img)
        jpg = OUT_DEMO / f"folha-{case_id}.jpg"
        img.save(jpg, "JPEG", quality=92, subsampling=0, optimize=True)
        response, overlay_png = analyse(jpg, hsv_utils)
        (OUT_DEMO / f"folha-{case_id}-overlay.png").write_bytes(overlay_png)
        response["overlay"] = f"/demo/folha-{case_id}-overlay.png"
        manifest.append({"id": case_id, "image": f"/demo/folha-{case_id}.jpg", "response": response})
        print(case_id, response["class"], response["severity"], round(response["ratio"] * 100, 2), "%")
    (OUT_FIXTURES / "demo-cases.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    make_icons()


if __name__ == "__main__":
    main()
