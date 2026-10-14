import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { corto, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { FUENTE, ejeCategoria, ejeValor, etiqueta, tooltip } from "@/graficos/echarts/opciones";

export function RankingTasas({
  titulo,
  sql,
  color,
  formato = entero,
  nombre = "Tasa",
  vacio = "No hay tasas para este territorio.",
  referencias = [],
  ayuda,
}) {
  const { filas, cargando, error } = useConsulta(sql);
  const datos = useMemo(() => filas.filter((fila) => Number.isFinite(fila.valor)), [filas]);
  const contenido = datos.length * 32 + 48;

  const opcion = useMemo(() => {
    const marcas = referencias.filter((referencia) => Number.isFinite(referencia.valor));
    return {
      tooltip: tooltip(formato),
      graphic: marcas.map((marca, indice) => ({
        id: `referencia-${indice}`,
        type: "group",
        left: 8,
        top: 2 + indice * 16,
        children: [
          {
            type: "line",
            shape: { x1: 0, y1: 7, x2: 16, y2: 7 },
            style: { stroke: marca.color, lineWidth: 2, lineDash: marca.discontinua ? [4, 3] : undefined },
          },
          {
            type: "text",
            left: 20,
            top: 0,
            style: {
              text: `${marca.nombre} ${formato(marca.valor)}`,
              fill: COLORES_TEMA.texto,
              font: `600 11px ${FUENTE}`,
            },
          },
        ],
      })),
      grid: { top: marcas.length ? 8 + marcas.length * 16 : 12, right: 72, bottom: 4, left: 8, containLabel: true },
      xAxis: ejeValor(Math.max(0, ...datos.map((fila) => fila.valor || 0), ...marcas.map((marca) => marca.valor))),
      yAxis: ejeCategoria(
        datos.map((fila) => String(fila.etiqueta)),
        {
          inverse: true,
          axisLabel: { fontSize: 12, width: 140, overflow: "truncate", formatter: (valor) => corto(valor, 24) },
        },
      ),
      series: [
        {
          id: "valor",
          name: nombre,
          type: "bar",
          data: datos.map((fila) => fila.valor),
          barMaxWidth: 14,
          itemStyle: { color, borderRadius: [0, 4, 4, 0] },
          label: etiqueta(formato, { position: "right" }),
          markLine: marcas.length
            ? {
                symbol: "none",
                silent: true,
                data: marcas.map((marca) => ({
                  name: marca.nombre,
                  xAxis: marca.valor,
                  label: { show: false },
                  lineStyle: {
                    color: marca.color,
                    type: marca.discontinua ? [6, 4] : "solid",
                    width: 1.5,
                  },
                })),
              }
            : undefined,
        },
      ],
    };
  }, [color, datos, formato, nombre, referencias]);

  return (
    <Tarjeta titulo={titulo} ayuda={ayuda} cargando={cargando && datos.length === 0} error={error}>
      {datos.length === 0 && !cargando ? (
        <Vacio>{vacio}</Vacio>
      ) : (
        <Grafico opcion={opcion} contenido={contenido} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
