import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { corto, decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValorSimetrico, etiqueta, FUENTE, tooltip } from "@/graficos/echarts/opciones";

export function PerfilNatalidad({
  titulo,
  sql,
  color = COLORES_TEMA.nacimientos,
  orden = null,
  anioBase,
  anioActual,
}) {
  const { filas, cargando, error } = useConsulta(sql);
  const datos = useMemo(
    () =>
      filas
        .map((fila) => ({
          categoria: fila.categoria,
          base: fila.base,
          actual: fila.actual,
          cambio: fila.base ? (100 * (fila.actual - fila.base)) / fila.base : null,
        }))
        .filter((fila) => fila.base > 0 || fila.actual > 0)
        .sort((a, b) => {
          if (orden) return orden.indexOf(a.categoria) - orden.indexOf(b.categoria);
          return (a.cambio ?? 0) - (b.cambio ?? 0);
        }),
    [filas, orden],
  );
  const contenido = datos.length * 36 + 36;

  const opcion = useMemo(
    () => ({
      tooltip: tooltip(undefined, {
        formatter: (params) => {
          const punto = Array.isArray(params) ? params[0] : params;
          const fila = datos[punto.dataIndex];
          if (!fila) return "";
          const variacion = fila.cambio == null ? "—" : `${decimal(fila.cambio)}%`;
          const inicio = anioBase ?? "Inicio";
          const fin = anioActual ?? "Actual";
          return [
            `<strong>${fila.categoria}</strong>`,
            `Variación: ${variacion}`,
            `${inicio}: ${entero(fila.base)}`,
            `${fin}: ${entero(fila.actual)}`,
          ].join("<br/>");
        },
        textStyle: { fontFamily: FUENTE, color: "#fff", fontSize: 12 },
      }),
      grid: { top: 8, right: 64, bottom: 4, left: 8, containLabel: true },
      xAxis: ejeValorSimetrico(Math.max(0, ...datos.map((fila) => Math.abs(fila.cambio || 0)))),
      yAxis: ejeCategoria(
        datos.map((fila) => String(fila.categoria)),
        {
          inverse: true,
          axisLabel: { fontSize: 11, width: 150, overflow: "truncate", formatter: (valor) => corto(valor, 26) },
        },
      ),
      series: [
        {
          id: "cambio",
          name: "Variación",
          type: "bar",
          data: datos.map((fila) => fila.cambio),
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: 3,
            color: ({ value }) => (Number(value) < 0 ? COLORES_TEMA.defunciones : color),
          },
          label: etiqueta((valor) => `${decimal(valor)}%`, { position: "outside" }),
        },
      ],
    }),
    [anioActual, anioBase, color, datos],
  );

  return (
    <Tarjeta
      titulo={titulo}
      ayuda={`Compara ${anioActual} vs ${anioBase}. ${anioBase} es el primer año con información disponible.`}
      cargando={cargando && datos.length === 0}
      error={error}
    >
      {datos.length === 0 && !cargando ? (
        <Vacio>No hay desagregación para este filtro.</Vacio>
      ) : (
        <Grafico opcion={opcion} contenido={contenido} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
