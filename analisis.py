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


def cargar_caracterizacion(conn) -> pd.DataFrame:
    """Cortes agregados para los gráficos adicionales de Caracterización."""
    return db._consultar(
        conn,
        """
        WITH base AS (
          SELECT f.ano::integer AS anio,
                 LPAD(TRIM(f.cod_dpto::text), 2, '0') AS cod_departamento,
                 g.departamento,
                 LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0') AS cod_municipio,
                 g.municipio,
                 CASE f.mul_parto WHEN '1' THEN 'Simple' WHEN '2' THEN 'Doble' WHEN '3' THEN 'Trillizos' WHEN '4' THEN 'Cuatrillizos o más' ELSE 'Sin información' END AS multiplicidad,
                 CASE f.idhemoclas WHEN '1' THEN 'A' WHEN '2' THEN 'B' WHEN '3' THEN 'O' WHEN '4' THEN 'AB' ELSE 'Sin información' END AS grupo_sanguineo,
                 CASE f.idfactorrh WHEN '1' THEN 'Positivo' WHEN '2' THEN 'Negativo' ELSE 'Sin información' END AS factor_rh,
                 CASE WHEN f.n_emb ~ '^[0-9]+$' AND f.n_emb::integer BETWEEN 1 AND 98 THEN f.n_emb::integer END AS embarazos,
                 CASE WHEN f.n_hijosv ~ '^[0-9]+$' AND f.n_hijosv::integer BETWEEN 1 AND 98 THEN f.n_hijosv::integer END AS hijos_vivos,
                 CASE WHEN f.numconsul ~ '^[0-9]+$' AND f.numconsul::integer BETWEEN 0 AND 98 THEN f.numconsul::integer END AS consultas,
                 CASE f.edad_madre WHEN '1' THEN '10-14 años' WHEN '2' THEN '15-19 años' WHEN '3' THEN '20-24 años' WHEN '4' THEN '25-29 años' WHEN '5' THEN '30-34 años' WHEN '6' THEN '35-39 años' WHEN '7' THEN '40-44 años' WHEN '8' THEN '45-49 años' WHEN '9' THEN '50-54 años' END AS edad_madre,
                 CASE WHEN f.n_emb ~ '^[0-9]+$' AND f.n_emb::integer BETWEEN 1 AND 98 THEN CASE WHEN f.n_emb::integer >= 5 THEN '5 o más' ELSE f.n_emb::integer::text END END AS grupo_embarazos,
                 CASE WHEN f.n_hijosv ~ '^[0-9]+$' AND f.n_hijosv::integer BETWEEN 1 AND 98 THEN CASE WHEN f.n_hijosv::integer >= 5 THEN '5 o más' ELSE f.n_hijosv::integer::text END END AS grupo_hijos,
                 CASE WHEN f.numconsul ~ '^[0-9]+$' AND f.numconsul::integer BETWEEN 0 AND 98 THEN CASE WHEN f.numconsul::integer = 0 THEN '0' WHEN f.numconsul::integer <= 3 THEN '1-3' WHEN f.numconsul::integer <= 6 THEN '4-6' WHEN f.numconsul::integer <= 9 THEN '7-9' ELSE '10 o más' END ELSE 'Sin información' END AS grupo_consultas
          FROM nacimientos.fact_nacimientos f
          JOIN geografia.dim_geografia g
            ON TRIM(g.cod_departamento::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0')
           AND TRIM(g.cod_municipio::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0')
        )
        SELECT anio, cod_departamento, departamento, cod_municipio, municipio,
               'multiplicidad'::text AS dimension, multiplicidad AS categoria, ''::text AS subcategoria, COUNT(*)::bigint AS nacimientos
        FROM base GROUP BY 1,2,3,4,5,6,7,8
        UNION ALL
        SELECT anio, cod_departamento, departamento, cod_municipio, municipio,
               'hemoclasificacion', grupo_sanguineo, factor_rh, COUNT(*)::bigint
        FROM base GROUP BY 1,2,3,4,5,6,7,8
        UNION ALL
        SELECT anio, cod_departamento, departamento, cod_municipio, municipio,
               'historia_reproductiva', grupo_embarazos, grupo_hijos, COUNT(*)::bigint
        FROM base WHERE grupo_embarazos IS NOT NULL AND grupo_hijos IS NOT NULL GROUP BY 1,2,3,4,5,6,7,8
        UNION ALL
        SELECT anio, cod_departamento, departamento, cod_municipio, municipio,
               'controles_prenatales', edad_madre, grupo_consultas, COUNT(*)::bigint
        FROM base WHERE edad_madre IS NOT NULL GROUP BY 1,2,3,4,5,6,7,8
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
        nac_padres = db._consultar(
            conn,
            """
            WITH base AS (
                SELECT f.ano::integer AS anio,
                       LPAD(TRIM(f.cod_dpto::text), 2, '0') AS cod_departamento,
                       g.departamento,
                       LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0') AS cod_municipio,
                       g.municipio,
                       CASE
                           WHEN f.edad_padre = '999' THEN 'Sin información'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 10 AND 14 THEN '10-14 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 15 AND 19 THEN '15-19 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 20 AND 24 THEN '20-24 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 25 AND 29 THEN '25-29 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 30 AND 34 THEN '30-34 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 35 AND 39 THEN '35-39 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 40 AND 44 THEN '40-44 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 45 AND 49 THEN '45-49 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer BETWEEN 50 AND 54 THEN '50-54 años'
                           WHEN f.edad_padre ~ '^[0-9]+$' AND f.edad_padre::integer >= 55 THEN '55+ años'
                           ELSE 'No clasificado'
                       END AS edad_padre_grupo,
                       CASE f.edad_madre
                           WHEN '1' THEN '10-14 años' WHEN '2' THEN '15-19 años'
                           WHEN '3' THEN '20-24 años' WHEN '4' THEN '25-29 años'
                           WHEN '5' THEN '30-34 años' WHEN '6' THEN '35-39 años'
                           WHEN '7' THEN '40-44 años' WHEN '8' THEN '45-49 años'
                           WHEN '9' THEN '50-54 años' WHEN '99' THEN 'Sin información'
                           ELSE 'No clasificado'
                       END AS edad_madre_grupo
                FROM nacimientos.fact_nacimientos f
                LEFT JOIN geografia.dim_geografia g
                  ON TRIM(g.cod_departamento::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0')
                 AND TRIM(g.cod_municipio::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0')
            )
            SELECT anio, cod_departamento, departamento, cod_municipio, municipio,
                   edad_padre_grupo, edad_madre_grupo, COUNT(*)::bigint AS nacimientos
            FROM base
            WHERE edad_padre_grupo <> 'Sin información'
              AND edad_madre_grupo <> 'Sin información'
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            """,
            (),
        )
        estado_conyugal = db._consultar(
            conn,
            """
            SELECT f.ano::integer AS anio,
                   LPAD(TRIM(f.cod_dpto::text), 2, '0') AS cod_departamento,
                   g.departamento,
                   LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0') AS cod_municipio,
                   g.municipio,
                   CASE f.est_civm
                     WHEN '5' THEN 'Pareja: 2 años o más'
                     WHEN '6' THEN 'Pareja: menos de 2 años'
                     WHEN '4' THEN 'Separada o divorciada'
                     WHEN '3' THEN 'Viuda'
                     WHEN '1' THEN 'Soltera'
                     WHEN '2' THEN 'Casada'
                     ELSE 'Sin información'
                   END AS estado_civil,
                   CASE f.est_civm WHEN '5' THEN 1 WHEN '6' THEN 2 WHEN '4' THEN 3
                     WHEN '3' THEN 4 WHEN '1' THEN 5 WHEN '2' THEN 6 ELSE 9 END AS orden_estado_civil,
                   COUNT(*)::bigint AS nacimientos
            FROM nacimientos.fact_nacimientos f
            JOIN geografia.dim_geografia g
              ON TRIM(g.cod_departamento::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0')
             AND TRIM(g.cod_municipio::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0')
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            """,
            (),
        )
        estado_civil = db._consultar(
            conn,
            """
            SELECT f.ano::integer AS anio,
                   LPAD(TRIM(f.cod_dpto::text), 2, '0') AS cod_departamento,
                   g.departamento,
                   LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0') AS cod_municipio,
                   g.municipio,
                   CASE f.est_civm WHEN '5' THEN 'Unión libre' WHEN '6' THEN 'Unión libre'
                     WHEN '4' THEN 'Separada o divorciada' WHEN '3' THEN 'Viuda'
                     WHEN '1' THEN 'Soltera' WHEN '2' THEN 'Casada' ELSE 'Sin información' END AS estado_civil,
                   CASE f.est_civm WHEN '5' THEN 1 WHEN '6' THEN 1 WHEN '2' THEN 2
                     WHEN '1' THEN 3 WHEN '4' THEN 4 WHEN '3' THEN 5 ELSE 9 END AS orden_estado_civil,
                   COUNT(*)::bigint AS nacimientos
            FROM nacimientos.fact_nacimientos f
            JOIN geografia.dim_geografia g
              ON TRIM(g.cod_departamento::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0')
             AND TRIM(g.cod_municipio::text) = LPAD(TRIM(f.cod_dpto::text), 2, '0') || LPAD(TRIM(f.cod_munic::text), 3, '0')
            GROUP BY 1, 2, 3, 4, 5, 6, 7
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
        caracterizacion = cargar_caracterizacion(conn)
    finally:
        conn.close()

    geo = (
        "cod_departamento",
        "departamento",
        "cod_municipio",
        "municipio",
    )
    for frame in (poblacion, poblacion_area, nac_edad, nac_padres, estado_conyugal, estado_civil, nac_perfil, def_edad, externas, intervalos, caracterizacion):
        db._enteros(frame, ("anio",))
        _texto(frame, geo)

    db._enteros(poblacion, ("poblacion",))
    db._enteros(poblacion_area, ("poblacion",))
    db._enteros(nac_edad, ("nacimientos",))
    db._enteros(nac_padres, ("nacimientos",))
    db._enteros(estado_conyugal, ("nacimientos", "orden_estado_civil"))
    db._enteros(estado_civil, ("nacimientos", "orden_estado_civil"))
    db._enteros(nac_perfil, ("nacimientos",))
    db._enteros(def_edad, ("defunciones",))
    db._enteros(externas, ("defunciones",))
    db._enteros(caracterizacion, ("anio", "nacimientos"))
    _texto(poblacion, ("sexo", "grupo_edad"))
    _texto(poblacion_area, ("area",))
    _texto(nac_edad, ("grupo_edad_madre",))
    _texto(nac_padres, ("edad_padre_grupo", "edad_madre_grupo"))
    _texto(estado_conyugal, ("estado_civil",))
    _texto(estado_civil, ("estado_civil",))
    _texto(nac_perfil, ("dimension", "categoria"))
    _texto(caracterizacion, ("dimension", "categoria", "subcategoria"))
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
        "nac_padres": nac_padres,
        "estado_conyugal": estado_conyugal,
        "estado_civil": estado_civil,
        "nac_perfil": nac_perfil,
        "def_edad": def_edad,
        "externas": externas,
        "intervalos": intervalos,
        "caracterizacion": caracterizacion,
    }
    return _ANALISIS


def cargar_flujos_nacimientos() -> pd.DataFrame:
    """Agrega los flujos residencia-ocurrencia desde los registros de nacimientos."""
    conn = db.conectar()
    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '90s'")
        return db._consultar(
            conn,
            """
            WITH base AS (
                SELECT ano::integer AS anio,
                       LPAD(TRIM(cod_dpto::text), 2, '0') AS cod_ocurrencia,
                       LPAD(TRIM(codptore::text), 2, '0') AS cod_residencia
                FROM nacimientos.fact_nacimientos
                WHERE cod_dpto IS NOT NULL AND codptore IS NOT NULL
            ), ocurrencia AS (
                SELECT anio, cod_ocurrencia,
                       COUNT(*)::bigint AS nacimientos_ocurrencia
                FROM base GROUP BY anio, cod_ocurrencia
            ), residencia AS (
                SELECT anio, cod_residencia,
                       COUNT(*)::bigint AS nacimientos_residencia,
                       COUNT(*) FILTER (WHERE cod_ocurrencia <> cod_residencia)::bigint AS nacimientos_fuera_residencia
                FROM base GROUP BY anio, cod_residencia
            ), pares AS (
                SELECT anio, cod_ocurrencia, cod_residencia,
                       COUNT(*)::bigint AS nacimientos
                FROM base GROUP BY anio, cod_ocurrencia, cod_residencia
            ), geo AS (
                SELECT LPAD(TRIM(cod_departamento::text), 2, '0') AS codigo,
                       MAX(departamento) AS departamento
                FROM geografia.dim_geografia
                WHERE cod_departamento IS NOT NULL
                GROUP BY 1
            )
            SELECT p.anio, p.cod_ocurrencia,
                   g_ocu.departamento AS departamento_ocurrencia,
                   p.cod_residencia,
                   g_res.departamento AS departamento_residencia,
                   p.nacimientos,
                   o.nacimientos_ocurrencia,
                   r.nacimientos_residencia,
                   r.nacimientos_fuera_residencia
            FROM pares p
            LEFT JOIN ocurrencia o USING (anio, cod_ocurrencia)
            LEFT JOIN residencia r USING (anio, cod_residencia)
            LEFT JOIN geo g_ocu ON g_ocu.codigo = p.cod_ocurrencia
            LEFT JOIN geo g_res ON g_res.codigo = p.cod_residencia
            """,
            (),
        )
    finally:
        conn.close()
