import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { nivelTerritorial, whereTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { corto, decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, FUENTE, leyenda, TEXTO, tooltip } from "@/graficos/echarts/opciones";

function etiquetaPorcentaje() {
  return {
    show: true,
    position: "inside",
    fontFamily: FUENTE,
    fontSize: 11,
    fontWeight: 600,
    color: "#fff",
    formatter: ({ value }) => (value >= 10 ? `${decimal(value)}%` : ""),
  };
}

export function NaturalidadTerritorio() {
  const { filtros } = useFiltros();
  const columna = nivelTerritorial(filtros) === "municipio" ? "municipio" : "departamento";
  const { filas, cargando, error } = useConsulta(`
    SELECT ${columna} AS etiqueta,
           SUM(defunciones)::DOUBLE AS total,
           SUM(CASE WHEN cod_causa LIKE '5%' THEN defunciones ELSE 0 END)::DOUBLE AS no_naturales
    FROM causas
    WHERE ${whereTerritorio(filtros)}
    GROUP BY 1
    HAVING SUM(defunciones) > 0
  `);

  const datos = useMemo(
    () =>
      filas
        .filter((fila) => fila.etiqueta && fila.total > 0)
        .map((fila) => {
          const noNatural = (100 * fila.no_naturales) / fila.total;
          return {
            etiqueta: fila.etiqueta,
            naturales: fila.total - fila.no_naturales,
            noNaturales: fila.no_naturales,
            natural: 100 - noNatural,
            noNatural,
          };
        })
        .sort((a, b) => b.noNatural - a.noNatural || a.etiqueta.localeCompare(b.etiqueta, "es")),
    [filas],
  );
  const contenido = datos.length * 28 + 56;

  const opcion = useMemo(
    () => ({
      tooltip: tooltip(decimal, {
        formatter: (params) => {
          const puntos = Array.isArray(params) ? params : [params];
          const fila = datos[puntos[0]?.dataIndex];
          if (!fila) return "";
          return [
            `<strong>${fila.etiqueta}</strong>`,
            `Naturales: ${decimal(fila.natural)}% (${entero(fila.naturales)})`,
            `No naturales: ${decimal(fila.noNatural)}% (${entero(fila.noNaturales)})`,
          ].join("<br/>");
        },
      }),
      legend: leyenda(),
      grid: { top: 36, right: 16, bottom: 4, left: 8, containLabel: true },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        interval: 20,
        axisLabel: { ...TEXTO, fontSize: 11, formatter: (valor) => `${valor}%` },
        splitLine: { lineStyle: { color: COLORES_TEMA.linea } },
      },
      yAxis: ejeCategoria(
        datos.map((fila) => fila.etiqueta),
        {
          inverse: true,
          axisLabel: { fontSize: 11, width: 130, overflow: "truncate", formatter: (valor) => corto(valor, 22) },
        },
      ),
      series: [
        {
          id: "naturales",
          name: "Naturales",
          type: "bar",
          stack: "naturalidad",
          data: datos.map((fila) => fila.natural),
          barMaxWidth: 14,
          itemStyle: { color: COLORES_TEMA.hombres, borderRadius: [4, 0, 0, 4] },
          label: etiquetaPorcentaje(),
        },
        {
          id: "no-naturales",
          name: "No naturales",
          type: "bar",
          stack: "naturalidad",
          data: datos.map((fila) => fila.noNatural),
          barMaxWidth: 14,
          itemStyle: { color: COLORES_TEMA.defunciones, borderRadius: [0, 4, 4, 0] },
          label: etiquetaPorcentaje(),
        },
      ],
    }),
    [datos],
  );

  return (
    <Tarjeta
      titulo="Muertes naturales y no naturales por entidad territorial"
      ayuda="Muestra la proporción y el número de defunciones naturales y no naturales en cada territorio. En esta clasificación, las causas no naturales corresponden a códigos de causa que comienzan por 5; las naturales son el resto de las causas registradas."
      cargando={cargando && datos.length === 0}
      error={error}
    >
      {datos.length === 0 && !cargando ? (
        <Vacio>No hay defunciones para este territorio.</Vacio>
      ) : (
        <Grafico opcion={opcion} contenido={contenido} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
