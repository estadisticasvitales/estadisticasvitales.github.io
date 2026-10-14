import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { FUENTE, TEXTO, ejeCategoria, ejeValor, tooltip } from "@/graficos/echarts/opciones";

const ORDEN_EDUCACION = [
  "Preescolar",
  "Básica primaria",
  "Básica secundaria",
  "Media académica o clásica",
  "Media técnica",
  "Técnica/Tecnológica",
  "Profesional",
  "Posgrado",
  "Ninguno",
  "Sin información",
];

function cuantilaPonderada(filas, p) {
  const total = filas.reduce((suma, fila) => suma + fila.registros, 0);
  if (!total) return null;
  const objetivo = total * p;
  let acumulado = 0;
  for (const fila of filas) {
    acumulado += fila.registros;
    if (acumulado >= objetivo) return fila.mes_bin + 0.5;
  }
  return filas.at(-1).mes_bin + 0.5;
}

function prepararCajas(filas) {
  const grupos = new Map();
  for (const fila of filas) {
    if (!grupos.has(fila.edad_madre_cat)) grupos.set(fila.edad_madre_cat, []);
    grupos.get(fila.edad_madre_cat).push(fila);
  }

  const edades = [...grupos.keys()].sort((a, b) => {
    const edadA = Number.parseInt(a, 10);
    const edadB = Number.parseInt(b, 10);
    return (Number.isFinite(edadA) ? edadA : 999) - (Number.isFinite(edadB) ? edadB : 999);
  });
  const cajas = edades.map((edad) => {
    const valores = grupos.get(edad).sort((a, b) => a.mes_bin - b.mes_bin);
    const q1 = cuantilaPonderada(valores, 0.25);
    const mediana = cuantilaPonderada(valores, 0.5);
    const q3 = cuantilaPonderada(valores, 0.75);
    const iqr = q3 - q1;
    const cerca = valores
      .map((fila) => ({ ...fila, mes: fila.mes_bin + 0.5 }))
      .filter((fila) => fila.mes >= q1 - 1.5 * iqr && fila.mes <= q3 + 1.5 * iqr);
    const bajos = cerca.length ? cerca[0].mes : q1;
    const altos = cerca.length ? cerca.at(-1).mes : q3;
    const n = valores.reduce((suma, fila) => suma + fila.registros, 0);
    return {
      edad,
      n,
      q1,
      mediana,
      q3,
      bajos,
      altos,
      caja: [bajos, q1, mediana, q3, altos],
      atipicos: valores
        .map((fila) => ({ edad, mes: fila.mes_bin + 0.5, registros: fila.registros }))
        .filter((fila) => fila.mes < bajos || fila.mes > altos),
    };
  });
  return { edades, cajas };
}

export function BoxplotIntervalos({ sql }) {
  const { filas, cargando, error } = useConsulta(sql);
  const opcion = useMemo(() => {
    const { edades, cajas } = prepararCajas(filas);
    const cajaPorEdad = new Map(cajas.map((caja) => [caja.edad, caja]));
    const maximo = Math.max(12, ...cajas.map((caja) => caja.altos), ...cajas.flatMap((caja) => caja.atipicos.map((fila) => fila.mes)));
    return {
      tooltip: tooltip(undefined, {
        trigger: "item",
        formatter: (parametro) => {
          const caja = cajaPorEdad.get(String(parametro.name));
          if (!caja) return "";
          return [
            `<strong>${caja.edad}</strong>`,
            `Mediana: ${decimal(caja.mediana)} meses`,
            `P25–P75: ${decimal(caja.q1)}–${decimal(caja.q3)} meses`,
            `Bigotes: ${decimal(caja.bajos)}–${decimal(caja.altos)} meses`,
            `Intervalos: ${entero(caja.n)}`,
          ].join("<br/>");
        },
      }),
      grid: { top: 18, right: 18, bottom: 36, left: 58 },
      xAxis: ejeCategoria(edades),
      yAxis: ejeValor(maximo, { name: "Meses", nameTextStyle: TEXTO }),
      series: [
        {
          id: "boxplot-intervalos",
          name: "Intervalo (meses)",
          type: "boxplot",
          data: cajas.map((caja) => ({ name: caja.edad, value: caja.caja })),
          itemStyle: { color: "rgba(46, 199, 201, 0.45)", borderColor: COLORES_TEMA.nacimientos },
          emphasis: { itemStyle: { borderWidth: 2 } },
        },
        {
          id: "atipicos-intervalos",
          name: "Valores atípicos",
          type: "scatter",
          silent: true,
          data: cajas.flatMap((caja) => caja.atipicos.map((fila) => [fila.edad, fila.mes, fila.registros])),
          symbolSize: (valor) => Math.min(9, 3 + Math.log2(Number(valor[2]) || 1)),
          itemStyle: { color: COLORES_TEMA.gris, opacity: 0.5 },
          dimensions: ["edad", "meses", "registros"],
          encode: { x: "edad", y: "meses" },
        },
      ],
    };
  }, [filas]);

  return (
    <Tarjeta titulo="Distribución del intervalo por edad materna" cargando={cargando && filas.length === 0} error={error}>
      {filas.length === 0 && !cargando ? <Vacio>No hay datos para estos filtros.</Vacio> : <Grafico opcion={opcion} cargando={cargando} />}
    </Tarjeta>
  );
}

