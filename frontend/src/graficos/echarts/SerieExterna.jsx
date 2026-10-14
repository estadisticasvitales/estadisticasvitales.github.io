import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { whereCausaExterna, whereTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, etiqueta, leyenda, lineaAnio, tooltip } from "@/graficos/echarts/opciones";

const SEXOS = [
  { id: "Hombres", color: COLORES_TEMA.hombres },
  { id: "Mujeres", color: COLORES_TEMA.mujeres },
];

export function SerieExterna() {
  const { filtros } = useFiltros();
  const territorio = whereTerritorio(filtros, { anio: false });
  const { filas, cargando, error } = useConsulta(`
    WITH def AS (
      SELECT anio, sexo, SUM(defunciones)::DOUBLE AS defunciones
      FROM causas
      WHERE ${territorio}
        AND ${whereCausaExterna(filtros)}
        AND sexo IN ('Hombres', 'Mujeres')
      GROUP BY 1, 2
    ),
    pob AS (
      SELECT anio, sexo, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${territorio} AND sexo IN ('Hombres', 'Mujeres')
      GROUP BY 1, 2
    )
    SELECT d.anio, d.sexo,
           100000 * d.defunciones / NULLIF(p.poblacion, 0) AS tasa
    FROM def d
    JOIN pob p USING (anio, sexo)
    ORDER BY 1
  `);

  const opcion = useMemo(() => {
    const anios = [...new Set(filas.map((fila) => fila.anio))].sort((a, b) => a - b);
    const tasa = (anio, sexo) => filas.find((fila) => fila.anio === anio && fila.sexo === sexo)?.tasa ?? 0;
    return {
      tooltip: tooltip(decimal),
      legend: leyenda(),
      grid: { top: 44, right: 24, bottom: 8, left: 8, containLabel: true },
      xAxis: ejeCategoria(anios.map(String)),
      yAxis: ejeValor(Math.max(0, ...filas.map((fila) => fila.tasa || 0))),
      series: SEXOS.map((sexo, indice) => ({
        id: sexo.id,
        name: sexo.id,
        type: "bar",
        data: anios.map((anio) => tasa(anio, sexo.id)),
        barMaxWidth: 36,
        itemStyle: { color: sexo.color, borderRadius: [6, 6, 0, 0] },
        label: etiqueta(decimal, { position: "top" }),
        labelLayout: { hideOverlap: true },
        markLine: indice === 0 ? lineaAnio(filtros.anio) : undefined,
      })),
    };
  }, [filas, filtros.anio]);

  return (
    <Tarjeta
      titulo="Tasas de defunciones por causas externas por 100.000 habitantes según sexo"
      ayuda="Defunciones por causas externas por cada 100.000 habitantes, separadas por sexo y año. Las causas externas consideradas son homicidios, suicidios, accidentes de tránsito, otros accidentes y otras externas."
      cargando={cargando && filas.length === 0}
      error={error}
    >
      {filas.length === 0 && !cargando ? (
        <Vacio>No hay causas externas para este filtro.</Vacio>
      ) : (
        <Grafico opcion={opcion} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
