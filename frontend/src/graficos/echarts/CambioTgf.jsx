import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { decimal, decimal2 } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeValor, leyenda, TEXTO } from "@/graficos/echarts/opciones";

function porcentaje(valor) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${signo}${decimal(Math.abs(valor))}%`;
}

function extremos(filas, anioBase, anioActual) {
  const porDepartamento = new Map();
  for (const fila of filas) {
    const tgf = Number(fila.tgf);
    if (!Number.isFinite(tgf) || !fila.departamento) continue;
    const actual = porDepartamento.get(fila.cod_departamento) ?? {
      departamento: fila.departamento,
      puntos: [],
    };
    actual.puntos.push({ anio: Number(fila.anio), tgf });
    porDepartamento.set(fila.cod_departamento, actual);
  }
  return [...porDepartamento.values()]
    .map((departamento) => {
      const inicio = departamento.puntos.find((punto) => punto.anio === Number(anioBase));
      const fin = departamento.puntos.find((punto) => punto.anio === Number(anioActual));
      if (!inicio || !fin || inicio.anio === fin.anio || !inicio.tgf) return null;
      return {
        departamento: departamento.departamento,
        anioInicio: inicio.anio,
        anioFin: fin.anio,
        inicio: inicio.tgf,
        fin: fin.tgf,
        cambio: (100 * (fin.tgf - inicio.tgf)) / inicio.tgf,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.cambio - b.cambio);
}

export function CambioTgf({ sql, anioBase, anioActual }) {
  const { filas, cargando, error } = useConsulta(sql);
  const datos = useMemo(
    () => extremos(filas, anioBase, anioActual),
    [filas, anioBase, anioActual],
  );
  const anioInicio = Number(anioBase);
  const anioFin = Number(anioActual);
  const contenido = datos.length * 26 + 72;

  const opcion = useMemo(() => {
    if (!datos.length || !Number.isFinite(anioInicio)) return null;
    const maximo = Math.max(0, ...datos.flatMap((fila) => [fila.inicio, fila.fin]));
    const punto = (fila, valor, exterior) => ({
      value: [valor, fila.departamento],
      label: { position: exterior ? "right" : "left" },
    });
    return {
      tooltip: {
        trigger: "item",
        borderWidth: 0,
        backgroundColor: "rgba(50, 50, 50, 0.55)",
        textStyle: { ...TEXTO, color: "#fff", fontSize: 12 },
        formatter: (params) => {
          if (params.seriesType !== "scatter") return "";
          const fila = datos.find((item) => item.departamento === params.value[1]);
          if (!fila) return "";
          return [
            `<strong>${fila.departamento}</strong>`,
            `${fila.anioInicio}: ${decimal2(fila.inicio)}`,
            `${fila.anioFin}: ${decimal2(fila.fin)}`,
            `Cambio: ${porcentaje(fila.cambio)}`,
          ].join("<br/>");
        },
      },
      legend: leyenda({ data: [String(anioInicio), String(anioFin)] }),
      grid: { top: 36, right: 16, bottom: 8, left: 8, containLabel: true },
      xAxis: ejeValor(maximo, { name: "Hijos por mujer", nameTextStyle: { ...TEXTO, fontSize: 11 } }),
      yAxis: [
        {
          type: "category",
          data: datos.map((fila) => fila.departamento),
          inverse: true,
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: { ...TEXTO, fontSize: 11, width: 128, overflow: "truncate" },
        },
        {
          type: "category",
          data: datos.map((fila) => porcentaje(fila.cambio)),
          inverse: true,
          position: "right",
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: {
            ...TEXTO,
            fontSize: 12,
            fontWeight: 700,
            color: (texto) => (String(texto).startsWith("+") ? COLORES_TEMA.nacimientos : COLORES_TEMA.defunciones),
          },
        },
      ],
      series: [
        {
          id: "enlace",
          type: "custom",
          coordinateSystem: "cartesian2d",
          silent: true,
          encode: { x: [1, 2], y: 0 },
          data: datos.map((fila, indice) => [indice, fila.inicio, fila.fin]),
          renderItem: (_params, api) => {
            const inicio = api.coord([api.value(1), api.value(0)]);
            const fin = api.coord([api.value(2), api.value(0)]);
            const sentido = fin[0] >= inicio[0] ? 1 : -1;
            const margen = 6;
            const x1 = inicio[0] + sentido * margen;
            const x2 = fin[0] - sentido * (margen + 1);
            if ((x2 - x1) * sentido <= 2) return null;
            const punta = 6;
            return {
              type: "group",
              children: [
                {
                  type: "line",
                  shape: { x1, y1: inicio[1], x2: x2 - sentido * punta, y2: fin[1] },
                  style: {
                    stroke: {
                      type: "linear",
                      x: 0,
                      y: 0,
                      x2: 1,
                      y2: 0,
                      colorStops:
                        sentido > 0
                          ? [
                              { offset: 0, color: COLORES_TEMA.gris },
                              { offset: 1, color: COLORES_TEMA.mujeres },
                            ]
                          : [
                              { offset: 0, color: COLORES_TEMA.mujeres },
                              { offset: 1, color: COLORES_TEMA.gris },
                            ],
                    },
                    lineWidth: 2.5,
                  },
                },
                {
                  type: "polygon",
                  shape: {
                    points: [
                      [x2, fin[1]],
                      [x2 - sentido * punta, fin[1] - 4],
                      [x2 - sentido * punta, fin[1] + 4],
                    ],
                  },
                  style: { fill: COLORES_TEMA.mujeres },
                },
              ],
            };
          },
          tooltip: { show: false },
        },
        {
          id: "inicio",
          name: String(anioInicio),
          type: "scatter",
          data: datos.map((fila) => punto(fila, fila.inicio, fila.inicio > fila.fin)),
          symbolSize: 11,
          itemStyle: { color: COLORES_TEMA.gris },
          label: {
            show: true,
            color: COLORES_TEMA.texto,
            fontSize: 10,
            fontWeight: 600,
            formatter: ({ value }) => decimal2(value[0]),
          },
          labelLayout: { hideOverlap: true },
        },
        {
          id: "fin",
          name: String(anioFin),
          type: "scatter",
          data: datos.map((fila) => punto(fila, fila.fin, fila.fin > fila.inicio)),
          symbolSize: 11,
          itemStyle: { color: COLORES_TEMA.mujeres },
          label: {
            show: true,
            color: COLORES_TEMA.texto,
            fontSize: 10,
            fontWeight: 600,
            formatter: ({ value }) => decimal2(value[0]),
          },
          labelLayout: { hideOverlap: true },
        },
      ],
    };
  }, [anioFin, anioInicio, datos]);

  return (
    <Tarjeta
      titulo="Cambio de la tasa global de fecundidad"
      ayuda={`Cambio porcentual de la TGF entre ${anioBase} y ${anioActual}. Los puntos muestran las tasas de inicio y fin; las flechas indican la dirección del cambio.`}
      cargando={cargando && datos.length === 0}
      error={error}
    >
      {datos.length === 0 && !cargando ? (
        <Vacio>Selecciona un año diferente al base para comparar.</Vacio>
      ) : (
        <Grafico opcion={opcion} contenido={contenido} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
