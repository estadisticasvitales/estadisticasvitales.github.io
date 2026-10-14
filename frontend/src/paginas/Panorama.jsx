import { FilaIndicadores, Indicador } from "@/componentes/Indicadores";
import { whereTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { ComparacionSexo } from "@/graficos/echarts/ComparacionSexo";
import { EvolucionRelacion } from "@/graficos/echarts/EvolucionRelacion";
import { Ranking } from "@/graficos/echarts/Ranking";
import { SerieAnual } from "@/graficos/echarts/SerieAnual";
import { Mapa } from "@/graficos/echarts/Mapa";

function variacion(actual, anterior, anioAnterior) {
  if (!anterior) return null;
  const cambio = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (!Number.isFinite(cambio)) return null;
  const signo = cambio > 0 ? "+" : cambio < 0 ? "−" : "";
  return {
    texto: `${signo}${decimal(Math.abs(cambio))}%`,
    detalle: `Respecto a ${anioAnterior}`,
  };
}

export function Panorama() {
  const { filtros } = useFiltros();
  const comparar = Boolean(filtros.anio) && filtros.anio !== "Todos";
  const anio = Number(filtros.anio);
  const anterior = anio - 1;
  const territorio = whereTerritorio(filtros, { anio: false });
  const { filas } = useConsulta(
    comparar
      ? `
        SELECT
          COALESCE(SUM(CASE WHEN anio = ${anio} THEN nacimientos END), 0)::DOUBLE AS nacimientos,
          COALESCE(SUM(CASE WHEN anio = ${anio} THEN defunciones END), 0)::DOUBLE AS defunciones,
          COALESCE(SUM(CASE WHEN anio = ${anterior} THEN nacimientos END), 0)::DOUBLE AS nacimientos_anterior,
          COALESCE(SUM(CASE WHEN anio = ${anterior} THEN defunciones END), 0)::DOUBLE AS defunciones_anterior
        FROM panorama
        WHERE ${territorio} AND anio IN (${anio}, ${anterior})
      `
      : `
        SELECT SUM(nacimientos)::DOUBLE AS nacimientos,
               SUM(defunciones)::DOUBLE AS defunciones
        FROM panorama
        WHERE ${whereTerritorio(filtros)}
      `,
  );
  const nacimientos = filas[0]?.nacimientos ?? 0;
  const defunciones = filas[0]?.defunciones ?? 0;
  const nacimientosAnterior = filas[0]?.nacimientos_anterior ?? 0;
  const defuncionesAnterior = filas[0]?.defunciones_anterior ?? 0;
  const diferencia = nacimientos - defunciones;
  const relacion = nacimientos === 0 ? null : (100 * defunciones) / nacimientos;
  const relacionAnterior =
    nacimientosAnterior === 0 ? null : (100 * defuncionesAnterior) / nacimientosAnterior;
  const cambios = comparar
    ? {
        nacimientos: variacion(nacimientos, nacimientosAnterior, anterior),
        defunciones: variacion(defunciones, defuncionesAnterior, anterior),
        relacion:
          relacion == null ? null : variacion(relacion, relacionAnterior, anterior),
        diferencia: variacion(diferencia, nacimientosAnterior - defuncionesAnterior, anterior),
      }
    : {};

  return (
    <>
      <FilaIndicadores>
        <Indicador
          titulo="Nacimientos"
          valor={entero(nacimientos)}
          tono="nacimientos"
          variacion={cambios.nacimientos}
        />
        <Indicador
          titulo="Defunciones"
          valor={entero(defunciones)}
          tono="defunciones"
          variacion={cambios.defunciones}
        />
        <Indicador
          titulo="Defunciones por 100 nacimientos"
          valor={relacion == null ? "—" : decimal(relacion)}
          tono="relacion"
          ayuda="Razón entre los registros del territorio y año seleccionados: número de defunciones por cada 100 nacimientos. No representa una tasa por población ni una probabilidad individual."
          variacion={cambios.relacion}
        />
        <Indicador
          titulo="Diferencia poblacional"
          valor={entero(diferencia)}
          tono="diferencia"
          variacion={cambios.diferencia}
        />
      </FilaIndicadores>
      <SerieAnual />
      <div className="rejilla">
        <Ranking />
        <ComparacionSexo />
      </div>
      <div className="rejilla">
        <Mapa />
        <EvolucionRelacion />
      </div>
    </>
  );
}
