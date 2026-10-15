import { FilaIndicadores, Indicador } from "@/componentes/Indicadores";
import { literal } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { HeatmapFlujos, RankingCapitales, RutasFlujos, ScatterFlujos } from "@/graficos/echarts/FlujosGraficos";
import { MapaCoropletas } from "@/graficos/echarts/MapaCoropletas";

const ANIO_FIJO = 2025;
const ESCALA_SALDO = ["#9f1239", "#fda4af", "#e2e8f0", "#7dd3fc", "#0369a1"];
const FORMATO_PORCENTAJE = (valor) => `${decimal(100 * valor)}%`;

function sqlIndicadores(filtros) {
  const departamento = filtros.departamento && filtros.departamento !== "Todos"
    ? `WHERE departamento = ${literal(filtros.departamento)}`
    : "";
  return `
    SELECT departamento,
           SUM(total_residentes)::DOUBLE AS total_residentes,
           SUM(nacimientos_fuera)::DOUBLE AS nacimientos_fuera,
           SUM(nacimientos_recibidos)::DOUBLE AS nacimientos_recibidos
    FROM (
      SELECT departamento_residencia AS departamento,
             MAX(nacimientos_residencia)::DOUBLE AS total_residentes,
             MAX(nacimientos_fuera_residencia)::DOUBLE AS nacimientos_fuera,
             0::DOUBLE AS nacimientos_recibidos
      FROM flujos_nacimientos GROUP BY cod_residencia, departamento_residencia
      UNION ALL
      SELECT departamento_ocurrencia,
             0::DOUBLE, 0::DOUBLE,
             SUM(CASE WHEN cod_ocurrencia <> cod_residencia THEN nacimientos ELSE 0 END)::DOUBLE
      FROM flujos_nacimientos GROUP BY departamento_ocurrencia
    ) resumen
    ${departamento}
    GROUP BY departamento
  `;
}

function sqlDependencia(filtros) {
  const departamento = filtros.departamento && filtros.departamento !== "Todos"
    ? `HAVING MAX(departamento_residencia) = ${literal(filtros.departamento)}`
    : "";
  return `
    SELECT cod_residencia AS codigo,
           MAX(departamento_residencia) AS nombre,
           '' AS detalle,
           SUM(nacimientos)::DOUBLE AS hechos,
           SUM(CASE WHEN cod_ocurrencia <> cod_residencia THEN nacimientos ELSE 0 END)::DOUBLE
             / NULLIF(SUM(nacimientos), 0) AS valor
    FROM flujos_nacimientos
    GROUP BY cod_residencia
    ${departamento}
  `;
}

function sqlSaldoMapa(filtros) {
  const departamento = filtros.departamento && filtros.departamento !== "Todos"
    ? `WHERE COALESCE(l.departamento, s.departamento) = ${literal(filtros.departamento)}`
    : "";
  return `
    WITH salidas AS (
      SELECT cod_residencia AS codigo, MAX(departamento_residencia) AS departamento,
             SUM(CASE WHEN cod_ocurrencia <> cod_residencia THEN nacimientos ELSE 0 END)::DOUBLE AS salen
      FROM flujos_nacimientos GROUP BY cod_residencia
    ),
    llegadas AS (
      SELECT cod_ocurrencia AS codigo, MAX(departamento_ocurrencia) AS departamento,
             SUM(CASE WHEN cod_ocurrencia <> cod_residencia THEN nacimientos ELSE 0 END)::DOUBLE AS llegan,
             MAX(nacimientos_ocurrencia)::DOUBLE AS atendidos
      FROM flujos_nacimientos GROUP BY cod_ocurrencia
    )
    SELECT COALESCE(l.codigo, s.codigo) AS codigo,
           COALESCE(l.departamento, s.departamento) AS nombre,
           '' AS detalle,
           COALESCE(l.atendidos, 0)::DOUBLE AS hechos,
           (COALESCE(l.llegan, 0) - COALESCE(s.salen, 0))::DOUBLE AS valor
    FROM llegadas l FULL OUTER JOIN salidas s ON s.codigo = l.codigo
    ${departamento}
  `;
}

