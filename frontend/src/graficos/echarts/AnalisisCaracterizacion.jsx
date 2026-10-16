import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { sqlCaracterizacion } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, etiqueta, leyenda, tooltip } from "@/graficos/echarts/opciones";

const MULTIPLICIDAD = ["Simple", "Doble", "Trillizos", "Cuatrillizos o más", "Sin información"];
const GRUPOS = ["A", "B", "AB", "O"];
const HISTORIA = ["1", "2", "3", "4", "5 o más"];
const EDADES = ["10-14 años", "15-19 años", "20-24 años", "25-29 años", "30-34 años", "35-39 años", "40-44 años", "45-49 años", "50-54 años"];
const CONSULTAS = ["0", "1-3", "4-6", "7-9", "10 o más"];

function useCorte(dimension) {
  const { filtros } = useFiltros();
  return useConsulta(sqlCaracterizacion(filtros, dimension));
}

function Marco({ dimension, titulo, ayuda, children }) {
  const { filas, cargando, error } = useCorte(dimension);
  return <Tarjeta titulo={titulo} ayuda={ayuda} cargando={cargando && filas.length === 0} error={error}>
    {!cargando && !error && filas.length === 0 ? <Vacio>No hay nacimientos para estos filtros.</Vacio> : null}
    {filas.length ? children(filas) : null}
  </Tarjeta>;
}

export function NacimientosPorMultiplicidad() {
  return <Marco dimension="multiplicidad" titulo="Nacimientos según cantidad de hijos por embarazo" ayuda="La multiplicidad indica si el embarazo fue simple, doble, de trillizos o de cuatrillizos o más.">
    {(filas) => {
      const conteo = new Map(filas.map((f) => [f.categoria, f.nacimientos]));
      const datos = MULTIPLICIDAD.map((categoria) => conteo.get(categoria) || 0);
      const opcion = { tooltip: tooltip(), grid: { top: 18, right: 18, bottom: 42, left: 58 }, xAxis: ejeCategoria(MULTIPLICIDAD, { axisLabel: { interval: 0 } }), yAxis: ejeValor(Math.max(...datos)), series: [{ id: "nacimientos-multiplicidad", type: "bar", data: datos, itemStyle: { color: COLORES_TEMA.nacimientos, borderRadius: [4, 4, 0, 0] }, label: etiqueta(entero, { position: "top" }), labelLayout: { hideOverlap: true } }] };
      return <Grafico opcion={opcion} />;
    }}
  </Marco>;
}

export function Hemoclasificacion() {
  return <Marco dimension="hemoclasificacion" titulo="Grupo sanguíneo y factor RH" ayuda="Hemoclasificación reportada para el nacido vivo. Las categorías sin información se conservan para mostrar la cobertura del dato.">
    {(filas) => {
      const lookup = new Map(filas.map((f) => [`${f.categoria}|${f.subcategoria}`, f.nacimientos]));
      const categorias = GRUPOS.flatMap((g) => [
        { nombre: `${g}+`, grupo: g, rh: "Positivo" },
        { nombre: `${g}−`, grupo: g, rh: "Negativo" },
      ]);
      const sinInformacion = filas.reduce((suma, f) => suma + (f.categoria === "Sin información" || f.subcategoria === "Sin información" ? f.nacimientos : 0), 0);
      const datos = [...categorias.map((c) => lookup.get(`${c.grupo}|${c.rh}`) || 0), sinInformacion];
      const orden = categorias.map((c, i) => ({ ...c, valor: datos[i] })).sort((a, b) => b.valor - a.valor);
      orden.push({ nombre: "Sin información", valor: sinInformacion });
      orden.sort((a, b) => b.valor - a.valor);
      const opcion = { tooltip: tooltip(), grid: { top: 18, right: 16, bottom: 48, left: 56 }, xAxis: ejeCategoria(orden.map((c) => c.nombre), { axisLabel: { rotate: 35, interval: 0 } }), yAxis: ejeValor(Math.max(1, ...orden.map((c) => c.valor))), series: [{ id: "hemoclasificacion", type: "bar", data: orden.map((c) => c.valor), itemStyle: { color: COLORES_TEMA.nacimientos, borderRadius: [4, 4, 0, 0] }, label: etiqueta(entero, { position: "top" }), labelLayout: { hideOverlap: true } }] };
      return <Grafico opcion={opcion} />;
    }}
  </Marco>;
}

