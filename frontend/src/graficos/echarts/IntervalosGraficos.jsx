import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { FUENTE, TEXTO, ejeCategoria, ejeValor, leyenda, tooltip } from "@/graficos/echarts/opciones";

const ORDEN_CATEGORIAS = [
  "1. Corto (<18m)",
  "2. Subóptimo (18-23m)",
  "3. Óptimo (24-59m)",
  "4. Largo (60-119m)",
  "5. Muy largo (≥120m)",
];

export function DistribucionIntervalos({ sql }) {
  const { filas: datos, cargando, error } = useConsulta(sql);
  const opcion = useMemo(() => {
    const ordenados = [...datos].sort((a, b) => a.mes_inicio - b.mes_inicio);
    const etiquetas = ordenados.map((fila) => `${fila.mes_inicio}–${fila.mes_inicio + 5}`);
    return {
      tooltip: tooltip(entero, {
        formatter: (parametros) => {
          const punto = Array.isArray(parametros) ? parametros[0] : parametros;
          const fila = ordenados[punto.dataIndex];
          return fila
            ? `<strong>${fila.mes_inicio}–${fila.mes_inicio + 5} meses</strong><br/>Nacimientos: ${entero(fila.registros)}`
            : "";
        },
      }),
      grid: { top: 16, right: 18, bottom: 64, left: 58 },
      xAxis: ejeCategoria(etiquetas, { axisLabel: { rotate: 55, interval: 3 } }),
      yAxis: ejeValor(Math.max(0, ...ordenados.map((fila) => fila.registros)), {
        name: "Nacimientos",
        nameTextStyle: TEXTO,
      }),
      series: [
        {
          id: "distribucion",
          name: "Nacimientos",
          type: "bar",
          data: ordenados.map((fila) => fila.registros),
          barMaxWidth: 18,
          itemStyle: { color: COLORES_TEMA.nacimientos, borderRadius: [3, 3, 0, 0] },
          markLine: {
            symbol: "none",
            label: { formatter: "24 meses", position: "insideEndTop", color: COLORES_TEMA.texto },
            lineStyle: { color: COLORES_TEMA.defunciones, type: "dashed", width: 2 },
            data: [{ xAxis: "24–29" }],
          },
        },
      ],
    };
  }, [datos]);

  return (
    <Tarjeta titulo="Distribución de los intervalos" cargando={cargando && datos.length === 0} error={error}>
      {datos.length === 0 && !cargando ? <Vacio>No hay datos para estos filtros.</Vacio> : <Grafico opcion={opcion} cargando={cargando} />}
    </Tarjeta>
  );
}

export function CategoriasIntervalos({ sql }) {
  const { filas, cargando, error } = useConsulta(sql);
  const opcion = useMemo(() => {
    const total = filas.reduce((suma, fila) => suma + fila.registros, 0);
    const datos = [...filas].sort(
      (a, b) => ORDEN_CATEGORIAS.indexOf(a.categoria_intervalo) - ORDEN_CATEGORIAS.indexOf(b.categoria_intervalo),
    );
    return {
      tooltip: tooltip(undefined, {
        formatter: (parametro) => {
          const fila = datos[parametro.dataIndex];
          if (!fila) return "";
          return `<strong>${fila.categoria_intervalo}</strong><br/>${decimal((100 * fila.registros) / total)}%<br/>${entero(fila.registros)} nacimientos`;
        },
      }),
      grid: { top: 12, right: 55, bottom: 12, left: 12, containLabel: true },
      xAxis: ejeValor(100, { axisLabel: { formatter: "{value}%" }, max: 100 }),
      yAxis: ejeCategoria(datos.map((fila) => fila.categoria_intervalo), {
        inverse: true,
        axisLabel: { width: 142, overflow: "truncate" },
      }),
      series: [
        {
          id: "categorias",
          name: "Porcentaje",
          type: "bar",
          data: datos.map((fila) => (100 * fila.registros) / total),
          barMaxWidth: 25,
          itemStyle: { color: COLORES_TEMA.nacimientos, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: "right", formatter: ({ value }) => `${decimal(value)}%`, color: COLORES_TEMA.texto, fontFamily: FUENTE },
        },
      ],
    };
  }, [filas]);

  return (
    <Tarjeta titulo="Composición por categoría" cargando={cargando && filas.length === 0} error={error}>
      {filas.length === 0 && !cargando ? <Vacio>No hay datos para estos filtros.</Vacio> : <Grafico opcion={opcion} cargando={cargando} />}
    </Tarjeta>
  );
}

const RESULTADOS = [
  { clave: "bajo_peso", titulo: "Bajo peso", denominador: "bajo_peso_evaluable", color: COLORES_TEMA.relacion },
  { clave: "prematuro", titulo: "Prematuridad", denominador: "prematuro_evaluable", color: COLORES_TEMA.defunciones },
  { clave: "apgar_bajo", titulo: "APGAR bajo", denominador: "apgar_bajo_evaluable", color: COLORES_TEMA.lila },
  { clave: "adverso", titulo: "Compuesto adverso", denominador: "adverso_evaluable", color: COLORES_TEMA.tinta },
];

export function ResultadosIntervalos({ sql }) {
  const { filas, cargando, error } = useConsulta(sql);
  const opcion = useMemo(() => {
    const datos = [...filas].sort(
      (a, b) => ORDEN_CATEGORIAS.indexOf(a.categoria_intervalo) - ORDEN_CATEGORIAS.indexOf(b.categoria_intervalo),
    );
    const series = RESULTADOS.map((resultado) => ({
      id: resultado.clave,
      name: resultado.titulo,
      type: "bar",
      barMaxWidth: 26,
      itemStyle: { color: resultado.color, borderRadius: [3, 3, 0, 0] },
      data: datos.map((fila) =>
        fila[`n_${resultado.clave}_evaluable`]
          ? (100 * fila[`n_${resultado.clave}`]) / fila[`n_${resultado.clave}_evaluable`]
          : null,
      ),
    }));
    return {
      tooltip: tooltip(undefined, {
        formatter: (parametros) => {
          const puntos = Array.isArray(parametros) ? parametros : [parametros];
          const fila = datos[puntos[0]?.dataIndex];
          if (!fila) return "";
          return [
            `<strong>${fila.categoria_intervalo}</strong>`,
            ...puntos.map((punto) => {
              const resultado = RESULTADOS.find((item) => item.titulo === punto.seriesName);
              const base = resultado ? fila[`n_${resultado.denominador}`] : 0;
              return `${punto.marker}${punto.seriesName}: ${punto.value == null ? "—" : `${decimal(punto.value)}%`} (n=${entero(base)})`;
            }),
          ].join("<br/>");
        },
      }),
      legend: leyenda({ data: RESULTADOS.map((resultado) => resultado.titulo) }),
      grid: { top: 48, right: 18, bottom: 74, left: 55 },
      xAxis: ejeCategoria(datos.map((fila) => fila.categoria_intervalo), { axisLabel: { rotate: 18 } }),
      yAxis: ejeValor(Math.max(5, ...series.flatMap((serie) => serie.data).filter(Number.isFinite)), {
        name: "% entre casos evaluables",
        nameTextStyle: TEXTO,
        axisLabel: { formatter: "{value}%" },
      }),
      series,
    };
  }, [filas]);

  return (
    <Tarjeta titulo="Resultados del recién nacido por intervalo" cargando={cargando && filas.length === 0} error={error}>
      {filas.length === 0 && !cargando ? <Vacio>No hay datos para estos filtros.</Vacio> : <Grafico opcion={opcion} cargando={cargando} />}
    </Tarjeta>
  );
}
