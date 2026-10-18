export function literal(valor) {
  return `'${String(valor).replaceAll("'", "''")}'`;
}

export function whereTerritorio(filtros, { anio = true, tabla = "" } = {}) {
  const columna = (nombre) => (tabla ? `${tabla}.${nombre}` : nombre);
  const partes = [];
  if (anio && filtros.anio && filtros.anio !== "Todos") {
    partes.push(`${columna("anio")} = ${Number(filtros.anio)}`);
  }
  if (filtros.departamento && filtros.departamento !== "Todos") {
    partes.push(`${columna("departamento")} = ${literal(filtros.departamento)}`);
  }
  if (filtros.municipio && filtros.municipio !== "Todos") {
    const [codDepartamento, codMunicipio] = filtros.municipio.split("|");
    partes.push(`${columna("cod_departamento")} = ${literal(codDepartamento)}`);
    partes.push(`${columna("cod_municipio")} = ${literal(codMunicipio)}`);
  }
  return partes.length ? partes.join(" AND ") : "TRUE";
}

const EDAD_MADRE_GRUPO_SQL = `CASE
  WHEN edad_madre_cat IN ('10-14 años', '15-19 años') THEN '10-19 años'
  WHEN edad_madre_cat IN ('20-24 años', '25-29 años') THEN '20-29 años'
  WHEN edad_madre_cat IN ('30-34 años', '35-39 años') THEN '30-39 años'
  WHEN edad_madre_cat IN ('40-44 años', '45-49 años') THEN '40-49 años'
  WHEN edad_madre_cat = '50-54 años' THEN '50-59 años'
  ELSE edad_madre_cat
END`;

const NIVEL_EDUCATIVO_GRUPO_SQL = `CASE
  WHEN niv_edum_cat IN ('Especialización', 'Maestría', 'Doctorado') THEN 'Posgrado'
  WHEN niv_edum_cat IN ('Normalista', 'Técnica profesional', 'Tecnológica') THEN 'Técnica/Tecnológica'
  ELSE niv_edum_cat
END`;

const FILTROS_INTERVALOS = {
  edadMadre: { columna: EDAD_MADRE_GRUPO_SQL },
  nivelEducativo: { columna: NIVEL_EDUCATIVO_GRUPO_SQL },
  regimen: "seg_social_cat",
  tipoParto: "tipo_parto_cat",
};

export function whereIntervalos(filtros) {
  const partes = [];
  if (filtros.anio && filtros.anio !== "Todos") partes.push(`anio = ${Number(filtros.anio)}`);
  if (filtros.departamento && filtros.departamento !== "Todos") {
    partes.push(`departamento = ${literal(filtros.departamento)}`);
  }
  for (const [filtro, definicion] of Object.entries(FILTROS_INTERVALOS)) {
    if (filtros[filtro] && filtros[filtro] !== "Todos") {
      const columna = typeof definicion === "string" ? definicion : definicion.columna;
      partes.push(`${columna} = ${literal(filtros[filtro])}`);
    }
  }
  return partes.length ? partes.join(" AND ") : "TRUE";
}

export function sqlIntervalosDistribucion(filtros) {
  return `
    SELECT FLOOR(mes_bin / 6) * 6 AS mes_inicio,
           SUM(registros)::DOUBLE AS registros
    FROM intervalos
    WHERE ${whereIntervalos(filtros)}
    GROUP BY 1
    ORDER BY 1
  `;
}

export function sqlIntervalosResumen(filtros) {
  return `
    SELECT mes_bin,
           SUM(registros)::DOUBLE AS registros,
           SUM(suma_meses)::DOUBLE AS suma_meses,
           SUM(n_bajo_peso_evaluable)::DOUBLE AS n_bajo_peso_evaluable,
           SUM(n_bajo_peso)::DOUBLE AS n_bajo_peso,
           SUM(n_prematuro_evaluable)::DOUBLE AS n_prematuro_evaluable,
           SUM(n_prematuro)::DOUBLE AS n_prematuro,
           SUM(n_apgar_bajo_evaluable)::DOUBLE AS n_apgar_bajo_evaluable,
           SUM(n_apgar_bajo)::DOUBLE AS n_apgar_bajo,
           SUM(n_adverso_evaluable)::DOUBLE AS n_adverso_evaluable,
           SUM(n_adverso)::DOUBLE AS n_adverso
    FROM intervalos
    WHERE ${whereIntervalos(filtros)}
    GROUP BY 1
    ORDER BY 1
  `;
}

export function sqlIntervalosCategorias(filtros) {
  return `
    SELECT categoria_intervalo,
           SUM(registros)::DOUBLE AS registros
    FROM intervalos
    WHERE ${whereIntervalos(filtros)}
    GROUP BY 1
    ORDER BY categoria_intervalo
  `;
}

