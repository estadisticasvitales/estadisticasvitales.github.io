import { FilaIndicadores, Indicador } from "@/componentes/Indicadores";
import { literal, sqlMapaTasa, sqlRankingTasa, whereCausaExterna, whereTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { COLORES_TEMA, ESCALA_RIESGO } from "@/graficos/echarts/motor";
import { MapaCoropletas } from "@/graficos/echarts/MapaCoropletas";
import { Piramide } from "@/graficos/echarts/Piramide";
import { RankingTasas } from "@/graficos/echarts/RankingTasas";
import { SerieExterna } from "@/graficos/echarts/SerieExterna";

function extraCausa(filtros) {
  if (!filtros.externa || filtros.externa === "Todas") return "TRUE";
  return `causa = ${literal(filtros.externa)}`;
}

export function CausasExternas() {
  const { filtros } = useFiltros();
  const territorio = whereTerritorio(filtros);
  const { filas } = useConsulta(`
    WITH def AS (
      SELECT causa, SUM(defunciones)::DOUBLE AS defunciones
      FROM externas
      WHERE ${territorio}
      GROUP BY 1
    ),
    pob AS (
      SELECT SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${territorio}
    )
    SELECT d.causa, d.defunciones, p.poblacion,
           100000 * d.defunciones / NULLIF(p.poblacion, 0) AS tasa
    FROM def d
    CROSS JOIN pob p
  `);
  const tasaDe = (causa) => filas.find((fila) => fila.causa === causa)?.tasa ?? null;
  const extra = extraCausa(filtros);
  const mapaSql = sqlMapaTasa(filtros, {
    tabla: "externas",
    numerador: "defunciones",
    escala: 100000,
    municipal: true,
    extra,
  });

  return (
    <>
      <FilaIndicadores>
        <Indicador
          titulo="Homicidios"
          valor={tasaDe("Homicidios") == null ? "—" : decimal(tasaDe("Homicidios"))}
          tono="defunciones"
        />
        <Indicador
          titulo="Suicidios"
          valor={tasaDe("Suicidios") == null ? "—" : decimal(tasaDe("Suicidios"))}
          tono="hombres"
        />
        <Indicador
          titulo="Accidentes de tránsito"
          valor={tasaDe("Accidentes de tránsito") == null ? "—" : decimal(tasaDe("Accidentes de tránsito"))}
          tono="relacion"
        />
        <Indicador
          titulo="Otros accidentes"
          valor={tasaDe("Otros accidentes") == null ? "—" : decimal(tasaDe("Otros accidentes"))}
          tono="diferencia"
        />
      </FilaIndicadores>
      <div className="rejilla">
        <div className="rejilla-completa">
          <SerieExterna />
        </div>
        <RankingTasas
          titulo="Territorios con la tasa más alta por causa externa"
          sql={sqlRankingTasa(filtros, {
            tabla: "externas",
            numerador: "defunciones",
            escala: 100000,
            extra,
            municipal: true,
          })}
          color={COLORES_TEMA.defunciones}
          formato={decimal}
          nombre="Por 100.000"
        />
        <RankingTasas
          titulo="Defunciones por causas externas por entidad territorial (Top 10)"
          sql={`
            SELECT ${filtros.departamento !== "Todos" || filtros.municipio !== "Todos" ? "municipio" : "departamento"} AS etiqueta,
                   SUM(defunciones)::DOUBLE AS valor
            FROM externas
            WHERE ${territorio} AND ${extra}
            GROUP BY 1
            ORDER BY valor DESC
            LIMIT 10
          `}
          color={COLORES_TEMA.relacion}
          formato={entero}
          nombre="Defunciones"
          vacio="No hay causas externas para este territorio."
        />
        <MapaCoropletas
          titulo={
            filtros.externa === "Todas"
              ? "Tasa de defunciones por causa externa por cada 100.000 habitantes a nivel municipal"
              : `${filtros.externa} por 100.000`
          }
          sql={mapaSql}
          municipal
          colores={ESCALA_RIESGO}
          formato={decimal}
          unidad="Por 100.000"
          hechoEtiqueta="Defunciones"
          ayuda="Defunciones por causa externa por cada 100.000 habitantes, desagregadas por municipio. Si se selecciona una causa específica, el mapa muestra esa causa; con ‘Todas’, reúne homicidios, suicidios, accidentes de tránsito, otros accidentes y otras externas."
        />
        <Piramide
          titulo="Defunciones por causas externas por grupo etario y sexo"
          donde={`${whereTerritorio(filtros)} AND ${whereCausaExterna(filtros)}`}
        />
      </div>
    </>
  );
}