export function HistoriaReproductiva() {
  const { filtros } = useFiltros();
  const { filas, cargando, error } = useConsulta(sqlCaracterizacion(filtros, "historia_reproductiva"));
  const opcion = useMemo(() => {
    const lookup = new Map(filas.map((f) => [`${f.categoria}|${f.subcategoria}`, f.nacimientos]));
    const totales = HISTORIA.map((embarazos) => HISTORIA.reduce((suma, hijos) => suma + (lookup.get(`${embarazos}|${hijos}`) || 0), 0));
    const colores = [COLORES_TEMA.nacimientos, "#F59E0B", "#38BDF8", "#A855F7", "#9F1239"];
    const series = HISTORIA.map((hijos, j) => ({
      id: `hijos-vivos-${j}`, name: hijos, type: "bar", stack: "total",
      data: HISTORIA.map((embarazos, i) => {
        const valor = lookup.get(`${embarazos}|${hijos}`) || 0;
        return totales[i] ? 100 * valor / totales[i] : 0;
      }),
      itemStyle: { color: colores[j] },
      emphasis: { focus: "series" },
    }));
    return {
      tooltip: tooltip(decimal, {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (items) => {
          const { axisValue, dataIndex } = items[0];
          const lineas = [`<strong>${axisValue} embarazo(s)</strong>`];
          for (const item of items) {
            const cuenta = lookup.get(`${axisValue}|${item.seriesName}`) || 0;
            lineas.push(`${item.marker}${item.seriesName} hijo(s): ${decimal(item.value)}% (${entero(cuenta)})`);
          }
          lineas.push(`Total del grupo: ${entero(totales[dataIndex])}`);
          return lineas.join("<br/>");
        },
      }),
      legend: leyenda(),
      grid: { top: 34, right: 14, bottom: 28, left: 54 },
      xAxis: ejeValor(100, { min: 0, max: 100, interval: 25, axisLabel: { formatter: "{value}%" } }),
      yAxis: ejeCategoria(HISTORIA, { inverse: true }),
      series,
    };
  }, [filas]);
  return <Tarjeta titulo="Embarazos e hijos nacidos vivos" ayuda="Barras apiladas al 100%: cada fila muestra cómo se distribuyen los hijos nacidos vivos en el grupo de número de embarazos. Ambos conteos incluyen el nacimiento actual; los valores 99 sin información se excluyen, y cinco o más se agrupan. El cruce no identifica por sí solo pérdidas gestacionales." cargando={cargando && filas.length === 0} error={error}>{!cargando && !error && !filas.length ? <Vacio>No hay nacimientos para estos filtros.</Vacio> : null}{filas.length ? <Grafico opcion={opcion} /> : null}</Tarjeta>;
}

export function ControlesPrenatalesEdad() {
  return <Marco dimension="controles_prenatales" titulo="Controles prenatales por edad de la madre" ayuda="Participación porcentual de nacimientos con número de consultas reportado, dentro de cada grupo de edad. Se excluyen los casos sin información.">
    {(filas) => {
      const lookup = new Map(filas.map((f) => [`${f.categoria}|${f.subcategoria}`, f.nacimientos]));
      const totales = EDADES.map((edad) => CONSULTAS.reduce((s, c) => s + (lookup.get(`${edad}|${c}`) || 0), 0));
      const series = CONSULTAS.map((consulta, j) => ({ id: `consultas-${j}`, name: consulta, type: "bar", stack: "total", emphasis: { focus: "series" }, data: EDADES.map((edad, i) => { const valor = lookup.get(`${edad}|${consulta}`) || 0; return totales[i] ? 100 * valor / totales[i] : 0; }), itemStyle: { color: [COLORES_TEMA.nacimientos, "#0EA5A4", "#38BDF8", "#F59E0B", "#9F1239"][j] } }));
      const opcion = { tooltip: tooltip(decimal, { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => `${decimal(v)}%` }), legend: leyenda(), grid: { top: 48, right: 16, bottom: 58, left: 48 }, xAxis: ejeCategoria(EDADES, { axisLabel: { rotate: 35, interval: 0 } }), yAxis: ejeValor(100, { min: 0, max: 100, interval: 25, axisLabel: { formatter: "{value}%" } }), series };
      return <Grafico opcion={opcion} />;
    }}
  </Marco>;
}
