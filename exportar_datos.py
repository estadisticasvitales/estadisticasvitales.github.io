"""Exporta los cortes que va a filtrar el prototipo estático.

No parte de CSV. Lee los hechos ya agregados en PostgreSQL y escribe Parquet.
"""

from pathlib import Path

import pandas as pd

import analisis
import db

SALIDA = Path(__file__).resolve().parent / "datos"
LLAVES = [
    "anio",
    "cod_departamento",
    "departamento",
    "cod_municipio",
    "municipio",
    "sexo",
]


def panorama(nacimientos: pd.DataFrame, defunciones: pd.DataFrame) -> pd.DataFrame:
    tabla = nacimientos.merge(defunciones, on=LLAVES, how="outer")
    tabla["nacimientos"] = tabla["nacimientos"].fillna(0).astype("int64")
    tabla["defunciones"] = tabla["defunciones"].fillna(0).astype("int64")
    tabla["anio"] = tabla["anio"].astype("int16")
    return tabla.sort_values(LLAVES).reset_index(drop=True)


def geografia(municipios: pd.DataFrame, coords: pd.DataFrame) -> pd.DataFrame:
    columnas = ["cod_departamento", "departamento", "cod_municipio", "municipio"]
    tabla = municipios[columnas].drop_duplicates().merge(
        coords, on=["cod_departamento", "cod_municipio"], how="left"
    )
    return tabla.sort_values(["cod_departamento", "cod_municipio"]).reset_index(drop=True)


def recorte(tabla: pd.DataFrame, enteros: tuple[str, ...] = ()) -> pd.DataFrame:
    salida = tabla.copy()
    if "anio" in salida.columns:
        salida["anio"] = salida["anio"].astype("int16")
    for columna in enteros:
        salida[columna] = salida[columna].astype("int64")
    return salida.reset_index(drop=True)


def causas(tabla: pd.DataFrame) -> pd.DataFrame:
    columnas = [
        *LLAVES[:5],
        "cod_causa",
        "causa",
        "grupo_edad",
        "sexo",
        "defunciones",
    ]
    salida = tabla[columnas].copy()
    salida["anio"] = salida["anio"].astype("int16")
    salida["defunciones"] = salida["defunciones"].astype("int64")
    return salida.sort_values(
        ["anio", "cod_departamento", "cod_municipio", "cod_causa", "grupo_edad", "sexo"]
    ).reset_index(drop=True)


def escribir(tabla: pd.DataFrame, nombre: str) -> Path:
    destino = SALIDA / nombre
    tabla.to_parquet(destino, engine="pyarrow", compression="snappy", index=False)
    return destino


def main() -> None:
    SALIDA.mkdir(exist_ok=True)
    tablero = db.cargar_tablero()
    extra = analisis.cargar_analisis()
    flujos = analisis.cargar_flujos_nacimientos()
    archivos = {
        "panorama.parquet": panorama(tablero["nacimientos"], tablero["defunciones"]),
        "causas.parquet": causas(tablero["causas"]),
        "geografia.parquet": geografia(tablero["municipios"], tablero["coords"]),
        "poblacion.parquet": recorte(extra["poblacion"], ("poblacion",)),
        "poblacion_area.parquet": recorte(extra["poblacion_area"], ("poblacion",)),
        "nac_edad.parquet": recorte(extra["nac_edad"], ("nacimientos",)),
        "nac_padres.parquet": recorte(extra["nac_padres"], ("nacimientos",)),
        "caracterizacion.parquet": recorte(extra["caracterizacion"], ("nacimientos",)),
        "estado_conyugal.parquet": recorte(
            extra["estado_conyugal"], ("nacimientos", "orden_estado_civil")
        ),
        "estado_civil.parquet": recorte(
            extra["estado_civil"], ("nacimientos", "orden_estado_civil")
        ),
        "nac_perfil.parquet": recorte(extra["nac_perfil"], ("nacimientos",)),
        "def_edad.parquet": recorte(extra["def_edad"], ("defunciones",)),
        "externas.parquet": recorte(extra["externas"], ("defunciones",)),
        "intervalos.parquet": recorte(
            extra["intervalos"],
            (
                "mes_bin",
                "registros",
                "n_bajo_peso_evaluable",
                "n_bajo_peso",
                "n_prematuro_evaluable",
                "n_prematuro",
                "n_apgar_bajo_evaluable",
                "n_apgar_bajo",
                "n_adverso_evaluable",
                "n_adverso",
            ),
        ),
        "flujos_nacimientos.parquet": recorte(flujos, ("nacimientos",)),
    }
    for nombre, tabla in archivos.items():
        ruta = escribir(tabla, nombre)
        print(f"{nombre}: {len(tabla):,} filas, {ruta.stat().st_size / 1_048_576:.1f} MB")


if __name__ == "__main__":
    main()