export function sqlRiesgoRelativoIntervalos(filtros) {
  return `
    SELECT categoria_intervalo,
           SUM(n_bajo_peso_evaluable)::DOUBLE AS n_bajo_peso_evaluable,
           SUM(n_bajo_peso)::DOUBLE AS n_bajo_peso,
           SUM(n_prematuro_evaluable)::DOUBLE AS n_prematuro_evaluable,
           SUM(n_prematuro)::DOUBLE AS n_prematuro,
           SUM(n_apgar_bajo_evaluable)::DOUBLE AS n_apgar_bajo_evaluable,
           SUM(n_apgar_bajo)::DOUBLE AS n_apgar_bajo,
           SUM(n_adverso_evaluable)::DOUBLE AS n_adverso_evaluable,
           SUM(n_adverso)::DOUBLE AS n_adverso
    FROM intervalos
    WHERE ${whereIntervalos(filtros)}
    GROUP BY 1
    ORDER BY categoria_intervalo
  `;
}

export function sqlHeatmapIntervalos(filtros) {
  return `
    SELECT ${EDAD_MADRE_GRUPO_SQL} AS edad_madre_grupo,
           ${NIVEL_EDUCATIVO_GRUPO_SQL} AS nivel_educativo_grupo,
           SUM(registros)::DOUBLE AS registros,
           SUM(CASE WHEN categoria_intervalo IN ('1. Corto (<18m)', '2. Subóptimo (18-23m)') THEN registros ELSE 0 END)::DOUBLE AS menores_24
    FROM intervalos
    WHERE ${whereIntervalos(filtros)}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
}

export function sqlResultadosIntervalos(filtros) {
  return `
    SELECT categoria_intervalo,
           SUM(n_bajo_peso_evaluable)::DOUBLE AS n_bajo_peso_evaluable,
           SUM(n_bajo_peso)::DOUBLE AS n_bajo_peso,
           SUM(n_prematuro_evaluable)::DOUBLE AS n_prematuro_evaluable,
           SUM(n_prematuro)::DOUBLE AS n_prematuro,
           SUM(n_apgar_bajo_evaluable)::DOUBLE AS n_apgar_bajo_evaluable,
           SUM(n_apgar_bajo)::DOUBLE AS n_apgar_bajo,
           SUM(n_adverso_evaluable)::DOUBLE AS n_adverso_evaluable,
           SUM(n_adverso)::DOUBLE AS n_adverso
    FROM intervalos
    WHERE ${whereIntervalos(filtros)}
    GROUP BY 1
    ORDER BY categoria_intervalo
  `;
}

export function sqlMapaIntervalos(filtros) {
  return `
    SELECT cod_departamento AS codigo,
           MAX(departamento) AS nombre,
           '' AS detalle,
           SUM(registros)::DOUBLE AS hechos,
           100 * SUM(CASE WHEN categoria_intervalo IN ('1. Corto (<18m)', '2. Subóptimo (18-23m)') THEN registros ELSE 0 END)
             / NULLIF(SUM(registros), 0) AS valor
    FROM intervalos
    WHERE ${whereIntervalos(filtros)}
    GROUP BY cod_departamento
  `;
}

export function whereCausas(filtros, opciones = {}) {
  const base = whereTerritorio(filtros, opciones);
  if (!filtros.causa || filtros.causa === "Todas") return base;
  return `${base} AND cod_causa = ${literal(filtros.causa)}`;
}

export const GRUPOS_MADRE = ["10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54"];
export const GRUPOS_TGF = ["15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49"];
export const CAUSAS_EXTERNAS = ["Homicidios", "Suicidios", "Accidentes de tránsito", "Otros accidentes", "Otras externas"];

const CODIGOS_EXTERNA = {
  Homicidios: ["512"],
  Suicidios: ["511"],
  "Accidentes de tránsito": ["501"],
  "Otras externas": ["513", "514"],
};

export function whereCausaExterna(filtros) {
  if (!filtros.externa || filtros.externa === "Todas") return "cod_causa LIKE '5%'";
  const codigos = CODIGOS_EXTERNA[filtros.externa];
  if (codigos) return `cod_causa IN (${codigos.map(literal).join(", ")})`;
  return "cod_causa LIKE '5%' AND cod_causa NOT IN ('501', '511', '512', '513', '514')";
}

export const MADRE_DESDE_POB = `
  CASE grupo_edad
    WHEN 'De 10-14 años' THEN '10-14'
    WHEN 'De 15-19 años' THEN '15-19'
    WHEN 'De 20-24 años' THEN '20-24'
    WHEN 'De 25-29 años' THEN '25-29'
    WHEN 'De 30-34 años' THEN '30-34'
    WHEN 'De 35-39 años' THEN '35-39'
    WHEN 'De 40-44 años' THEN '40-44'
    WHEN 'De 45-49 años' THEN '45-49'
    WHEN 'De 50-54 años' THEN '50-54'
  END
`;

export function nivelTerritorial(filtros, municipal = false) {
  if (filtros.municipio !== "Todos") return "municipio";
  if (filtros.departamento !== "Todos" || municipal) return "municipio";
  return "departamento";
}

export function anioComparacion(filtros, anios) {
  if (filtros.anio && filtros.anio !== "Todos") return Number(filtros.anio);
  return Number(anios[0]);
}

export function anioInicial(anios) {
  const numeros = (anios ?? []).map(Number).filter(Number.isFinite);
  return numeros.length ? Math.min(...numeros) : null;
}

export function sqlTasasVitales(filtros) {
  return `
    WITH hechos AS (
      SELECT anio, cod_departamento, cod_municipio,
             SUM(nacimientos)::DOUBLE AS nacimientos,
             SUM(defunciones)::DOUBLE AS defunciones
      FROM panorama
      WHERE ${whereTerritorio(filtros)}
      GROUP BY 1, 2, 3
    ),
    pob AS (
      SELECT anio, cod_departamento, cod_municipio, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${whereTerritorio(filtros)}
      GROUP BY 1, 2, 3
    )
    SELECT COALESCE(SUM(h.nacimientos), 0)::DOUBLE AS nacimientos,
           COALESCE(SUM(h.defunciones), 0)::DOUBLE AS defunciones,
           COALESCE(SUM(p.poblacion), 0)::DOUBLE AS poblacion
    FROM hechos h
    JOIN pob p USING (anio, cod_departamento, cod_municipio)
  `;
}

function sqlTasasPorAnio(donde) {
  return `
    SELECT h.anio,
           1000 * SUM(h.nacimientos) / NULLIF(SUM(p.poblacion), 0) AS natalidad,
           1000 * SUM(h.defunciones) / NULLIF(SUM(p.poblacion), 0) AS mortalidad
    FROM (
      SELECT anio, cod_departamento, cod_municipio,
             SUM(nacimientos)::DOUBLE AS nacimientos,
             SUM(defunciones)::DOUBLE AS defunciones
      FROM panorama
      WHERE ${donde}
      GROUP BY 1, 2, 3
    ) h
    JOIN (
      SELECT anio, cod_departamento, cod_municipio, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${donde}
      GROUP BY 1, 2, 3
    ) p USING (anio, cod_departamento, cod_municipio)
    GROUP BY 1
  `;
}

export function sqlSerieTasas(filtros) {
  const local = whereTerritorio(filtros, { anio: false });
  return `
    WITH nacional AS (${sqlTasasPorAnio("TRUE")}),
         local AS (${sqlTasasPorAnio(local)})
    SELECT n.anio,
           n.natalidad AS natalidad_nacional,
           n.mortalidad AS mortalidad_nacional,
           l.natalidad,
           l.mortalidad
    FROM nacional n
    LEFT JOIN local l USING (anio)
    ORDER BY n.anio
  `;
}

export function sqlMapaTasa(filtros, { tabla, numerador, escala = 1000, municipal = false, extra = "TRUE" } = {}) {
  const nivel = nivelTerritorial(filtros, municipal);
  const codigo = nivel === "departamento" ? "h.cod_departamento" : "h.cod_municipio";
  const nombre = nivel === "departamento" ? "MAX(g.departamento)" : "MAX(g.municipio)";
  const detalle = nivel === "departamento" ? "''" : "MAX(g.departamento)";
  return `
    WITH hechos AS (
      SELECT anio, cod_departamento, cod_municipio, SUM(${numerador})::DOUBLE AS hechos
      FROM ${tabla}
      WHERE ${whereTerritorio(filtros)} AND ${extra}
      GROUP BY 1, 2, 3
    ),
    pob AS (
      SELECT anio, cod_departamento, cod_municipio, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${whereTerritorio(filtros)}
      GROUP BY 1, 2, 3
    )
    SELECT ${codigo} AS codigo,
           ${nombre} AS nombre,
           ${detalle} AS detalle,
           SUM(h.hechos)::DOUBLE AS hechos,
           SUM(p.poblacion)::DOUBLE AS poblacion,
           ${escala} * SUM(h.hechos) / NULLIF(SUM(p.poblacion), 0) AS valor
    FROM hechos h
    JOIN pob p USING (anio, cod_departamento, cod_municipio)
    JOIN geografia g
      ON g.cod_departamento = h.cod_departamento
     AND g.cod_municipio = h.cod_municipio
    GROUP BY ${codigo}
  `;
}

export function sqlRankingTasa(
  filtros,
  { tabla, numerador, escala = 1000, extra = "TRUE", municipal = false } = {},
) {
  const municipalVista =
    municipal || filtros.departamento !== "Todos" || filtros.municipio !== "Todos";
  const etiqueta = municipalVista
    ? filtros.departamento === "Todos"
      ? "h.municipio || ' · ' || h.departamento"
      : "h.municipio"
    : "h.departamento";
  return `
    WITH hechos AS (
      SELECT anio, cod_departamento, departamento, cod_municipio, municipio,
             SUM(${numerador})::DOUBLE AS hechos
      FROM ${tabla}
      WHERE ${whereTerritorio(filtros)} AND ${extra}
      GROUP BY 1, 2, 3, 4, 5
    ),
    pob AS (
      SELECT anio, cod_departamento, departamento, cod_municipio, municipio,
             SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${whereTerritorio(filtros)}
      GROUP BY 1, 2, 3, 4, 5
    )
    SELECT ${etiqueta} AS etiqueta,
           SUM(h.hechos)::DOUBLE AS hechos,
           SUM(p.poblacion)::DOUBLE AS poblacion,
           ${escala} * SUM(h.hechos) / NULLIF(SUM(p.poblacion), 0) AS valor
    FROM hechos h
    JOIN pob p USING (anio, cod_departamento, cod_municipio)
    GROUP BY 1
    HAVING SUM(p.poblacion) >= 10000
    ORDER BY valor DESC NULLS LAST
    LIMIT 10
  `;
}

export function sqlFecundidadEdad(filtros) {
  const grupos = GRUPOS_MADRE.map(literal).join(", ");
  return `
    WITH nac AS (
      SELECT anio, grupo_edad_madre, SUM(nacimientos)::DOUBLE AS nacimientos
      FROM nac_edad
      WHERE ${whereTerritorio(filtros)}
        AND grupo_edad_madre IN (${grupos})
      GROUP BY 1, 2
    ),
    muj AS (
      SELECT anio, ${MADRE_DESDE_POB} AS grupo_edad_madre, SUM(poblacion)::DOUBLE AS mujeres
      FROM poblacion
      WHERE ${whereTerritorio(filtros)}
        AND sexo = 'Mujeres'
        AND ${MADRE_DESDE_POB} IS NOT NULL
      GROUP BY 1, 2
    )
    SELECT n.grupo_edad_madre,
           SUM(n.nacimientos)::DOUBLE AS nacimientos,
           SUM(m.mujeres)::DOUBLE AS mujeres,
           1000 * SUM(n.nacimientos) / NULLIF(SUM(m.mujeres), 0) AS tasa
    FROM nac n
    JOIN muj m USING (anio, grupo_edad_madre)
    GROUP BY 1
  `;
}

export function sqlFecundidadEdadAnios(filtros, anioBase, anioActual) {
  const territorio = whereTerritorio(filtros, { anio: false });
  const grupos = GRUPOS_MADRE.map(literal).join(", ");
  const anios = [...new Set([Number(anioBase), Number(anioActual)])].join(", ");
  return `
    WITH nac AS (
      SELECT anio, grupo_edad_madre, SUM(nacimientos)::DOUBLE AS nacimientos
      FROM nac_edad
      WHERE ${territorio}
        AND grupo_edad_madre IN (${grupos})
        AND anio IN (${anios})
      GROUP BY 1, 2
    ),
    muj AS (
      SELECT anio, ${MADRE_DESDE_POB} AS grupo_edad_madre, SUM(poblacion)::DOUBLE AS mujeres
      FROM poblacion
      WHERE ${territorio}
        AND sexo = 'Mujeres'
        AND ${MADRE_DESDE_POB} IS NOT NULL
        AND anio IN (${anios})
      GROUP BY 1, 2
    )
    SELECT n.anio,
           n.grupo_edad_madre,
           1000 * SUM(n.nacimientos) / NULLIF(SUM(m.mujeres), 0) AS tasa
    FROM nac n
    JOIN muj m USING (anio, grupo_edad_madre)
    GROUP BY 1, 2
  `;
}

function sqlTgfPorAnio(donde) {
  const tgf = GRUPOS_TGF.map(literal).join(", ");
  return `
    SELECT anio, 5 * SUM(fx) AS tgf
    FROM (
      SELECT n.anio, n.grupo_edad_madre,
             SUM(n.nacimientos) / NULLIF(SUM(m.mujeres), 0) AS fx
      FROM (
        SELECT anio, grupo_edad_madre, SUM(nacimientos)::DOUBLE AS nacimientos
        FROM nac_edad
        WHERE ${donde} AND grupo_edad_madre IN (${tgf})
        GROUP BY 1, 2
      ) n
      JOIN (
        SELECT anio, ${MADRE_DESDE_POB} AS grupo_edad_madre, SUM(poblacion)::DOUBLE AS mujeres
        FROM poblacion
        WHERE ${donde} AND sexo = 'Mujeres' AND ${MADRE_DESDE_POB} IN (${tgf})
        GROUP BY 1, 2
      ) m USING (anio, grupo_edad_madre)
      GROUP BY 1, 2
    )
    GROUP BY anio
  `;
}

function sqlTgfAgregada(donde) {
  const tgf = GRUPOS_TGF.map(literal).join(", ");
  return `
    SELECT 5 * SUM(fx) AS tgf
    FROM (
      SELECT n.grupo_edad_madre,
             SUM(n.nacimientos) / NULLIF(SUM(m.mujeres), 0) AS fx
      FROM (
        SELECT grupo_edad_madre, SUM(nacimientos)::DOUBLE AS nacimientos
        FROM nac_edad
        WHERE ${donde} AND grupo_edad_madre IN (${tgf})
        GROUP BY 1
      ) n
      JOIN (
        SELECT ${MADRE_DESDE_POB} AS grupo_edad_madre, SUM(poblacion)::DOUBLE AS mujeres
        FROM poblacion
        WHERE ${donde} AND sexo = 'Mujeres' AND ${MADRE_DESDE_POB} IN (${tgf})
        GROUP BY 1
      ) m USING (grupo_edad_madre)
      GROUP BY 1
    )
  `;
}

function dondeAnio(filtros) {
  return whereTerritorio({ ...filtros, departamento: "Todos", municipio: "Todos" });
}

function dondeDepartamento(filtros) {
  const anio = dondeAnio(filtros);
  if (filtros.departamento && filtros.departamento !== "Todos") {
    const territorio = `departamento = ${literal(filtros.departamento)}`;
    return anio === "TRUE" ? territorio : `${anio} AND ${territorio}`;
  }
  if (filtros.municipio && filtros.municipio !== "Todos") {
    const territorio = `cod_departamento = ${literal(filtros.municipio.split("|")[0])}`;
    return anio === "TRUE" ? territorio : `${anio} AND ${territorio}`;
  }
  return null;
}

export function nombreTerritorio(filtros, municipios = []) {
  if (filtros.municipio && filtros.municipio !== "Todos") {
    const [codDepartamento, codMunicipio] = filtros.municipio.split("|");
    const fila = municipios.find(
      (item) => item.cod_departamento === codDepartamento && item.cod_municipio === codMunicipio,
    );
    return fila?.municipio ?? "Municipio";
  }
  if (filtros.departamento && filtros.departamento !== "Todos") return filtros.departamento;
  return "Nacional";
}

export function nombreDepartamento(filtros, municipios = []) {
  if (filtros.departamento && filtros.departamento !== "Todos") return filtros.departamento;
  if (filtros.municipio && filtros.municipio !== "Todos") {
    const [codDepartamento, codMunicipio] = filtros.municipio.split("|");
    return (
      municipios.find(
        (item) => item.cod_departamento === codDepartamento && item.cod_municipio === codMunicipio,
      )?.departamento ?? null
    );
  }
  return null;
}

export function sqlTgfCambioDepartamentos(anioBase, anioActual) {
  const tgf = GRUPOS_TGF.map(literal).join(", ");
  const anios = [...new Set([Number(anioBase), Number(anioActual)])].join(", ");
  return `
    WITH nac AS (
      SELECT anio,
             cod_departamento,
             MAX(departamento) AS departamento,
             grupo_edad_madre,
             SUM(nacimientos)::DOUBLE AS nacimientos
      FROM nac_edad
      WHERE departamento <> '' AND grupo_edad_madre IN (${tgf})
        AND anio IN (${anios})
      GROUP BY anio, cod_departamento, grupo_edad_madre
    ),
    muj AS (
      SELECT anio,
             cod_departamento,
             ${MADRE_DESDE_POB} AS grupo_edad_madre,
             SUM(poblacion)::DOUBLE AS mujeres
      FROM poblacion
      WHERE sexo = 'Mujeres' AND ${MADRE_DESDE_POB} IN (${tgf})
        AND anio IN (${anios})
      GROUP BY 1, 2, 3
    ),
    fx AS (
      SELECT n.anio,
             n.cod_departamento,
             MAX(n.departamento) AS departamento,
             n.grupo_edad_madre,
             SUM(n.nacimientos) / NULLIF(SUM(m.mujeres), 0) AS fx
      FROM nac n
      JOIN muj m USING (anio, cod_departamento, grupo_edad_madre)
      GROUP BY n.anio, n.cod_departamento, n.grupo_edad_madre
    )
    SELECT anio, cod_departamento, MAX(departamento) AS departamento, 5 * SUM(fx) AS tgf
    FROM fx
    GROUP BY anio, cod_departamento
    ORDER BY departamento, anio
  `;
}

export function sqlSerieFecundidad(filtros) {
  const local = whereTerritorio(filtros, { anio: false });
  return `
    WITH nacional AS (${sqlTgfPorAnio("TRUE")}),
         local AS (${sqlTgfPorAnio(local)})
    SELECT n.anio,
           n.tgf AS tgf_nacional,
           l.tgf AS tgf
    FROM nacional n
    LEFT JOIN local l USING (anio)
    ORDER BY n.anio
  `;
}

export function sqlTgfReferencias(filtros) {
  const departamento = dondeDepartamento(filtros);
  return `
    SELECT (${sqlTgfAgregada(dondeAnio(filtros))}) AS nacional
           ${departamento ? `, (${sqlTgfAgregada(departamento)}) AS departamento` : ""}
  `;
}

export function sqlMapaTgf(filtros) {
  const nivel = nivelTerritorial(filtros);
  const codigo = nivel === "departamento" ? "cod_departamento" : "cod_municipio";
  const nombre = nivel === "departamento" ? "departamento" : "municipio";
  const detalle = nivel === "departamento" ? "MAX(CAST(NULL AS VARCHAR))" : "MAX(departamento)";
  const tgf = GRUPOS_TGF.map(literal).join(", ");
  const territorio = whereTerritorio(filtros);
  return `
    WITH nac AS (
      SELECT anio,
             ${codigo} AS codigo,
             MAX(${nombre}) AS nombre,
             ${detalle} AS detalle,
             grupo_edad_madre,
             SUM(nacimientos)::DOUBLE AS nacimientos
      FROM nac_edad
      WHERE ${territorio} AND grupo_edad_madre IN (${tgf})
      GROUP BY anio, ${codigo}, grupo_edad_madre
    ),
    muj AS (
      SELECT anio,
             ${codigo} AS codigo,
             ${MADRE_DESDE_POB} AS grupo_edad_madre,
             SUM(poblacion)::DOUBLE AS mujeres
      FROM poblacion
      WHERE ${territorio} AND sexo = 'Mujeres' AND ${MADRE_DESDE_POB} IN (${tgf})
      GROUP BY 1, 2, 3
    ),
    fx AS (
      SELECT n.codigo, MAX(n.nombre) AS nombre, MAX(n.detalle) AS detalle, n.grupo_edad_madre,
             SUM(n.nacimientos)::DOUBLE AS nacimientos,
             SUM(n.nacimientos) / NULLIF(SUM(m.mujeres), 0) AS fx
      FROM nac n
      JOIN muj m USING (anio, codigo, grupo_edad_madre)
      GROUP BY n.codigo, n.grupo_edad_madre
    )
    SELECT codigo,
           MAX(nombre) AS nombre,
           MAX(detalle) AS detalle,
           SUM(nacimientos)::DOUBLE AS hechos,
           5 * SUM(fx) AS valor
    FROM fx
    GROUP BY codigo
  `;
}

export function sqlFecundidadAnualEdad(filtros) {
  const territorio = whereTerritorio(filtros, { anio: false });
  const grupos = GRUPOS_MADRE.map(literal).join(", ");
  return `
    WITH nac AS (
      SELECT anio, grupo_edad_madre, SUM(nacimientos)::DOUBLE AS nacimientos
      FROM nac_edad
      WHERE ${territorio} AND grupo_edad_madre IN (${grupos})
      GROUP BY 1, 2
    ),
    muj AS (
      SELECT anio, ${MADRE_DESDE_POB} AS grupo_edad_madre, SUM(poblacion)::DOUBLE AS mujeres
      FROM poblacion
      WHERE ${territorio} AND sexo = 'Mujeres' AND ${MADRE_DESDE_POB} IS NOT NULL
      GROUP BY 1, 2
    )
    SELECT n.anio, n.grupo_edad_madre,
           SUM(n.nacimientos)::DOUBLE AS nacimientos,
           SUM(m.mujeres)::DOUBLE AS mujeres
    FROM nac n
    JOIN muj m USING (anio, grupo_edad_madre)
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
}

