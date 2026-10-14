import { FilaIndicadores, Indicador } from "@/componentes/Indicadores";
import {
  GRUPOS_TGF,
  anioComparacion,
  anioInicial,
  nombreDepartamento,
  sqlFecundidadEdad,
  sqlFecundidadEdadAnios,
  sqlMapaTgf,
  sqlTgfCambioDepartamentos,
  sqlRankingTgf,
  sqlSerieFecundidad,
  sqlTgfReferencias,
} from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useDatos } from "@/datos/DatosProvider";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, decimal2, PUNTO_MEDIO_MADRE } from "@/estilos/tema";
import { BarrasFecundidad } from "@/graficos/echarts/BarrasFecundidad";
import { CambioTgf } from "@/graficos/echarts/CambioTgf";
import { RankingTasas } from "@/graficos/echarts/RankingTasas";
import { SerieTgf } from "@/graficos/echarts/SerieTgf";
import { COLORES_TEMA, ESCALA_TGF } from "@/graficos/echarts/motor";
import { MapaCoropletas } from "@/graficos/echarts/MapaCoropletas";

export function Fecundidad() {
  const { filtros } = useFiltros();
  const { catalogos } = useDatos();
  const anioActual = anioComparacion(filtros, catalogos.anios);
  const anioBase = anioInicial(catalogos.anios);
  const { filas } = useConsulta(sqlFecundidadEdad(filtros));
  const { filas: referenciasTgf } = useConsulta(sqlTgfReferencias(filtros));
  const departamento = nombreDepartamento(filtros, catalogos.municipios);
  const referencias = [
    Number.isFinite(referenciasTgf[0]?.nacional)
      ? { nombre: "Nacional", valor: referenciasTgf[0].nacional, color: COLORES_TEMA.gris, discontinua: true }
      : null,
    departamento && Number.isFinite(referenciasTgf[0]?.departamento)
      ? { nombre: departamento, valor: referenciasTgf[0].departamento, color: COLORES_TEMA.mujeres }
      : null,
  ].filter(Boolean);
  const tgf = GRUPOS_TGF.reduce((suma, grupo) => {
    const fila = filas.find((item) => item.grupo_edad_madre === grupo);
    return suma + (fila?.tasa ?? 0) / 1000;
  }, 0) * 5;
  const adoles10 = filas.find((fila) => fila.grupo_edad_madre === "10-14")?.tasa ?? null;
  const adoles15 = filas.find((fila) => fila.grupo_edad_madre === "15-19")?.tasa ?? null;
  const nacimientos = filas.reduce((suma, fila) => suma + (fila.nacimientos || 0), 0);
  const edadMedia = nacimientos
    ? filas.reduce((suma, fila) => suma + (PUNTO_MEDIO_MADRE[fila.grupo_edad_madre] || 0) * fila.nacimientos, 0) /
      nacimientos
    : null;

  return (
    <>
      <p className="intro-pagina">
        Tasas por 1.000 mujeres de cada edad, con las proyecciones municipales del DANE. La tasa global de
        fecundidad suma los grupos de 15 a 49 años.
      </p>
      <FilaIndicadores>
        <Indicador titulo="Tasa global de fecundidad (TGF)" valor={tgf ? decimal2(tgf) : "—"} tono="nacimientos" />
        <Indicador
          titulo="Fecundidad 15-19"
          valor={adoles15 == null ? "—" : decimal(adoles15)}
          tono="relacion"
        />
        <Indicador
          titulo="Fecundidad 10-14"
          valor={adoles10 == null ? "—" : decimal(adoles10)}
          tono="diferencia"
        />
        <Indicador
          titulo="Edad promedio de la madre al dar a luz"
          valor={edadMedia == null ? "—" : decimal(edadMedia)}
          tono="hombres"
        />
      </FilaIndicadores>
      <div className="rejilla">
        <div className="rejilla-completa">
          <BarrasFecundidad
            sql={sqlFecundidadEdadAnios(filtros, anioBase, anioActual)}
            anioBase={anioBase}
            anioActual={anioActual}
          />
        </div>
        <SerieTgf sql={sqlSerieFecundidad(filtros)} />
        <CambioTgf sql={sqlTgfCambioDepartamentos()} />
        <RankingTasas
          titulo="Territorios con mayor TGF"
          sql={sqlRankingTgf(filtros)}
          ayuda="Muestra hasta diez territorios con mayor tasa global de fecundidad para el año y los filtros seleccionados. La unidad es hijos por mujer."
          color={COLORES_TEMA.mujeres}
          formato={decimal2}
          nombre="Hijos por mujer"
          referencias={referencias}
        />
        <MapaCoropletas
          titulo="Tasa global de fecundidad (TGF)"
          ayuda="Distribución territorial de la TGF para el año y los filtros seleccionados. Resume las tasas de fecundidad de mujeres de 15 a 49 años y se expresa en hijos por mujer."
          sql={sqlMapaTgf(filtros)}
          colores={ESCALA_TGF.colores}
          cortes={ESCALA_TGF.cortes}
          formato={decimal2}
          unidad="Hijos por mujer"
          hechoEtiqueta="Nacimientos de madres 15-49"
        />
      </div>
    </>
  );
}
