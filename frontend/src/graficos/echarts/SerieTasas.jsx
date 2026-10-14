import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { nombreTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useDatos } from "@/datos/DatosProvider";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import {
  ejeCategoria,
  ejeValor,
  etiqueta,
  leyenda,
  lineaAnio,
  tooltip,
} from "@/graficos/echarts/opciones";

function linea(id, nombre, color, datos, { comparar = false, area = false, markLine } = {}) {
  return {
    id,
    name: nombre,
    type: "line",
    data: datos,
    symbol: "circle",
    symbolSize: comparar ? 5 : 7,
    lineStyle: { width: comparar ? 2 : 2.5, type: comparar ? [6, 4] : "solid", color },
    itemStyle: { color, borderColor: "#fff", borderWidth: 1.5 },
    areaStyle: area ? { color, opacity: 0.08 } : undefined,
    label: etiqueta(decimal, { position: "top", show: !comparar }),
    labelLayout: { hideOverlap: true },
    markLine,
  };
}

export function SerieTasas({ sql, natalidad = true, mortalidad = true, ayuda }) {
  const { filtros } = useFiltros();
  const { catalogos } = useDatos();
  const comparar = filtros.departamento !== "Todos" || filtros.municipio !== "Todos";
  const territorio = nombreTerritorio(filtros, catalogos.municipios);
  const { filas, cargando, error } = useConsulta(sql);
  const varias = natalidad && mortalidad;

  const opcion = useMemo(() => {
    const metricas = [
      natalidad
        ? { id: "natalidad", nombre: "Natalidad", color: COLORES_TEMA.nacimientos, local: "natalidad", nacional: "natalidad_nacional" }
        : null,
      mortalidad
        ? { id: "mortalidad", nombre: "Mortalidad", color: COLORES_TEMA.defunciones, local: "mortalidad", nacional: "mortalidad_nacional" }
        : null,
    ].filter(Boolean);
    const valores = filas.flatMap((fila) =>
      metricas.flatMap((metrica) => (comparar ? [fila[metrica.nacional], fila[metrica.local]] : [fila[metrica.local]])),
    );
    const series = metricas.flatMap((metrica, indice) => {
      const nacional = linea(
        `${metrica.id}-nacional`,
        comparar ? (varias ? `Nacional · ${metrica.nombre}` : "Nacional") : metrica.nombre,
        comparar ? COLORES_TEMA.gris : metrica.color,
        filas.map((fila) => (comparar ? fila[metrica.nacional] : fila[metrica.local])),
        { comparar, area: !comparar, markLine: indice === 0 ? lineaAnio(filtros.anio) : undefined },
      );
      if (!comparar) return [nacional];
      return [
        nacional,
        linea(
          `${metrica.id}-local`,
          varias ? `${territorio} · ${metrica.nombre}` : territorio,
          metrica.color,
          filas.map((fila) => fila[metrica.local]),
        ),
      ];
    });
    return {
      tooltip: tooltip(decimal),
      legend: leyenda({ show: comparar || varias }),
      grid: { top: 44, right: 24, bottom: 8, left: 8, containLabel: true },
      xAxis: ejeCategoria(filas.map((fila) => String(fila.anio))),
      yAxis: ejeValor(Math.max(0, ...valores.filter((valor) => Number.isFinite(valor)))),
      series,
    };
  }, [comparar, filas, filtros.anio, mortalidad, natalidad, territorio, varias]);

  return (
    <Tarjeta
      titulo="Tasas brutas de mortalidad por 1.000 habitantes"
      ayuda={ayuda}
      cargando={cargando && filas.length === 0}
      error={error}
    >
      {filas.length === 0 && !cargando ? (
        <Vacio>No hay población proyectada para este territorio.</Vacio>
      ) : (
        <Grafico opcion={opcion} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