export function sqlMortalidadEdad(filtros) {
  return `
    WITH def AS (
      SELECT anio, grupo_edad, sexo, SUM(defunciones)::DOUBLE AS defunciones
      FROM def_edad
      WHERE ${whereTerritorio(filtros)}
        AND sexo IN ('Hombres', 'Mujeres')
        AND grupo_edad <> 'Edad desconocida'
      GROUP BY 1, 2, 3
    ),
    pob AS (
      SELECT anio, grupo_edad, sexo, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${whereTerritorio(filtros)}
      GROUP BY 1, 2, 3
    )
    SELECT d.grupo_edad, d.sexo,
           SUM(d.defunciones)::DOUBLE AS defunciones,
           SUM(p.poblacion)::DOUBLE AS poblacion,
           1000 * SUM(d.defunciones) / NULLIF(SUM(p.poblacion), 0) AS tasa
    FROM def d
    JOIN pob p USING (anio, grupo_edad, sexo)
    GROUP BY 1, 2
  `;
}

export function sqlMortalidadEstandar(filtros) {
  const territorio = whereTerritorio(filtros);
  return `
    WITH estandar AS (
      SELECT grupo_edad, SUM(poblacion)::DOUBLE AS peso
      FROM poblacion
      WHERE anio = 2019
      GROUP BY 1
    ),
    def AS (
      SELECT anio, grupo_edad, SUM(defunciones)::DOUBLE AS defunciones
      FROM def_edad
      WHERE ${territorio} AND grupo_edad <> 'Edad desconocida'
      GROUP BY 1, 2
    ),
    pob AS (
      SELECT anio, grupo_edad, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${territorio}
      GROUP BY 1, 2
    ),
    mx AS (
      SELECT d.grupo_edad, SUM(d.defunciones) / NULLIF(SUM(p.poblacion), 0) AS mx
      FROM def d
      JOIN pob p USING (anio, grupo_edad)
      GROUP BY 1
    )
    SELECT 1000 * SUM(m.mx * e.peso) / NULLIF(SUM(e.peso), 0) AS tasa_estandar
    FROM mx m
    JOIN estandar e USING (grupo_edad)
  `;
}

