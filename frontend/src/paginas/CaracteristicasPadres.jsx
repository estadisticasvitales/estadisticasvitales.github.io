import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { FilaIndicadores, Indicador } from "@/componentes/Indicadores";
import { sqlHeatmapEdadesPadres, sqlIndicadoresCaracterizacion } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { EstadoCivilMadre } from "@/graficos/echarts/EstadoCivilMadre";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { FUENTE, TEXTO, ejeCategoria, tooltip } from "@/graficos/echarts/opciones";
import { ControlesPrenatalesEdad, Hemoclasificacion, HistoriaReproductiva, NacimientosPorMultiplicidad } from "@/graficos/echarts/AnalisisCaracterizacion";

const PADRES = ["10-14 años", "15-19 años", "20-24 años", "25-29 años", "30-34 años", "35-39 años", "40-44 años", "45-49 años", "50-54 años", "55+ años"];
const MADRES = ["10-14 años", "15-19 años", "20-24 años", "25-29 años", "30-34 años", "35-39 años", "40-44 años", "45-49 años", "50-54 años"];
const PALETA_HEATMAP = ["#E0F2F1", "#A7DCD7", "#65BDB5", "#2E968E", "#0F766E", "#064E49"];

export function CaracteristicasPadres() {
  const { filtros } = useFiltros();
  const { filas, cargando, error } = useConsulta(sqlHeatmapEdadesPadres(filtros));
  const { filas: resumen } = useConsulta(sqlIndicadoresCaracterizacion(filtros));
  const indicadores = resumen[0] || {};
  const opcion = useMemo(() => {
    const ixPadre = new Map(PADRES.map((grupo, indice) => [grupo, indice]));
    const ixMadre = new Map(MADRES.map((grupo, indice) => [grupo, indice]));
    const maximoNacimientos = Math.max(0, ...filas.map((fila) => fila.nacimientos));
    const datos = filas.map((fila) => {
      const esMaximo = fila.nacimientos === maximoNacimientos && maximoNacimientos > 0;
      return {
        value: [
          ixMadre.get(fila.edad_madre_grupo),
          ixPadre.get(fila.edad_padre_grupo),
          Math.log10(Math.max(1, fila.nacimientos)),
          fila.nacimientos,
        ],
        itemStyle: esMaximo ? { borderColor: "#FACC15", borderWidth: 3 } : undefined,
      };
    }).filter((fila) => fila.value[0] != null && fila.value[1] != null && fila.value[3] > 0);
    const maximo = Math.max(1, ...datos.map((fila) => fila.value[2]));
    const porClave = new Map(filas.map((fila) => [`${fila.edad_padre_grupo}|${fila.edad_madre_grupo}`, fila]));
    return {
      tooltip: tooltip(undefined, {
        trigger: "item",
        formatter: ({ value }) => {
          const padre = PADRES[value[1]];
          const madre = MADRES[value[0]];
          const fila = porClave.get(`${padre}|${madre}`);
          return fila ? `<strong>Padre: ${padre}</strong><br/>Madre: ${madre}<br/>${entero(fila.nacimientos)} nacimientos` : "Sin registros";
        },
      }),
      visualMap: {
        min: 0,
        max: maximo,
        dimension: 2,
        orient: "horizontal",
        seriesIndex: 0,
        left: "center",
        top: 0,
        text: [`Máx. ${entero(Math.pow(10, maximo))}`, "1"],
        calculable: false,
        inRange: { color: PALETA_HEATMAP },
        textStyle: { ...TEXTO, fontSize: 11 },
      },
      grid: { top: 48, right: 18, bottom: 58, left: 84 },
      xAxis: ejeCategoria(MADRES, { name: "Grupo etario de la madre", nameLocation: "middle", nameGap: 34, nameTextStyle: TEXTO, axisLabel: { rotate: 30, interval: 0, fontSize: 10 } }),
      yAxis: ejeCategoria(PADRES, { name: "Grupo etario del padre", nameLocation: "middle", nameGap: 66, nameTextStyle: TEXTO, inverse: false, axisLabel: { fontSize: 10 } }),
      series: [{
        id: "heatmap-edades-padres",
        type: "heatmap",
        data: datos,
        z: 1,
        itemStyle: { borderColor: "#fff", borderWidth: 1 },
        label: { show: false },
        emphasis: {
          itemStyle: { borderColor: COLORES_TEMA.texto, borderWidth: 1.5 },
          label: { show: true, formatter: ({ value }) => entero(value[3]), color: COLORES_TEMA.texto, fontFamily: FUENTE, fontSize: 10 },
        },
      }],
    };
  }, [filas]);

  return <>
    <FilaIndicadores>
      <Indicador titulo="Nacimientos" valor={entero(indicadores.nacimientos)} tono="nacimientos" ayuda="Total por departamento y municipio de residencia habitual de la madre." />
      <Indicador
        titulo="Embarazos múltiples"
        valor={indicadores.multiplicidad_reportada ? `${decimal(100 * indicadores.multiples / indicadores.multiplicidad_reportada)}%` : "—"}
        tono="relacion"
        ayuda="Porcentaje de nacimientos clasificados como dobles, trillizos o cuatrillizos o más, entre los que tienen multiplicidad reportada."
      />
      <Indicador
        titulo="Factor RH positivo"
        valor={indicadores.rh_reportado ? `${decimal(100 * indicadores.rh_positivo / indicadores.rh_reportado)}%` : "—"}
        tono="hombres"
        ayuda="Porcentaje de nacidos vivos con RH positivo entre quienes tienen factor RH reportado."
      />
      <Indicador
        titulo="4 o más controles prenatales"
        valor={indicadores.controles_reportados ? `${decimal(100 * indicadores.controles_4_mas / indicadores.controles_reportados)}%` : "—"}
        tono="diferencia"
        ayuda="Porcentaje de nacimientos con cuatro o más consultas prenatales. La OMS recomienda un mínimo de 8 controles prenatales para un embarazo no complicado"
      />
    </FilaIndicadores>
    <div className="rejilla">
      <Tarjeta titulo="Nacimientos por grupos etarios de los padres" ayuda="El eje vertical muestra la edad agrupada del padre y el horizontal la de la madre. El color representa el número de nacimientos en escala logarítmica. El borde amarillo destaca el cruce con más nacimientos para los filtros seleccionados.">
        {cargando && filas.length === 0 ? <p className="aviso">Cargando…</p> : null}
        {!cargando && error ? <p className="aviso error">{error}</p> : null}
        {!cargando && !error && filas.length === 0 ? <Vacio>No hay nacimientos para estos filtros.</Vacio> : null}
        {filas.length > 0 ? <Grafico opcion={opcion} cargando={cargando} /> : null}
      </Tarjeta>
      <EstadoCivilMadre />
      <HistoriaReproductiva />
      <Hemoclasificacion />
      <NacimientosPorMultiplicidad />
      <ControlesPrenatalesEdad />
    </div>
  </>;
}
