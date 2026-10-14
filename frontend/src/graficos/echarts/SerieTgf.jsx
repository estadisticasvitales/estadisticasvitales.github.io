import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { nombreTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useDatos } from "@/datos/DatosProvider";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal2 } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, etiqueta, leyenda, lineaAnio, tooltip } from "@/graficos/echarts/opciones";

export function SerieTgf({ sql }) {
  const { filtros } = useFiltros();
  const { catalogos } = useDatos();
  const comparar = filtros.departamento !== "Todos" || filtros.municipio !== "Todos";
  const territorio = nombreTerritorio(filtros, catalogos.municipios);
  const { filas, cargando, error } = useConsulta(sql);

  const opcion = useMemo(() => {
    const valores = filas.flatMap((fila) => (comparar ? [fila.tgf_nacional, fila.tgf] : [fila.tgf]));
    const principal = COLORES_TEMA.mujeres;
    const nacional = {
      id: "nacional",
      name: comparar ? "Nacional" : "Hijos por mujer",
      type: "line",
      data: filas.map((fila) => (comparar ? fila.tgf_nacional : fila.tgf)),
      symbol: "circle",
      symbolSize: comparar ? 5 : 7,
      lineStyle: {
        width: comparar ? 2 : 2.5,
        type: comparar ? [6, 4] : "solid",
        color: comparar ? COLORES_TEMA.gris : principal,
      },
      itemStyle: { color: comparar ? COLORES_TEMA.gris : principal, borderColor: "#fff", borderWidth: 1.5 },
      areaStyle: comparar ? undefined : { color: principal, opacity: 0.08 },
      label: etiqueta(decimal2, { position: "top", show: !comparar }),
      labelLayout: { hideOverlap: true },
      markLine: lineaAnio(filtros.anio),
    };
    const series = [nacional];
    if (comparar) {
      series.push({
        id: "local",
        name: territorio,
        type: "line",
        data: filas.map((fila) => fila.tgf),
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2.5, color: principal },
        itemStyle: { color: principal, borderColor: "#fff", borderWidth: 1.5 },
        label: etiqueta(decimal2, { position: "top" }),
        labelLayout: { hideOverlap: true },
      });
    }
    return {
      tooltip: tooltip(decimal2, { axisPointer: { type: "line" } }),
      legend: leyenda({ show: comparar }),
      grid: { top: comparar ? 44 : 28, right: 24, bottom: 8, left: 8, containLabel: true },
      xAxis: ejeCategoria(filas.map((fila) => String(fila.anio))),
      yAxis: ejeValor(Math.max(0, ...valores.map((valor) => valor || 0))),
      series,
    };
  }, [comparar, filas, filtros.anio, territorio]);

  return (
    <Tarjeta
      titulo="Tasa global de fecundidad (hijos por mujer)"
      ayuda="Número promedio de hijos por mujer que resultaría si se mantuvieran las tasas específicas por edad de ese año. En un territorio seleccionado, la línea local se compara con la nacional."
      cargando={cargando && filas.length === 0}
      error={error}
    >
      {filas.length === 0 && !cargando ? (
        <Vacio>No hay TGF para este territorio.</Vacio>
      ) : (
        <Grafico opcion={opcion} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