export function sqlRankingTgf(filtros) {
  const columna =
    filtros.departamento === "Todos" && filtros.municipio === "Todos" ? "departamento" : "municipio";
  const tgf = GRUPOS_TGF.map(literal).join(", ");
  const territorio = whereTerritorio(filtros);
  return `
    WITH nac AS (
      SELECT anio, ${columna} AS etiqueta, grupo_edad_madre, SUM(nacimientos)::DOUBLE AS nacimientos
      FROM nac_edad
      WHERE ${territorio} AND grupo_edad_madre IN (${tgf})
      GROUP BY 1, 2, 3
    ),
    muj AS (
      SELECT anio, ${columna} AS etiqueta, ${MADRE_DESDE_POB} AS grupo_edad_madre,
             SUM(poblacion)::DOUBLE AS mujeres
      FROM poblacion
      WHERE ${territorio} AND sexo = 'Mujeres' AND ${MADRE_DESDE_POB} IN (${tgf})
      GROUP BY 1, 2, 3
    ),
    fx AS (
      SELECT n.etiqueta, n.grupo_edad_madre,
             SUM(n.nacimientos) / NULLIF(SUM(m.mujeres), 0) AS fx
      FROM nac n
      JOIN muj m USING (anio, etiqueta, grupo_edad_madre)
      GROUP BY 1, 2
    )
    SELECT etiqueta, 5 * SUM(fx) AS valor
    FROM fx
    GROUP BY 1
    ORDER BY valor DESC NULLS LAST
    LIMIT 10
  `;
}

