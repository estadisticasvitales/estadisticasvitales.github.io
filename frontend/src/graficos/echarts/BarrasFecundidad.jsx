import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { decimal, ORDEN_MADRE } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, etiqueta, leyenda, tooltip } from "@/graficos/echarts/opciones";

export function BarrasFecundidad({ sql, anioBase, anioActual }) {
  const { filas, cargando, error } = useConsulta(sql);
  const comparar = anioBase != null && anioBase !== anioActual;
  const datos = useMemo(
    () =>
      ORDEN_MADRE.map((grupo) => {
        const actual = filas.find((fila) => fila.anio === anioActual && fila.grupo_edad_madre === grupo);
        const base = filas.find((fila) => fila.anio === anioBase && fila.grupo_edad_madre === grupo);
        return { grupo, tasa: actual?.tasa ?? null, base: base?.tasa ?? null };
      }).filter((fila) => fila.tasa != null || fila.base != null),
    [anioActual, anioBase, filas],
  );

  const opcion = useMemo(() => {
    const series = [];
    if (comparar) {
      series.push({
        id: "base",
        name: String(anioBase),
        type: "bar",
        data: datos.map((fila) => fila.base),
        barMaxWidth: 28,
        itemStyle: { color: COLORES_TEMA.gris, borderRadius: [6, 6, 0, 0] },
        label: etiqueta(decimal, { position: "top" }),
        labelLayout: { hideOverlap: true },
      });
    }
    series.push({
      id: "tasa",
      name: comparar ? String(anioActual) : "Tasa",
      type: "bar",
      data: datos.map((fila) => fila.tasa),
      barMaxWidth: comparar ? 28 : 42,
      itemStyle: { color: COLORES_TEMA.mujeres, borderRadius: [6, 6, 0, 0] },
      label: etiqueta(decimal, { position: "top" }),
      labelLayout: { hideOverlap: true },
    });
    return {
      tooltip: tooltip(decimal),
      legend: leyenda({ show: comparar }),
      grid: { top: comparar ? 44 : 28, right: 12, bottom: 4, left: 8, containLabel: true },
      xAxis: ejeCategoria(datos.map((fila) => fila.grupo)),
      yAxis: ejeValor(Math.max(0, ...datos.flatMap((fila) => [fila.tasa || 0, fila.base || 0]))),
      series,
    };
  }, [anioActual, anioBase, comparar, datos]);

  return (
    <Tarjeta
      titulo="Fecundidad por edad de la madre (hijos por cada 1.000 mujeres)"
      ayuda={`Cantidad de nacidos vivos por cada 1.000 mujeres de cada grupo de edad. Compara ${anioActual} vs ${anioBase}, el primer año con información disponible.`}
      cargando={cargando && datos.length === 0}
      error={error}
    >
      {datos.length === 0 && !cargando ? (
        <Vacio>No hay fecundidad por edad para este filtro.</Vacio>
      ) : (
        <Grafico opcion={opcion} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
