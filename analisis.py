"""Cortes agregados de población, fecundidad, mortalidad y natalidad."""

from __future__ import annotations

import re
import unicodedata

import pandas as pd

import db

GRUPO_EDAD_POB = """
CASE
  WHEN f.edad = 0 THEN 'Menor 1 año'
  WHEN f.edad BETWEEN 1 AND 4 THEN 'De 1-4 años'
  WHEN f.edad BETWEEN 5 AND 9 THEN 'De 5-9 años'
  WHEN f.edad BETWEEN 10 AND 14 THEN 'De 10-14 años'
  WHEN f.edad BETWEEN 15 AND 19 THEN 'De 15-19 años'
  WHEN f.edad BETWEEN 20 AND 24 THEN 'De 20-24 años'
  WHEN f.edad BETWEEN 25 AND 29 THEN 'De 25-29 años'
  WHEN f.edad BETWEEN 30 AND 34 THEN 'De 30-34 años'
  WHEN f.edad BETWEEN 35 AND 39 THEN 'De 35-39 años'
  WHEN f.edad BETWEEN 40 AND 44 THEN 'De 40-44 años'
  WHEN f.edad BETWEEN 45 AND 49 THEN 'De 45-49 años'
  WHEN f.edad BETWEEN 50 AND 54 THEN 'De 50-54 años'
  WHEN f.edad BETWEEN 55 AND 59 THEN 'De 55-59 años'
  WHEN f.edad BETWEEN 60 AND 64 THEN 'De 60-64 años'
  WHEN f.edad BETWEEN 65 AND 69 THEN 'De 65-69 años'
  WHEN f.edad BETWEEN 70 AND 74 THEN 'De 70-74 años'
  WHEN f.edad BETWEEN 75 AND 79 THEN 'De 75-79 años'
  WHEN f.edad BETWEEN 80 AND 84 THEN 'De 80-84 años'
  WHEN f.edad BETWEEN 85 AND 89 THEN 'De 85-89 años'
  WHEN f.edad BETWEEN 90 AND 94 THEN 'De 90-94 años'
  WHEN f.edad BETWEEN 95 AND 99 THEN 'De 95-99 años'
  ELSE 'De 100 y más'
END
"""

def _sin_tilde(texto: str) -> str:
    base = unicodedata.normalize("NFKD", str(texto))
    return "".join(ch for ch in base if not unicodedata.combining(ch)).lower()


def grupo_defuncion(texto: str) -> str:
    clave = _sin_tilde(texto)
    if "desconoc" in clave:
        return "Edad desconocida"
    if "100" in clave:
        return "De 100 y más"
    if "hora" in clave or "dia" in clave or "mes" in clave:
        return "Menor 1 año"
    if clave.startswith("de 1 ano"):
        return "De 1-4 años"
    rango = re.search(r"de (\d+) a (\d+)", clave)
    if rango:
        inicio, fin = int(rango.group(1)), int(rango.group(2))
        if inicio == 2 and fin == 4:
            return "De 1-4 años"
        return f"De {inicio}-{fin} años"
    return "Edad desconocida"

GRUPO_MADRE = """
CASE
  WHEN f.grupo_edad_madre ILIKE '%%10-14%%' THEN '10-14'
  WHEN f.grupo_edad_madre ILIKE '%%15-19%%' THEN '15-19'
  WHEN f.grupo_edad_madre ILIKE '%%20-24%%' THEN '20-24'
  WHEN f.grupo_edad_madre ILIKE '%%25-29%%' THEN '25-29'
  WHEN f.grupo_edad_madre ILIKE '%%30-34%%' THEN '30-34'
  WHEN f.grupo_edad_madre ILIKE '%%35-39%%' THEN '35-39'
  WHEN f.grupo_edad_madre ILIKE '%%40-44%%' THEN '40-44'
  WHEN f.grupo_edad_madre ILIKE '%%45-49%%' THEN '45-49'
  WHEN f.grupo_edad_madre ILIKE '%%50-54%%' THEN '50-54'
  ELSE 'Sin información'
END
"""