export function sqlMapaEstandar(filtros, municipal = false) {
  const nivel = nivelTerritorial(filtros, municipal);
  const codigo = nivel === "departamento" ? "d.cod_departamento" : "d.cod_municipio";
  const nombre = nivel === "departamento" ? "MAX(d.departamento)" : "MAX(d.municipio)";
  const detalle = nivel === "departamento" ? "''" : "MAX(d.departamento)";
  const territorio = whereTerritorio(filtros);
  return `
    WITH estandar AS (
      SELECT grupo_edad, SUM(poblacion)::DOUBLE AS peso
      FROM poblacion
      WHERE anio = 2019
      GROUP BY 1
    ),
    def AS (
      SELECT anio, cod_departamento, departamento, cod_municipio, municipio, grupo_edad,
             SUM(defunciones)::DOUBLE AS defunciones
      FROM def_edad
      WHERE ${territorio} AND grupo_edad <> 'Edad desconocida'
      GROUP BY 1, 2, 3, 4, 5, 6
    ),
    pob AS (
      SELECT anio, cod_departamento, departamento, cod_municipio, municipio, grupo_edad,
             SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${territorio}
      GROUP BY 1, 2, 3, 4, 5, 6
    ),
    mx AS (
      SELECT d.cod_departamento, d.departamento, d.cod_municipio, d.municipio, d.grupo_edad,
             SUM(d.defunciones) / NULLIF(SUM(p.poblacion), 0) AS mx
      FROM def d
      JOIN pob p USING (anio, cod_departamento, cod_municipio, grupo_edad)
      GROUP BY 1, 2, 3, 4, 5
    )
    SELECT ${codigo} AS codigo,
           ${nombre} AS nombre,
           ${detalle} AS detalle,
           1000 * SUM(d.mx * e.peso) / NULLIF(SUM(e.peso), 0) AS valor
    FROM mx d
    JOIN estandar e USING (grupo_edad)
    GROUP BY ${codigo}
  `;
}

