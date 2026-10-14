import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { whereTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useDatos } from "@/datos/DatosProvider";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, etiqueta, leyenda, lineaAnio, tooltip } from "@/graficos/echarts/opciones";

function tasa(defunciones, nacimientos) {
  if (!nacimientos) return null;
  return (100 * defunciones) / nacimientos;
}

function nombreTerritorio(filtros, municipios) {
  if (filtros.municipio !== "Todos") {
    const [codDepartamento, codMunicipio] = filtros.municipio.split("|");
    const fila = municipios.find(
      (item) => item.cod_departamento === codDepartamento && item.cod_municipio === codMunicipio,
    );
    return fila?.municipio ?? "Municipio";
  }
  return filtros.departamento;
}

export function EvolucionRelacion() {
  const { filtros } = useFiltros();
  const { catalogos } = useDatos();
  const comparar = filtros.departamento !== "Todos" || filtros.municipio !== "Todos";
  const territorio = nombreTerritorio(filtros, catalogos.municipios);
  const { filas, cargando, error } = useConsulta(`
    WITH nacional AS (
      SELECT anio,
             SUM(nacimientos)::DOUBLE AS nacimientos,
             SUM(defunciones)::DOUBLE AS defunciones
      FROM panorama
      GROUP BY anio
    ),
    local AS (
      SELECT anio,
             SUM(nacimientos)::DOUBLE AS nacimientos,
             SUM(defunciones)::DOUBLE AS defunciones
      FROM panorama
      WHERE ${whereTerritorio(filtros, { anio: false })}
      GROUP BY anio
    )
    SELECT n.anio,
           n.nacimientos AS nacimientos_nacional,
           n.defunciones AS defunciones_nacional,
           l.nacimientos AS nacimientos_local,
           l.defunciones AS defunciones_local
    FROM nacional n
    LEFT JOIN local l USING (anio)
    ORDER BY n.anio
  `);

  const opcion = useMemo(() => {
    const datos = filas.map((fila) => ({
      anio: String(fila.anio),
      nacional: tasa(fila.defunciones_nacional, fila.nacimientos_nacional),
      local: tasa(fila.defunciones_local, fila.nacimientos_local),
    }));
    const valores = datos.flatMap((fila) => (comparar ? [fila.nacional, fila.local] : [fila.nacional]));
    const eje = ejeValor(Math.max(0, ...valores.map((valor) => valor ?? 0)));
    const superaCien = comparar && datos.some((fila) => fila.local != null && fila.local > 100);
    const principal = COLORES_TEMA.relacion;

    const nacional = {
      id: "nacional",
      name: "Nacional",
      type: "line",
      data: datos.map((fila) => fila.nacional),
      symbol: "circle",
      symbolSize: comparar ? 5 : 7,
      lineStyle: {
        width: comparar ? 2 : 2.5,
        type: comparar ? [6, 4] : "solid",
        color: comparar ? COLORES_TEMA.gris : principal,
      },
      itemStyle: { color: comparar ? COLORES_TEMA.gris : principal },
      areaStyle: comparar ? undefined : { color: principal, opacity: 0.08 },
      label: etiqueta(decimal, { position: "top", show: !comparar }),
      labelLayout: { hideOverlap: true },
      markLine: lineaAnio(filtros.anio),
    };

    const series = [nacional];
    if (comparar) {
      series.push({
        id: "local",
        name: territorio,
        type: "line",
        data: datos.map((fila) => fila.local),
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2.5, color: principal },
        itemStyle: { color: principal, borderColor: "#fff", borderWidth: 1.5 },
        label: etiqueta(decimal, { position: "top" }),
        labelLayout: { hideOverlap: true },
        markArea: superaCien
          ? {
              silent: true,
              itemStyle: { color: COLORES_TEMA.defunciones, opacity: 0.14 },
              data: [[{ yAxis: 100 }, { yAxis: eje.max }]],
            }
          : undefined,
      });
    }

    return {
      tooltip: tooltip(decimal, { axisPointer: { type: "line" } }),
      legend: leyenda({ show: comparar }),
      grid: { top: comparar ? 44 : 24, right: 24, bottom: 8, left: 8, containLabel: true },
      xAxis: ejeCategoria(datos.map((fila) => fila.anio)),
      yAxis: eje,
      series,
    };
  }, [comparar, filas, filtros.anio, territorio]);

  return (
    <Tarjeta
      titulo="Evolución de defunciones por 100 nacimientos"
      ayuda="Muestra cuántas defunciones se registraron por cada 100 nacimientos en cada año. Al elegir un departamento o municipio, compara su evolución con el total nacional. Es una razón entre registros vitales, no una tasa por población ni una probabilidad individual."
      cargando={cargando && filas.length === 0}
      error={error}
    >
      {filas.length === 0 && !cargando ? (
        <Vacio>No hay hechos vitales para este territorio.</Vacio>
      ) : (
        <Grafico opcion={opcion} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
