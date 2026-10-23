import argparse
import sys
from pathlib import Path

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, LogNorm

RAIZ = Path(__file__).resolve().parents[1]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

import db

CARPETA = Path(__file__).resolve().parent
LOGO_PATH = RAIZ / "frontend" / "public" / "logo_jg.jpg"  # None para desactivarla
LOGO_ALPHA = 0.18  # opacidad (0 a 1); más bajo = más tenue
LOGO_ANCHO = 0.25  # ancho del logo como fracción del ancho de la figura (~3,5 pulgadas)
SALIDA = CARPETA / "heatmap_nacimientos_edad_padres.png"

parser = argparse.ArgumentParser(description="Heatmap de edades de padre y madre.")
parser.add_argument("--anio", type=int, default=None, help="Año a graficar. Si se omite, suma todos.")
ANIO = parser.parse_args().anio

conn = db.conectar()
try:
    filtro = ""
    params = ()
    if ANIO is not None:
        filtro = "WHERE anio = %s"
        params = (ANIO,)
    df = db._consultar(
        conn,
        f"""
        SELECT edad_padre_grupo,
               edad_madre_grupo,
               SUM(total_nacimientos)::bigint AS total_nacimientos
        FROM nacimientos.mv_heatmap_edad_padre_madre
        {filtro}
        GROUP BY edad_padre_grupo, edad_madre_grupo
        """,
        params,
    )
finally:
    conn.close()

padres = ["10-14 años", "15-19 años", "20-24 años", "25-29 años", "30-34 años", "35-39 años", "40-44 años", "45-49 años", "50-54 años", "55+ años"]
madres = ["10-14 años", "15-19 años", "20-24 años", "25-29 años", "30-34 años", "35-39 años", "40-44 años", "45-49 años", "50-54 años"]
pv = df.pivot_table(index="edad_padre_grupo", columns="edad_madre_grupo", values="total_nacimientos", aggfunc="sum").reindex(index=padres, columns=madres)
n = int(df.total_nacimientos.sum())
fmt = lambda v: f"{int(v):,}".replace(",", ".")
mid = lambda g: 57 if g.startswith("55") else int(g[:2]) + 2
df["dif"] = df.edad_padre_grupo.map(mid) - df.edad_madre_grupo.map(mid)
dif = float((df.dif * df.total_nacimientos).sum() / df.total_nacimientos.sum())
dif_txt = f"{dif:.1f}".replace(".", ",")
lab = lambda s: s.replace(" años", "")

cmap = LinearSegmentedColormap.from_list("rainbow_log", ["#ff1fa6", "#9b00d6", "#2a00ff", "#0057ff", "#00b8ff", "#00e5b0", "#3dff3d", "#b6ff00", "#ffe600", "#ff8c00", "#ff1a00", "#8a0000"])
cmap.set_bad("#0a0a0a")
data = np.ma.masked_invalid(pv.values)
fig, ax = plt.subplots(figsize=(14, 10), facecolor="black")
ax.set_facecolor("black")
im = ax.imshow(data, cmap=cmap, norm=LogNorm(vmin=1, vmax=np.nanmax(pv.values)), aspect="auto")
ax.set_xticks(range(len(madres)))
ax.set_xticklabels([lab(m) for m in madres], color="white", fontsize=12)
ax.set_yticks(range(len(padres)))
ax.set_yticklabels([lab(p) for p in padres], color="white", fontsize=12)
ax.invert_yaxis()
ax.set_xlabel("Grupo etario de la madre", color="white", fontsize=14, labelpad=10, fontweight="bold")
ax.set_ylabel("Grupo etario del padre", color="white", fontsize=14, labelpad=12, fontweight="bold")
ax.tick_params(length=0)
for s in ax.spines.values():
    s.set_visible(False)
ax.set_xticks(np.arange(-.5, len(madres), 1), minor=True)
ax.set_yticks(np.arange(-.5, len(padres), 1), minor=True)
ax.grid(which="minor", color="black", linewidth=2.5)
ax.tick_params(which="minor", length=0)
mx = np.nanmax(pv.values)
for i in range(pv.shape[0]):
    for j in range(pv.shape[1]):
        v = pv.values[i, j]
        if not np.isnan(v):
            r, g, b, _ = im.cmap(im.norm(v))
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            ax.text(j, i, fmt(v), ha="center", va="center", fontsize=10, fontweight="bold", color="black" if lum > 0.55 else "white")
cb = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
cb.set_label("Nacimientos (escala logarítmica)", color="white", fontsize=12)
cb.ax.yaxis.set_tick_params(color="white")
plt.setp(cb.ax.get_yticklabels(), color="white")
cb.outline.set_visible(False)
cb.set_ticks([1, 10, 100, 1000, 10000])
cb.set_ticklabels(["1", "10", "100", "1.000", "10.000"])
fig.suptitle("Nacimientos en Colombia en el 2025 según grupo etario de los padres", color="white", fontsize=19, fontweight="bold", x=0.5, y=0.975)
fig.text(0.5, 0.915, f"En promedio, los padres son {dif_txt} años mayores que las madres*", color="#ffee00", fontsize=14, fontweight="bold", ha="center")
fig.text(0.06, 0.045, "Fuente: Estadísticas Vitales - EEVV - DANE 2025\nElaborado por: Julián Gómez", color="#b0b0b0", fontsize=9, ha="left", va="center", linespacing=1.5)
fig.text(0.94, 0.045, f"n = {fmt(n)} suma de nacimientos con edad reportada en los padres\n*Estimado con el punto medio de cada grupo de edad (55+ = 57 años)", color="#b0b0b0", fontsize=9, ha="right", va="center", linespacing=1.5)
plt.subplots_adjust(left=0.08, right=0.90, top=0.86, bottom=0.14)


def agregar_marca_agua(fig, ax, ruta, alpha, ancho):
    from PIL import Image
    lum = np.asarray(Image.open(ruta).convert("L"), dtype=float)
    a = np.clip((lum - 40) / (255 - 40), 0, 1)  # el fondo oscuro del logo pasa a transparente
    ys, xs = np.where(a > 0.15)
    pad = 12
    a = a[max(ys.min() - pad, 0):ys.max() + pad, max(xs.min() - pad, 0):xs.max() + pad]
    rgba = np.dstack([np.ones_like(a), np.ones_like(a), np.ones_like(a), a * alpha])
    fw, fh = fig.get_size_inches()
    alto = ancho * fw * (a.shape[0] / a.shape[1]) / fh
    pos = ax.get_position()
    cx, cy = (pos.x0 + pos.x1) / 2, (pos.y0 + pos.y1) / 2
    axl = fig.add_axes([cx - ancho / 2, cy - alto / 2, ancho, alto], zorder=10)  # por encima de los datos
    axl.imshow(rgba)
    axl.axis("off")


if LOGO_PATH:
    agregar_marca_agua(fig, ax, LOGO_PATH, LOGO_ALPHA, LOGO_ANCHO)

fig.savefig(SALIDA, dpi=200, facecolor="black")
print(dif, n, pv.stack().idxmax(), pv.stack().max())