export function sqlRankingEstandar(filtros) {
  const columna =
    filtros.departamento === "Todos" && filtros.municipio === "Todos" ? "departamento" : "municipio";
  const territorio = whereTerritorio(filtros);
  return `
    WITH estandar AS (
      SELECT grupo_edad, SUM(poblacion)::DOUBLE AS peso
      FROM poblacion
      WHERE anio = 2019
      GROUP BY 1
    ),
    def AS (
      SELECT anio, departamento, municipio, grupo_edad, SUM(defunciones)::DOUBLE AS defunciones
      FROM def_edad
      WHERE ${territorio} AND grupo_edad <> 'Edad desconocida'
      GROUP BY 1, 2, 3, 4
    ),
    pob AS (
      SELECT anio, departamento, municipio, grupo_edad, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${territorio}
      GROUP BY 1, 2, 3, 4
    ),
    mx AS (
      SELECT d.${columna} AS etiqueta, d.grupo_edad,
             SUM(d.defunciones) / NULLIF(SUM(p.poblacion), 0) AS mx
      FROM def d
      JOIN pob p USING (anio, departamento, municipio, grupo_edad)
      GROUP BY 1, 2
    )
    SELECT etiqueta, 1000 * SUM(m.mx * e.peso) / NULLIF(SUM(e.peso), 0) AS valor
    FROM mx m
    JOIN estandar e USING (grupo_edad)
    GROUP BY 1
    ORDER BY valor DESC NULLS LAST
    LIMIT 10
  `;
}

