import { useMemo, useState } from "react";
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

const VARIABLES_BOOLEANAS = [
  { clave: "n_bajo_peso", evaluable: "n_bajo_peso_evaluable", etiqueta: "Bajo peso al nacer" },
  { clave: "n_prematuro", evaluable: "n_prematuro_evaluable", etiqueta: "Prematuridad" },
  { clave: "n_apgar_bajo", evaluable: "n_apgar_bajo_evaluable", etiqueta: "APGAR bajo" },
  { clave: "n_adverso", evaluable: "n_adverso_evaluable", etiqueta: "Resultado compuesto adverso" },
];

function calcularRiesgos(filas, variable) {
  const grupos = filas
    .map((fila) => ({
      ...fila,
      eventos: Number(fila[variable.clave]) || 0,
      denominador: Number(fila[variable.evaluable]) || 0,
      orden: Number.parseInt(fila.categoria_intervalo, 10) || 999,
    }))
    .filter((fila) => fila.denominador > 0)
    .sort((a, b) => a.orden - b.orden || a.categoria_intervalo.localeCompare(b.categoria_intervalo, "es"));
  const referencia = grupos.find((fila) => fila.categoria_intervalo.startsWith("3."));
  if (!referencia || referencia.eventos > referencia.denominador) return [];

  return grupos.map((fila) => {
    const prevalencia = fila.eventos / fila.denominador;
    if (fila === referencia) {
      return { ...fila, prevalencia, rr: 1, inferior: 1, superior: 1, corregido: false };
    }
    if (fila.eventos > fila.denominador) {
      return { ...fila, prevalencia, rr: null, inferior: null, superior: null, corregido: false };
    }

    let eventos = fila.eventos;
    let noEventos = fila.denominador - fila.eventos;
    let eventosRef = referencia.eventos;
    let noEventosRef = referencia.denominador - referencia.eventos;
    const corregido = [eventos, noEventos, eventosRef, noEventosRef].some((valor) => valor === 0);
    if (corregido) {
      eventos += 0.5;
      noEventos += 0.5;
      eventosRef += 0.5;
      noEventosRef += 0.5;
    }

    const prevalenciaAjustada = eventos / (eventos + noEventos);
    const prevalenciaRefAjustada = eventosRef / (eventosRef + noEventosRef);
    const rr = prevalenciaAjustada / prevalenciaRefAjustada;
    const error = Math.sqrt(
      Math.max(0, 1 / eventos - 1 / (eventos + noEventos) + 1 / eventosRef - 1 / (eventosRef + noEventosRef)),
    );
    return {
      ...fila,
      prevalencia,
      rr,
      inferior: Math.exp(Math.log(rr) - 1.96 * error),
      superior: Math.exp(Math.log(rr) + 1.96 * error),
      corregido,
    };
  });
}