AREA_NAC = """
CASE
  WHEN f.area ILIKE 'Cabecera%%' THEN 'Cabecera'
  WHEN f.area ILIKE 'Rural%%' OR f.area ILIKE 'Centro poblado%%' THEN 'Resto'
  ELSE 'Sin información'
END
"""

AREA_POB = """
CASE WHEN f.area ILIKE 'Cabecera%%' THEN 'Cabecera' ELSE 'Resto' END
"""

EDUCACION = """
CASE
  WHEN f.nivel_educativo ILIKE '%%Ninguno%%' THEN 'Ninguno'
  WHEN f.nivel_educativo ILIKE '%%Preescolar%%' THEN 'Preescolar'
  WHEN f.nivel_educativo ILIKE '%%primaria%%' THEN 'Básica primaria'
  WHEN f.nivel_educativo ILIKE '%%secundaria%%' THEN 'Básica secundaria'
  WHEN f.nivel_educativo ILIKE '%%Media%%' OR f.nivel_educativo ILIKE '%%Normalista%%' THEN 'Media'
  WHEN f.nivel_educativo ILIKE '%%T_cnica profesional%%' OR f.nivel_educativo ILIKE '%%Tecnol%%' THEN 'Técnica o tecnológica'
  WHEN f.nivel_educativo ILIKE '%%Profesional%%' THEN 'Profesional'
  WHEN f.nivel_educativo ILIKE '%%Especializa%%'
    OR f.nivel_educativo ILIKE '%%Maestr%%'
    OR f.nivel_educativo ILIKE '%%Doctorado%%' THEN 'Posgrado'
  ELSE 'Sin información'
END
"""

CAUSA_EXTERNA = """
CASE f.cod_causa
  WHEN '512' THEN 'Homicidios'
  WHEN '511' THEN 'Suicidios'
  WHEN '501' THEN 'Accidentes de tránsito'
  WHEN '513' THEN 'Otras externas'
  WHEN '514' THEN 'Otras externas'
  ELSE 'Otros accidentes'
END
"""

_ANALISIS: dict | None = None


def _texto(df: pd.DataFrame, columnas: tuple[str, ...]) -> pd.DataFrame:
    for columna in columnas:
        if columna in df.columns:
            df[columna] = df[columna].fillna("").astype(str).str.strip()
    return df


def cargar_intervalos(conn) -> pd.DataFrame:
    """Agrega intervalos, ocurrencia y resultados neonatales por celdas publicables."""
    return db._consultar(
        conn,
        """
        SELECT anio,
               cod_dpto AS cod_departamento,
               departamento_ocurrencia AS departamento,
               edad_madre_cat,
               niv_edum_cat,
               seg_social_cat,
               tipo_parto_cat,
               categoria_intervalo,
               FLOOR(meses)::int AS mes_bin,
               COUNT(*)::bigint AS registros,
               SUM(meses)::double precision AS suma_meses,
               COUNT(*) FILTER (WHERE flag_bajo_peso IS NOT NULL)::bigint AS n_bajo_peso_evaluable,
               COUNT(*) FILTER (WHERE flag_bajo_peso IS TRUE)::bigint AS n_bajo_peso,
               COUNT(*) FILTER (WHERE flag_prematuro IS NOT NULL)::bigint AS n_prematuro_evaluable,
               COUNT(*) FILTER (WHERE flag_prematuro IS TRUE)::bigint AS n_prematuro,
               COUNT(*) FILTER (WHERE flag_apgar_bajo IS NOT NULL)::bigint AS n_apgar_bajo_evaluable,
               COUNT(*) FILTER (WHERE flag_apgar_bajo IS TRUE)::bigint AS n_apgar_bajo,
               COUNT(*) FILTER (WHERE flag_adverso_compuesto IS NOT NULL)::bigint AS n_adverso_evaluable,
               COUNT(*) FILTER (WHERE flag_adverso_compuesto IS TRUE)::bigint AS n_adverso
        FROM nacimientos.mv_intervalos
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
        """,
        (),
    )


