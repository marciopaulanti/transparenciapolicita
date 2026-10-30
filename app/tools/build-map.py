#!/usr/bin/env python3
"""
Gera o mapa do Brasil (SVG paths) usado pelo protótipo.

Fonte da geometria: brazil-states.geojson (geometria pública simplificada,
distribuída sob CC0/ODbL pela Click That Hood / Natural Earth, derivada do
IBGE). O script baixa o arquivo, aplica projeção cônica equivalente de Albers
(parallel padrão -30° e 6°, meridiano central -50°), simplifica os polígonos
com Douglas-Peucker e grava `app/js/data/br-map.js`.

Uso:  python3 app/tools/build-map.py
"""

import json
import math
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "app", "js", "data", "br-map.js")

URL = "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson"

# ---------------------------------------------------------------- projeção
PHI1, PHI2, LAMBDA0 = math.radians(-30.0), math.radians(6.0), math.radians(-50.0)
PHI0 = math.radians(-12.0)
N = (math.sin(PHI1) + math.sin(PHI2)) / 2.0
C = math.cos(PHI1) ** 2 + 2 * N * math.sin(PHI1)
RHO0 = math.sqrt(C - 2 * N * math.sin(PHI0)) / N


def project(lon, lat):
    phi = math.radians(lat)
    rho = math.sqrt(C - 2 * N * math.sin(phi)) / N
    theta = N * (math.radians(lon) - LAMBDA0)
    return rho * math.sin(theta), RHO0 - rho * math.cos(theta)


# ------------------------------------------------- simplificação (DP)
def perp_dist(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def douglas_peucker(points, eps):
    if len(points) < 3:
        return points
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        d = perp_dist(points[i], points[0], points[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = douglas_peucker(points[: idx + 1], eps)
        right = douglas_peucker(points[idx:], eps)
        return left[:-1] + right
    return [points[0], points[-1]]


def rings_of(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]


def fetch(url):
    """Baixa a geometria. Usa curl (o certificado do Python não é confiável nesta máquina)."""
    cache = os.path.join(HERE, ".cache", "brazil-states.geojson")
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    if not os.path.exists(cache):
        subprocess.run(["curl", "-sSfL", "-o", cache, url], check=True)
    with open(cache, "r", encoding="utf-8") as fh:
        return json.load(fh)


def main():
    data = fetch(URL)

    features = []
    minx = miny = float("inf")
    maxx = maxy = float("-inf")

    for feat in data["features"]:
        props = feat["properties"]
        sigla, nome = props["sigla"], props["name"]
        regiao = props.get("regiao_id")
        allrings = []
        for poly in rings_of(feat["geometry"]):
            outer = poly[0]
            proj = [project(lon, lat) for lon, lat in outer]
            simplified = douglas_peucker(proj, 0.0016)
            if len(simplified) < 4:
                continue
            allrings.append(simplified)
            for x, y in simplified:
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
        if allrings:
            features.append({"sigla": sigla, "nome": nome, "regiao": regiao, "rings": allrings})

    # normaliza para um viewBox de 1000 x (proporção real)
    width = 1000.0
    scale = width / (maxx - minx)
    height = (maxy - miny) * scale

    def to_path(rings):
        out = []
        for ring in rings:
            pts = [((x - minx) * scale, (maxy - y) * scale) for x, y in ring]
            d = "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"
            out.append(d)
        return "".join(out)

    rows = []
    for f in features:
        path = to_path(f["rings"])
        # centroide do maior anel
        big = max(f["rings"], key=len)
        ax = sum(p[0] for p in big) / len(big)
        ay = sum(p[1] for p in big) / len(big)
        cx, cy = (ax - minx) * scale, (maxy - ay) * scale
        rows.append(
            {
                "sigla": f["sigla"],
                "nome": f["nome"],
                "regiao": f["regiao"],
                "d": path,
                "cx": round(cx, 1),
                "cy": round(cy, 1),
            }
        )

    rows.sort(key=lambda r: r["sigla"])

    body = ",\n".join(
        '  {{ sigla: "{s}", nome: "{n}", regiao: "{r}", d: "{d}", cx: {cx}, cy: {cy} }}'.format(
            s=r["sigla"], n=r["nome"], r=r["regiao"], d=r["d"], cx=r["cx"], cy=r["cy"]
        )
        for r in rows
    )

    js = (
        "// Gerado por app/tools/build-map.py — NÃO editar à mão.\n"
        "// Geometria pública simplificada (IBGE/Natural Earth), projeção cônica de Albers.\n"
        "// Só o contorno é dado real; os valores pintados neste protótipo são fictícios.\n"
        f"export const MAP_VIEWBOX = '0 0 {width:.0f} {height:.0f}';\n"
        f"export const MAP_STATES = [\n{body}\n];\n"
        "export const MAP_BY_SIGLA = Object.fromEntries(MAP_STATES.map((s) => [s.sigla, s]));\n"
    )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(js)

    print(f"ok: {len(rows)} estados -> {OUT} ({os.path.getsize(OUT)} bytes, viewBox 0 0 {width:.0f} {height:.0f})")


if __name__ == "__main__":
    main()
