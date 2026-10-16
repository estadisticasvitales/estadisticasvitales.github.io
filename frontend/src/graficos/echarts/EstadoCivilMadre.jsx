import { useMemo, useState } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { sqlEstadoCivilMadre } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, etiqueta, tooltip } from "@/graficos/echarts/opciones";

const INDICADORES = [
  { valor: "conyugal", etiqueta: "Estado conyugal" },
  { valor: "civil", etiqueta: "Estado civil" },
];

export function EstadoCivilMadre() {
  const [indicador, setIndicador] = useState("conyugal");
  const { filtros } = useFiltros();
  const { filas, cargando, error } = useConsulta(sqlEstadoCivilMadre(filtros, indicador));
  const datos = useMemo(
    () => [...filas].sort((a, b) => b.nacimientos - a.nacimientos || a.categoria.localeCompare(b.categoria, "es")),
    [filas],
  );
  const total = datos.reduce((suma, fila) => suma + fila.nacimientos, 0);
  const categorias = datos.map((fila) => fila.categoria);
  const maximo = Math.max(1, ...datos.map((fila) => fila.nacimientos));
  const porCategoria = new Map(datos.map((fila) => [fila.categoria, fila]));
  const opcion = useMemo(() => ({
    tooltip: tooltip(undefined, {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (parametros) => {
        const punto = Array.isArray(parametros) ? parametros[0] : parametros;
        const fila = porCategoria.get(String(punto?.name));
        if (!fila) return "";
        return [
          `<strong>${fila.categoria}</strong>`,
          `${entero(fila.nacimientos)} nacimientos`,
          `${decimal(total ? (100 * fila.nacimientos) / total : 0)}% del total filtrado`,
        ].join("<br/>");
      },
    }),
    grid: { top: 14, right: 18, bottom: 36, left: 12, containLabel: true },
    xAxis: ejeValor(maximo / 1.12, { axisLabel: { formatter: (valor) => entero(valor) } }),
    yAxis: ejeCategoria(categorias, {
      inverse: true,
      axisLabel: { fontSize: 11, width: 175, overflow: "truncate" },
    }),
    series: [{
      id: "estado-civil-madre",
      type: "bar",
      data: datos.map((fila) => fila.nacimientos),
      barMaxWidth: 24,
      itemStyle: { color: COLORES_TEMA.nacimientos, borderRadius: [0, 5, 5, 0] },
      label: etiqueta(entero, { position: "right" }),
      emphasis: { focus: "self" },
    }],
  }), [categorias, datos, maximo, porCategoria, total]);

  const nombreIndicador = INDICADORES.find((opcion) => opcion.valor === indicador)?.etiqueta;

  return (
    <Tarjeta
      titulo={`Nacimientos por ${nombreIndicador.toLowerCase()} de la madre`}
      ayuda={indicador === "conyugal"
        ? "El estado conyugal mantiene separadas las categorías de pareja según la duración de la unión."
        : "El estado civil agrupa las dos categorías de pareja como Unión libre."}
      cargando={cargando && filas.length === 0}
      error={error}
    >
      <label className="selector-grafico">
        <span>Indicador</span>
        <select value={indicador} onChange={(evento) => setIndicador(evento.target.value)}>
          {INDICADORES.map((opcionIndicador) => (
            <option key={opcionIndicador.valor} value={opcionIndicador.valor}>{opcionIndicador.etiqueta}</option>
          ))}
        </select>
      </label>
      {datos.length === 0 && !cargando ? <Vacio>No hay nacimientos para estos filtros.</Vacio> : null}
      {datos.length > 0 ? <Grafico opcion={opcion} cargando={cargando} /> : null}
    </Tarjeta>
  );
}