export function HeatmapIntervalos({ sql }) {
  const { filas, cargando, error } = useConsulta(sql);
  const opcion = useMemo(() => {
    const edades = [...new Set(filas.map((fila) => fila.edad_madre_grupo))].sort((a, b) => {
      const edadA = Number.parseInt(a, 10);
      const edadB = Number.parseInt(b, 10);
      return (Number.isFinite(edadA) ? edadA : 999) - (Number.isFinite(edadB) ? edadB : 999);
    });
    const niveles = [...new Set(filas.map((fila) => fila.nivel_educativo_grupo))].sort((a, b) => {
      const indexA = ORDEN_EDUCACION.indexOf(a);
      const indexB = ORDEN_EDUCACION.indexOf(b);
      if (indexA < 0 && indexB < 0) return a.localeCompare(b, "es");
      return (indexA < 0 ? 999 : indexA) - (indexB < 0 ? 999 : indexB);
    });
    const edadIndex = new Map(edades.map((edad, index) => [edad, index]));
    const nivelIndex = new Map(niveles.map((nivel, index) => [nivel, index]));
    const celdas = filas.map((fila) => [
      nivelIndex.get(fila.nivel_educativo_grupo),
      edadIndex.get(fila.edad_madre_grupo),
      fila.registros ? (100 * fila.menores_24) / fila.registros : null,
      fila.registros,
      fila.menores_24,
    ]);
    const maximo = Math.max(0, ...celdas.map((celda) => (Number.isFinite(celda[2]) ? celda[2] : 0)));
    const limiteColor = maximo || 1;
    const porClave = new Map(
      filas.map((fila) => [`${fila.edad_madre_grupo}|${fila.nivel_educativo_grupo}`, fila]),
    );
    return {
      tooltip: tooltip(undefined, {
        trigger: "item",
        formatter: (parametro) => {
          const fila = porClave.get(`${edades[parametro.value[1]]}|${niveles[parametro.value[0]]}`);
          if (!fila) return "";
          const porcentaje = (100 * fila.menores_24) / fila.registros;
          return [
            `<strong>${fila.edad_madre_grupo}</strong>`,
            fila.nivel_educativo_grupo,
            `${decimal(porcentaje)}% menores de 24 meses`,
            `${entero(fila.menores_24)} de ${entero(fila.registros)} intervalos`,
          ].join("<br/>");
        },
      }),
      visualMap: {
        min: 0,
        max: limiteColor,
        dimension: 2,
        orient: "horizontal",
        left: "center",
        top: 0,
        text: [`Máx. ${decimal(maximo)}%`, "0%"],
        calculable: false,
        inRange: { color: ["#f1f5f9", "#b9eced", "#2ec7c9", "#d87a80"] },
        textStyle: { ...TEXTO, fontSize: 11 },
      },
      grid: { top: 52, right: 18, bottom: 94, left: 58 },
      xAxis: ejeCategoria(niveles, {
        axisLabel: { rotate: 45, interval: 0, fontSize: 10, width: 110, overflow: "truncate" },
      }),
      yAxis: ejeCategoria(edades, { inverse: true }),
      series: [
        {
          id: "heatmap-intervalos",
          type: "heatmap",
          data: celdas,
          label: { show: false },
          itemStyle: { borderColor: "#fff", borderWidth: 1 },
          emphasis: {
            itemStyle: { borderColor: COLORES_TEMA.texto, borderWidth: 1.5 },
            label: {
              show: true,
              formatter: ({ value }) => (Number.isFinite(value[2]) ? `${decimal(value[2])}%` : ""),
              color: COLORES_TEMA.texto,
              fontFamily: FUENTE,
              fontSize: 10,
            },
          },
        },
      ],
    };
  }, [filas]);

  return (
    <Tarjeta titulo="Intervalos menores de 24 meses por edad y educación" cargando={cargando && filas.length === 0} error={error}>
      {filas.length === 0 && !cargando ? <Vacio>No hay datos para estos filtros.</Vacio> : <Grafico opcion={opcion} cargando={cargando} />}
    </Tarjeta>
  );
}