export function ForestPlotIntervalos({ sql }) {
  const [variableClave, setVariableClave] = useState(VARIABLES_BOOLEANAS[3].clave);
  const { filas, cargando, error } = useConsulta(sql);
  const variable = VARIABLES_BOOLEANAS.find((opcion) => opcion.clave === variableClave) ?? VARIABLES_BOOLEANAS[3];
  const opcion = useMemo(() => {
    const riesgos = calcularRiesgos(filas, variable).filter((fila) => Number.isFinite(fila.rr));
    const categorias = riesgos.map((fila) => fila.categoria_intervalo);
    const maximo = Math.max(1.1, ...riesgos.map((fila) => fila.superior));
    const minimo = Math.min(0.9, ...riesgos.map((fila) => fila.inferior));
    const amplitud = maximo - minimo || 0.2;
    const datos = riesgos.map((fila, indice) => ({
      name: fila.categoria_intervalo,
      value: [fila.rr, indice, fila.inferior, fila.superior],
      itemStyle: { color: fila.orden === 3 ? COLORES_TEMA.tinta : COLORES_TEMA.nacimientos },
    }));
    const porCategoria = new Map(riesgos.map((fila) => [fila.categoria_intervalo, fila]));

    return {
      tooltip: tooltip(undefined, {
        trigger: "item",
        formatter: (parametro) => {
          const fila = porCategoria.get(String(parametro.name));
          if (!fila) return "Sin estimación disponible";
          return [
            `<strong>${fila.categoria_intervalo}</strong>`,
            `Prevalencia: ${decimal(100 * fila.prevalencia)}% (${entero(fila.eventos)} de ${entero(fila.denominador)})`,
            `RR vs. óptimo: ${fila.rr === 1 ? "1,000" : decimal(fila.rr)} [${decimal(fila.inferior)}, ${decimal(fila.superior)}]`,
            fila.corregido ? "IC con corrección de 0,5 por conteo nulo" : "IC aproximado del 95% (Katz)",
          ].join("<br/>");
        },
      }),
      grid: { top: 18, right: 24, bottom: 46, left: 118 },
      xAxis: ejeValor(maximo + amplitud * 0.08, {
        min: Math.max(0, minimo - amplitud * 0.08),
        max: maximo + amplitud * 0.08,
        name: "Riesgo relativo (escala lineal)",
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: TEXTO,
        axisLabel: { ...TEXTO, fontSize: 11, formatter: (valor) => decimal(valor) },
      }),
      yAxis: ejeCategoria(categorias, { inverse: true, axisLabel: { width: 108, overflow: "truncate" } }),
      series: [
        {
          id: "rr-intervalos",
          name: "RR e IC 95%",
          type: "custom",
          data: datos,
          renderItem: (params, api) => {
            const punto = api.coord([api.value(0), api.value(1)]);
            const bajo = api.coord([api.value(2), api.value(1)]);
            const alto = api.coord([api.value(3), api.value(1)]);
            const color = api.visual("color");
            const altoTapa = 5;
            return {
              type: "group",
              children: [
                { type: "line", shape: { x1: bajo[0], y1: punto[1], x2: alto[0], y2: punto[1] }, style: { stroke: color, lineWidth: 2 } },
                { type: "line", shape: { x1: bajo[0], y1: punto[1] - altoTapa, x2: bajo[0], y2: punto[1] + altoTapa }, style: { stroke: color, lineWidth: 2 } },
                { type: "line", shape: { x1: alto[0], y1: punto[1] - altoTapa, x2: alto[0], y2: punto[1] + altoTapa }, style: { stroke: color, lineWidth: 2 } },
                { type: "circle", shape: { cx: punto[0], cy: punto[1], r: 5 }, style: { fill: color, stroke: "#fff", lineWidth: 1.5 } },
              ],
            };
          },
          encode: { x: 0, y: 1 },
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { color: COLORES_TEMA.tinta, type: "dashed", width: 1 },
            label: { show: true, formatter: "RR = 1", position: "insideEndTop", ...TEXTO, fontSize: 10 },
            data: [{ xAxis: 1 }],
          },
          emphasis: { focus: "self" },
        },
      ],
    };
  }, [filas, variable]);

  const riesgosDisponibles = calcularRiesgos(filas, variable).some((fila) => Number.isFinite(fila.rr));
  return (
    <Tarjeta
      titulo={`Prevalencia de ${variable.etiqueta.toLowerCase()} por intervalo`}
      ayuda="El punto muestra la prevalencia del resultado elegido en cada categoría de intervalo frente a la categoría óptima (referencia). RR = 1 indica la misma prevalencia; RR = 1,5 indica una prevalencia 50% mayor; RR = 0,8, una 20% menor. Las barras son IC aproximados del 95%: si cruzan 1, los datos son compatibles con una prevalencia similar a la referencia. Son comparaciones descriptivas, no ajustadas; con celdas de cero casos se aplica una corrección de 0,5."
      cargando={cargando && filas.length === 0}
      error={error}
    >
      <label className="selector-grafico">
        <span>Resultado</span>
        <select value={variableClave} onChange={(evento) => setVariableClave(evento.target.value)}>
          {VARIABLES_BOOLEANAS.map((opcion) => <option key={opcion.clave} value={opcion.clave}>{opcion.etiqueta}</option>)}
        </select>
      </label>
      {!cargando && !riesgosDisponibles ? <Vacio>No hay datos evaluables o no está disponible la categoría de referencia óptima.</Vacio> : <Grafico opcion={opcion} cargando={cargando} />}
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
    <Tarjeta
      titulo="Intervalos menores de 24 meses por edad y educación"
      ayuda="Porcentaje de intervalos menores de 24 meses en cada combinación de grupo de edad y nivel educativo de la madre. El color representa el porcentaje y la escala llega al máximo observado con los filtros actuales."
      cargando={cargando && filas.length === 0}
      error={error}
    >
      {filas.length === 0 && !cargando ? <Vacio>No hay datos para estos filtros.</Vacio> : <Grafico opcion={opcion} cargando={cargando} />}
    </Tarjeta>
  );
}