export function sqlPerfilNatalidad(filtros, dimension, anioBase, anioActual) {
  const territorio = whereTerritorio(filtros, { anio: false });
  return `
    SELECT categoria,
           COALESCE(SUM(CASE WHEN anio = ${anioBase} THEN nacimientos END), 0)::DOUBLE AS base,
           COALESCE(SUM(CASE WHEN anio = ${anioActual} THEN nacimientos END), 0)::DOUBLE AS actual
    FROM nac_perfil
    WHERE ${territorio} AND dimension = ${literal(dimension)}
    GROUP BY 1
  `;
}

export function sqlPerfilEdadMadre(filtros, anioBase, anioActual) {
  const territorio = whereTerritorio(filtros, { anio: false });
  return `
    SELECT grupo_edad_madre AS categoria,
           COALESCE(SUM(CASE WHEN anio = ${anioBase} THEN nacimientos END), 0)::DOUBLE AS base,
           COALESCE(SUM(CASE WHEN anio = ${anioActual} THEN nacimientos END), 0)::DOUBLE AS actual
    FROM nac_edad
    WHERE ${territorio} AND grupo_edad_madre <> 'Sin información'
    GROUP BY 1
  `;
}

export function sqlHeatmapEdadesPadres(filtros) {
  return `
    SELECT edad_padre_grupo, edad_madre_grupo,
           SUM(nacimientos)::DOUBLE AS nacimientos
    FROM nac_padres
    WHERE ${whereTerritorio(filtros)}
    GROUP BY 1, 2
  `;
}

