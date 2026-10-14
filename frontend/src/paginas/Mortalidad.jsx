import { FilaIndicadores, Indicador } from "@/componentes/Indicadores";
import {
  anioComparacion,
  anioInicial,
  sqlMapaEstandar,
  sqlMortalidadEdad,
  sqlRankingEstandar,
  sqlSerieTasas,
  whereTerritorio,
} from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useDatos } from "@/datos/DatosProvider";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { COLORES_TEMA, ESCALA_RIESGO } from "@/graficos/echarts/motor";
import { DefuncionesAnio } from "@/graficos/echarts/DefuncionesAnio";
import { PiramideTasas } from "@/graficos/echarts/PiramideTasas";
import { RankingTasas } from "@/graficos/echarts/RankingTasas";
import { SerieTasas } from "@/graficos/echarts/SerieTasas";
import { MapaCoropletas } from "@/graficos/echarts/MapaCoropletas";

export function Mortalidad() {
  const { filtros } = useFiltros();
  const { catalogos } = useDatos();
  const actual = anioComparacion(filtros, catalogos.anios);
  const base = anioInicial(catalogos.anios);
  const territorio = whereTerritorio(filtros, { anio: false });
  const { filas } = useConsulta(`
    SELECT h.anio,
           SUM(h.defunciones)::DOUBLE AS defunciones,
           SUM(CASE WHEN p.poblacion IS NOT NULL THEN h.defunciones END)::DOUBLE AS defunciones_tasa,
           SUM(p.poblacion)::DOUBLE AS poblacion
    FROM (
      SELECT anio, cod_departamento, cod_municipio, SUM(defunciones)::DOUBLE AS defunciones
      FROM panorama
      WHERE ${territorio} AND anio IN (${base}, ${actual})
      GROUP BY 1, 2, 3
    ) h
    LEFT JOIN (
      SELECT anio, cod_departamento, cod_municipio, SUM(poblacion)::DOUBLE AS poblacion
      FROM poblacion
      WHERE ${territorio} AND anio IN (${base}, ${actual})
      GROUP BY 1, 2, 3
    ) p USING (anio, cod_departamento, cod_municipio)
    GROUP BY 1
  `);
  const filaBase = filas.find((fila) => fila.anio === base);
  const filaActual = filas.find((fila) => fila.anio === actual);
  const defBase = filaBase?.defunciones ?? 0;
  const defActual = filaActual?.defunciones ?? 0;
  const variacion = defBase ? (100 * (defActual - defBase)) / defBase : null;
  const poblacion = filaActual?.poblacion ?? 0;
  const tbm = poblacion ? (1000 * (filaActual?.defunciones_tasa ?? 0)) / poblacion : null;

  return (
    <>
      <FilaIndicadores>
        <Indicador titulo={`Defunciones ${base}`} valor={entero(defBase)} tono="diferencia" />
        <Indicador titulo={`Defunciones ${actual}`} valor={entero(defActual)} tono="defunciones" />
        <Indicador
          titulo="Variación"
          valor={variacion == null ? "—" : `${decimal(variacion)}%`}
          tono="relacion"
        />
        <Indicador titulo="Tasa bruta por 1.000" valor={tbm == null ? "—" : decimal(tbm)} tono="hombres" />
      </FilaIndicadores>
      <div className="rejilla">
        <div className="rejilla-completa">
          <DefuncionesAnio />
        </div>
        <SerieTasas
          sql={sqlSerieTasas(filtros)}
          natalidad={false}
          ayuda="Defunciones registradas por cada 1.000 habitantes proyectados. La serie sigue los años disponibles y, cuando se elige un territorio, permite compararlo con el total nacional."
        />
        <PiramideTasas
          sql={sqlMortalidadEdad(filtros)}
          ayuda="Defunciones por cada 1.000 habitantes de cada grupo de edad y sexo. Se excluye la edad desconocida; las barras permiten comparar las tasas específicas entre hombres y mujeres."
        />
        <RankingTasas
          titulo="Mortalidad estandarizada más alta"
          sql={sqlRankingEstandar(filtros)}
          color={COLORES_TEMA.defunciones}
          formato={decimal}
          nombre="Por 1.000"
          ayuda="Ordena los territorios con mayor tasa de mortalidad estandarizada por edad. La estandarización directa aplica a las tasas específicas los pesos de la población de Colombia de 2019, para hacer comparables territorios con distinta estructura etaria. Unidad: defunciones por 1.000 habitantes."
        />
        <MapaCoropletas
          titulo="Mortalidad estandarizada por edad"
          sql={sqlMapaEstandar(filtros)}
          colores={ESCALA_RIESGO}
          formato={decimal}
          unidad="Por 1.000 (estándar 2019)"
          ayuda="Representa la tasa de mortalidad estandarizada por edad en cada territorio, por cada 1.000 habitantes. Usa como referencia la estructura por edades de la población de Colombia de 2019; así se reduce el efecto de que los territorios tengan poblaciones de edades diferentes."
        />
      </div>
    </>
  );
}