def cargar_analisis() -> dict:
    global _ANALISIS
    if _ANALISIS is not None:
        return _ANALISIS

    conn = db.conectar()
    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '180s'")
        poblacion = db._consultar(
            conn,
            f"""
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   f.sexo,
                   {GRUPO_EDAD_POB} AS grupo_edad,
                   SUM(f.poblacion)::bigint AS poblacion
            FROM proyecciones.fact_pob_area_sexo_edad f
            JOIN geografia.vw_dim_geografia g
              ON g.cod_departamento = f.cod_departamento
             AND g.cod_municipio = f.cod_municipio
            WHERE f.anio BETWEEN 2019 AND 2025
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            """,
            (),
        )
        poblacion_area = db._consultar(
            conn,
            f"""
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   {AREA_POB} AS area,
                   SUM(f.poblacion)::bigint AS poblacion
            FROM proyecciones.fact_pob_area_sexo_edad f
            JOIN geografia.vw_dim_geografia g
              ON g.cod_departamento = f.cod_departamento
             AND g.cod_municipio = f.cod_municipio
            WHERE f.anio BETWEEN 2019 AND 2025
            GROUP BY 1, 2, 3, 4, 5, 6
            """,
            (),
        )
        nac_edad = db._consultar(
            conn,
            f"""
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   {GRUPO_MADRE} AS grupo_edad_madre,
                   SUM(f.nacimientos)::bigint AS nacimientos
            FROM nacimientos.fact_nac_edad_madre f
            {db.CRUCE_GEOGRAFIA}
            GROUP BY 1, 2, 3, 4, 5, 6
            """,
            (),
        )
        nac_perfil = db._consultar(
            conn,
            f"""
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   'area' AS dimension,
                   {AREA_NAC} AS categoria,
                   SUM(f.nacimientos)::bigint AS nacimientos
            FROM nacimientos.fact_nac_residencia f
            {db.CRUCE_GEOGRAFIA}
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            UNION ALL
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   'educacion' AS dimension,
                   {EDUCACION} AS categoria,
                   SUM(f.nacimientos)::bigint AS nacimientos
            FROM nacimientos.fact_nac_educacion f
            {db.CRUCE_GEOGRAFIA}
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            UNION ALL
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   'regimen' AS dimension,
                   COALESCE(NULLIF(f.regimen, ''), 'Sin información') AS categoria,
                   SUM(f.nacimientos)::bigint AS nacimientos
            FROM nacimientos.fact_nac_regimen_sitio f
            {db.CRUCE_GEOGRAFIA}
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            """,
            (),
        )
        def_edad = db._consultar(
            conn,
            f"""
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   f.grupo_edad,
                   COALESCE(NULLIF(f.sexo, ''), 'Indeterminado') AS sexo,
                   SUM(f.defunciones)::bigint AS defunciones
            FROM defunciones.fact_def_edad_residencia f
            {db.CRUCE_GEOGRAFIA}
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            """,
            (),
        )
        externas = db._consultar(
            conn,
            f"""
            SELECT f.anio,
                   g.cod_departamento,
                   g.departamento,
                   g.cod_municipio,
                   g.municipio,
                   {CAUSA_EXTERNA} AS causa,
                   SUM(f.defunciones)::bigint AS defunciones
            FROM defunciones.fact_def_externa f
            {db.CRUCE_GEOGRAFIA}
            GROUP BY 1, 2, 3, 4, 5, 6
            """,
            (),
        )
        intervalos = cargar_intervalos(conn)
    finally:
        conn.close()

    geo = (
        "cod_departamento",
        "departamento",
        "cod_municipio",
        "municipio",
    )
    for frame in (poblacion, poblacion_area, nac_edad, nac_perfil, def_edad, externas, intervalos):
        db._enteros(frame, ("anio",))
        _texto(frame, geo)

    db._enteros(poblacion, ("poblacion",))
    db._enteros(poblacion_area, ("poblacion",))
    db._enteros(nac_edad, ("nacimientos",))
    db._enteros(nac_perfil, ("nacimientos",))
    db._enteros(def_edad, ("defunciones",))
    db._enteros(externas, ("defunciones",))
    _texto(poblacion, ("sexo", "grupo_edad"))
    _texto(poblacion_area, ("area",))
    _texto(nac_edad, ("grupo_edad_madre",))
    _texto(nac_perfil, ("dimension", "categoria"))
    def_edad["grupo_edad"] = def_edad["grupo_edad"].map(grupo_defuncion)
    def_edad = (
        def_edad.groupby(
            ["anio", "cod_departamento", "departamento", "cod_municipio", "municipio", "grupo_edad", "sexo"],
            as_index=False,
        )["defunciones"]
        .sum()
    )
    _texto(def_edad, ("grupo_edad", "sexo"))
    _texto(externas, ("causa",))
    _texto(
        intervalos,
        (
            "departamento",
            "edad_madre_cat",
            "niv_edum_cat",
            "seg_social_cat",
            "tipo_parto_cat",
            "categoria_intervalo",
        ),
    )
    db._enteros(
        intervalos,
        (
            "anio",
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
    )
    intervalos["suma_meses"] = pd.to_numeric(intervalos["suma_meses"], errors="coerce").fillna(0)

    _ANALISIS = {
        "poblacion": poblacion,
        "poblacion_area": poblacion_area,
        "nac_edad": nac_edad,
        "nac_perfil": nac_perfil,
        "def_edad": def_edad,
        "externas": externas,
        "intervalos": intervalos,
    }
    return _ANALISIS


def cargar_flujos_nacimientos() -> pd.DataFrame:
    """Lee los flujos residencia-ocurrencia agregados de la vista materializada."""
    conn = db.conectar()
    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '90s'")
        return db._consultar(
            conn,
            """
            WITH ocurrencia AS (
                SELECT ano AS anio, cod_dpto AS codigo,
                       COUNT(*)::bigint AS nacimientos_ocurrencia
                FROM nacimientos.fact_nac_2025
                WHERE ano = 2025 AND cod_dpto IS NOT NULL
                GROUP BY ano, cod_dpto
            ),
            residencia AS (
                SELECT ano AS anio, codptore AS codigo,
                       COUNT(*)::bigint AS nacimientos_residencia,
                       COUNT(*) FILTER (WHERE cod_dpto <> codptore)::bigint AS nacimientos_fuera_residencia
                FROM nacimientos.fact_nac_2025
                WHERE ano = 2025 AND codptore IS NOT NULL
                GROUP BY ano, codptore
            )
            SELECT b.anio,
                   b.cod_ocurrencia,
                   MAX(g_ocu.departamento) AS departamento_ocurrencia,
                   b.cod_residencia,
                   MAX(g_res.departamento) AS departamento_residencia,
                   SUM(b.nacimientos)::bigint AS nacimientos,
                   MAX(o.nacimientos_ocurrencia)::bigint AS nacimientos_ocurrencia,
                   MAX(r.nacimientos_residencia)::bigint AS nacimientos_residencia,
                   MAX(r.nacimientos_fuera_residencia)::bigint AS nacimientos_fuera_residencia
            FROM nacimientos.mv_flujos_nacimientos b
            LEFT JOIN ocurrencia o
              ON o.anio = b.anio AND o.codigo = b.cod_ocurrencia
            LEFT JOIN residencia r
              ON r.anio = b.anio AND r.codigo = b.cod_residencia
            LEFT JOIN (
                SELECT cod_departamento, MAX(departamento) AS departamento
                FROM geografia.dim_geografia
                WHERE cod_departamento IS NOT NULL
                GROUP BY cod_departamento
            ) g_ocu ON g_ocu.cod_departamento = b.cod_ocurrencia
            LEFT JOIN (
                SELECT cod_departamento, MAX(departamento) AS departamento
                FROM geografia.dim_geografia
                WHERE cod_departamento IS NOT NULL
                GROUP BY cod_departamento
            ) g_res ON g_res.cod_departamento = b.cod_residencia
            WHERE b.anio = 2025
            GROUP BY b.anio, b.cod_ocurrencia, b.cod_residencia
            """,
            (),
        )
    finally:
        conn.close()