export function sqlEstadoCivilMadre(filtros, indicador) {
  const tabla = indicador === "civil" ? "estado_civil" : "estado_conyugal";
  return `
    SELECT estado_civil AS categoria,
           MIN(orden_estado_civil) AS orden,
           SUM(nacimientos)::DOUBLE AS nacimientos
    FROM ${tabla}
    WHERE ${whereTerritorio(filtros)}
    GROUP BY estado_civil
    ORDER BY orden, categoria
  `;
}

export function sqlCaracterizacion(filtros, dimension) {
  return `
    SELECT categoria, subcategoria, SUM(nacimientos)::DOUBLE AS nacimientos
    FROM caracterizacion
    WHERE dimension = ${literal(dimension)} AND ${whereTerritorio(filtros)}
    GROUP BY 1, 2
  `;
}

export function sqlIndicadoresCaracterizacion(filtros) {
  return `
    SELECT
      (SELECT SUM(nacimientos)::DOUBLE FROM caracterizacion WHERE dimension = 'multiplicidad' AND ${whereTerritorio(filtros)}) AS nacimientos,
      SUM(CASE WHEN dimension = 'multiplicidad' AND categoria IN ('Doble', 'Trillizos', 'Cuatrillizos o más') THEN nacimientos ELSE 0 END)::DOUBLE AS multiples,
      SUM(CASE WHEN dimension = 'multiplicidad' AND categoria <> 'Sin información' THEN nacimientos ELSE 0 END)::DOUBLE AS multiplicidad_reportada,
      SUM(CASE WHEN dimension = 'hemoclasificacion' AND subcategoria = 'Positivo' THEN nacimientos ELSE 0 END)::DOUBLE AS rh_positivo,
      SUM(CASE WHEN dimension = 'hemoclasificacion' AND subcategoria IN ('Positivo', 'Negativo') THEN nacimientos ELSE 0 END)::DOUBLE AS rh_reportado,
      SUM(CASE WHEN dimension = 'controles_prenatales' AND subcategoria IN ('4-6', '7-9', '10 o más') THEN nacimientos ELSE 0 END)::DOUBLE AS controles_4_mas,
      SUM(CASE WHEN dimension = 'controles_prenatales' AND subcategoria <> 'Sin información' THEN nacimientos ELSE 0 END)::DOUBLE AS controles_reportados
    FROM caracterizacion
    WHERE ${whereTerritorio(filtros)}
  `;
}

export async function cargarCatalogos(consultar) {
  const [anios, departamentos, municipios, aniosIntervalos, aniosCaracterizacion, aniosFlujos, edadMadre, nivelEducativo, regimenes, tiposParto] = await Promise.all([
    consultar("SELECT DISTINCT anio FROM panorama ORDER BY anio DESC"),
    consultar(
      "SELECT DISTINCT departamento FROM geografia WHERE departamento <> '' ORDER BY departamento",
    ),
    consultar(`
      SELECT cod_departamento, departamento, cod_municipio, municipio
      FROM geografia
    `),
    consultar("SELECT DISTINCT anio FROM intervalos ORDER BY anio DESC"),
    consultar("SELECT DISTINCT anio FROM caracterizacion ORDER BY anio DESC"),
    consultar("SELECT DISTINCT anio FROM flujos_nacimientos ORDER BY anio DESC"),
    consultar(`SELECT DISTINCT ${EDAD_MADRE_GRUPO_SQL} AS valor FROM intervalos ORDER BY 1`),
    consultar(`SELECT DISTINCT ${NIVEL_EDUCATIVO_GRUPO_SQL} AS valor FROM intervalos ORDER BY 1`),
    consultar("SELECT DISTINCT seg_social_cat AS valor FROM intervalos ORDER BY 1"),
    consultar("SELECT DISTINCT tipo_parto_cat AS valor FROM intervalos ORDER BY 1"),
  ]);

  return {
    anios: anios.map((fila) => fila.anio),
    departamentos: departamentos
      .map((fila) => fila.departamento)
      .sort((a, b) => a.localeCompare(b, "es")),
    municipios: municipios.sort((a, b) => a.municipio.localeCompare(b.municipio, "es")),
    aniosIntervalos: aniosIntervalos.map((fila) => fila.anio),
    aniosCaracterizacion: aniosCaracterizacion.map((fila) => fila.anio),
    aniosFlujos: aniosFlujos.map((fila) => fila.anio),
    filtrosIntervalos: {
      edadMadre: edadMadre.map((fila) => fila.valor),
      nivelEducativo: nivelEducativo.map((fila) => fila.valor),
      regimen: regimenes.map((fila) => fila.valor),
      tipoParto: tiposParto.map((fila) => fila.valor),
    },
  };
}