export function FlujosObstetricos() {
  const { filtros } = useFiltros();
  const { filas: resumen, error: errorResumen } = useConsulta(sqlIndicadores(filtros));
  const { filas: totalAnual, error: errorTotalAnual } = useConsulta(`
    SELECT COALESCE(SUM(nacimientos_ocurrencia), 0)::DOUBLE AS nacimientos
    FROM (
      SELECT cod_ocurrencia, MAX(nacimientos_ocurrencia)::DOUBLE AS nacimientos_ocurrencia
      FROM flujos_nacimientos
      WHERE anio = ${ANIO_FIJO}
        AND ${filtros.departamento && filtros.departamento !== "Todos" ? `departamento_ocurrencia = ${literal(filtros.departamento)}` : "TRUE"}
      GROUP BY cod_ocurrencia
    ) por_departamento
  `);

  const totalResidentes = resumen.reduce((suma, fila) => suma + fila.total_residentes, 0);
  const nacimientosFuera = resumen.reduce((suma, fila) => suma + fila.nacimientos_fuera, 0);
  const nacimientosRecibidos = resumen.reduce((suma, fila) => suma + fila.nacimientos_recibidos, 0);
  const atendidos = totalAnual[0]?.nacimientos ?? 0;
  const tasaFuera = totalResidentes ? nacimientosFuera / totalResidentes : 0;

  return <>
    <p className="intro-pagina">Movilidad de los nacimientos entre el departamento de residencia de la madre y el departamento donde ocurrió el parto. Los mapas muestran residencia para dependencia y ocurrencia para saldo; el filtro Departamento selecciona el territorio y sus flujos relacionados.</p>
    {errorResumen || errorTotalAnual ? <p className="nota">No se pudieron cargar los flujos: {errorResumen || errorTotalAnual}</p> : null}
    <FilaIndicadores>
      <Indicador titulo="Nacimientos de residentes" valor={entero(totalResidentes)} tono="nacimientos" />
      <Indicador titulo="Partos fuera del departamento" valor={totalResidentes ? `${decimal(100 * tasaFuera)}%` : "—"} tono="diferencia" ayuda="Porcentaje de nacimientos de residentes que ocurrieron en otro departamento." />
      <Indicador titulo="Atendidos en el territorio" valor={entero(atendidos)} tono="hombres" ayuda="Nacimientos ocurridos en el departamento seleccionado; sin filtro, corresponde al total nacional de 2025." />
      <Indicador titulo="Recibidos desde otros departamentos" valor={entero(nacimientosRecibidos)} tono="relacion" />
    </FilaIndicadores>
    <div className="rejilla">
      <MapaCoropletas
        titulo="Dependencia obstétrica por residencia"
        ayuda="Porcentaje de nacimientos de residentes que ocurrieron en otro departamento. El color usa cortes de 5%, 15% y 30%."
        sql={sqlDependencia(filtros)}
        ignorarMunicipio
        soloDepartamentos
        colores={["#ecfdf5", "#a7f3d0", "#fbbf24", "#be123c"]}
        cortes={[0.05, 0.15, 0.30]}
        formato={FORMATO_PORCENTAJE}
        unidad="Partos fuera"
        hechoEtiqueta="Nacimientos de residentes"
      />
      <MapaCoropletas
        titulo="Saldo neto de partos por ocurrencia"
        ayuda="Nacimientos recibidos de otros departamentos menos los nacimientos de residentes atendidos fuera. Rojo indica saldo expulsor; azul, receptor."
        sql={sqlSaldoMapa(filtros)}
        ignorarMunicipio
        soloDepartamentos
        colores={ESCALA_SALDO}
        divergente
        formato={entero}
        unidad="Saldo neto"
        hechoEtiqueta="Nacimientos atendidos"
      />
      <RutasFlujos filtros={filtros} />
      <RankingCapitales filtros={filtros} />
      <HeatmapFlujos filtros={filtros} />
      <ScatterFlujos filtros={filtros} />
    </div>
    <p className="nota nota-pie">Fuente: vista materializada de flujos de nacimientos cruzada con geografía. Año disponible: {ANIO_FIJO}. Los resultados son descriptivos; no representan medidas de calidad ni capacidad hospitalaria.</p>
  </>;
}
