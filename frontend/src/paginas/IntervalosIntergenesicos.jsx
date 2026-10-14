import { FilaIndicadores, Indicador } from "@/componentes/Indicadores";
import {
  sqlIntervalosCategorias,
  sqlRiesgoRelativoIntervalos,
  sqlIntervalosDistribucion,
  sqlHeatmapIntervalos,
  sqlIntervalosResumen,
  sqlMapaIntervalos,
  sqlResultadosIntervalos,
} from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { CategoriasIntervalos, DistribucionIntervalos, ResultadosIntervalos } from "@/graficos/echarts/IntervalosGraficos";
import { ForestPlotIntervalos, HeatmapIntervalos } from "@/graficos/echarts/IntervalosComparativos";
import { ESCALA_RIESGO } from "@/graficos/echarts/motor";
import { MapaCoropletas } from "@/graficos/echarts/MapaCoropletas";

function percentilPonderado(filas, percentil) {
  const total = filas.reduce((suma, fila) => suma + fila.registros, 0);
  if (!total) return null;
  const objetivo = total * percentil;
  let acumulado = 0;
  for (const fila of filas) {
    acumulado += fila.registros;
    if (acumulado >= objetivo) return fila.mes_bin + 0.5;
  }
  return filas.at(-1).mes_bin + 0.5;
}

export function IntervalosIntergenesicos() {
  const { filtros } = useFiltros();
  const { filas } = useConsulta(sqlIntervalosResumen(filtros));
  const total = filas.reduce((suma, fila) => suma + fila.registros, 0);
  const sumaMeses = filas.reduce((suma, fila) => suma + fila.suma_meses, 0);
  const p25 = percentilPonderado(filas, 0.25);
  const mediana = percentilPonderado(filas, 0.5);
  const p75 = percentilPonderado(filas, 0.75);
  const bajo24 = filas.reduce(
    (suma, fila) => suma + (fila.mes_bin < 24 ? fila.registros : 0),
    0,
  );
  const adverso = filas.reduce((suma, fila) => suma + fila.n_adverso, 0);
  const adversoEvaluable = filas.reduce((suma, fila) => suma + fila.n_adverso_evaluable, 0);
  const promedio = total ? sumaMeses / total : null;

  return (
    <>
      <p className="intro-pagina">
        Intervalo entre la fecha registrada del hijo anterior y el nacimiento actual, por departamento de ocurrencia. Se incluyen casos con fecha válida; el nacimiento actual se aproxima al primer día del mes reportado.
      </p>
      <FilaIndicadores>
        <Indicador titulo="Intervalos válidos" valor={entero(total)} tono="nacimientos" />
        <Indicador
          titulo="Mediana estimada (P25–P75, meses)"
          valor={mediana == null ? "—" : `${decimal(mediana)} (${decimal(p25)}–${decimal(p75)})`}
          tono="diferencia"
        />
        <Indicador titulo="Promedio (meses)" valor={promedio == null ? "—" : decimal(promedio)} tono="hombres" />
        <Indicador titulo="Menos de 24 meses" valor={total ? `${decimal((100 * bajo24) / total)}%` : "—"} tono="relacion" />
        <Indicador titulo="Resultado compuesto adverso*" valor={adversoEvaluable ? `${decimal((100 * adverso) / adversoEvaluable)}%` : "—"} tono="defunciones" />
      </FilaIndicadores>
      <div className="rejilla">
        <DistribucionIntervalos sql={sqlIntervalosDistribucion(filtros)} />
        <CategoriasIntervalos sql={sqlIntervalosCategorias(filtros)} />
        <MapaCoropletas
          titulo="Intervalos menores de 24 meses por departamento de ocurrencia"
          ayuda="Porcentaje de intervalos menores de 24 meses en cada departamento donde ocurrió el nacimiento. El color compara departamentos; no hay desglose municipal."
          sql={sqlMapaIntervalos(filtros)}
          ignorarMunicipio
          soloDepartamentos
          colores={ESCALA_RIESGO}
          formato={decimal}
          unidad="% de intervalos"
          hechoEtiqueta="Intervalos"
        />
        <ResultadosIntervalos sql={sqlResultadosIntervalos(filtros)} />
        <ForestPlotIntervalos sql={sqlRiesgoRelativoIntervalos(filtros)} />
        <HeatmapIntervalos sql={sqlHeatmapIntervalos(filtros)} />
      </div>
      <p className="nota nota-pie">
        * Calculado solo entre registros evaluables; los valores faltantes no se cuentan como resultados favorables. El forest plot compara cada categoría de intervalo con la óptima. Los IC del 95% usan la aproximación de Katz y, si alguna celda es cero, una corrección de 0,5. Las diferencias son descriptivas y no están ajustadas por otras variables.
      </p>
    </>
  );
}
