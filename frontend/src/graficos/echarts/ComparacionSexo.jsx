import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { whereTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { ORDEN_SEXO } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, etiqueta, leyenda, tooltip } from "@/graficos/echarts/opciones";

function barra(id, nombre, color, datos) {
  return {
    id,
    name: nombre,
    type: "bar",
    data: datos,
    barMaxWidth: 56,
    barGap: "15%",
    itemStyle: { color, borderRadius: [6, 6, 0, 0] },
    label: etiqueta(undefined, { position: "top" }),
    emphasis: { focus: "series" },
  };
}

export function ComparacionSexo() {
  const { filtros } = useFiltros();
  const { filas, cargando, error } = useConsulta(`
    SELECT sexo,
           SUM(nacimientos)::DOUBLE AS nacimientos,
           SUM(defunciones)::DOUBLE AS defunciones
    FROM panorama
    WHERE ${whereTerritorio(filtros)} AND sexo <> 'Indeterminado'
    GROUP BY sexo
  `);

  const datos = useMemo(
    () =>
      ORDEN_SEXO.filter((sexo) => filas.some((fila) => fila.sexo === sexo)).map((sexo) => {
        const fila = filas.find((item) => item.sexo === sexo);
        return {
          sexo,
          nacimientos: fila?.nacimientos ?? 0,
          defunciones: fila?.defunciones ?? 0,
        };
      }),
    [filas],
  );

  const opcion = useMemo(() => {
    const maximo = Math.max(0, ...datos.flatMap((fila) => [fila.nacimientos, fila.defunciones]));
    return {
      tooltip: tooltip(),
      legend: leyenda(),
      grid: { top: 48, right: 8, bottom: 4, left: 8, containLabel: true },
      xAxis: ejeCategoria(datos.map((fila) => fila.sexo), { axisLabel: { fontSize: 12 } }),
      yAxis: ejeValor(maximo),
      series: [
        barra("nacimientos", "Nacimientos", COLORES_TEMA.nacimientos, datos.map((fila) => fila.nacimientos)),
        barra("defunciones", "Defunciones", COLORES_TEMA.defunciones, datos.map((fila) => fila.defunciones)),
      ],
    };
  }, [datos]);

  return (
    <Tarjeta
      titulo="Nacimientos y defunciones por sexo"
      ayuda="Compara el número absoluto de nacimientos y defunciones registrados para hombres y mujeres en el territorio y año seleccionados. No es una tasa ni una razón por cada 100 nacimientos."
      cargando={cargando && filas.length === 0}
      error={error}
    >
      {datos.length === 0 && !cargando ? (
        <Vacio>No hay desagregación por sexo.</Vacio>
      ) : (
        <Grafico opcion={opcion} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
