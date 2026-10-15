import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { literal } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { decimal, decimal2, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { COLORES_TEMA } from "@/graficos/echarts/motor";
import { ejeCategoria, ejeValor, tooltip } from "@/graficos/echarts/opciones";

function whereDepartamento(filtros, alias = "f") {
  if (!filtros.departamento || filtros.departamento === "Todos") return "TRUE";
  const nombre = literal(filtros.departamento);
  return `(${alias}.departamento_ocurrencia = ${nombre} OR ${alias}.departamento_residencia = ${nombre})`;
}

function sqlRutas(filtros) {
  return `
    SELECT departamento_residencia, departamento_ocurrencia,
           SUM(nacimientos)::DOUBLE AS nacimientos
    FROM flujos_nacimientos f
    WHERE cod_residencia <> cod_ocurrencia AND ${whereDepartamento(filtros)}
    GROUP BY 1, 2 ORDER BY nacimientos DESC LIMIT 15
  `;
}

export function RutasFlujos({ filtros }) {
  const { filas, cargando, error } = useConsulta(sqlRutas(filtros));
  const opcion = useMemo(() => {
    const datos = [...filas].reverse();
    return {
      grid: { left: 165, right: 25, top: 10, bottom: 25 },
      tooltip: tooltip(entero),
      xAxis: ejeValor(Math.max(0, ...filas.map((fila) => fila.nacimientos))),
      yAxis: ejeCategoria(datos.map((fila) => `${fila.departamento_residencia} → ${fila.departamento_ocurrencia}`), { axisLabel: { width: 152, overflow: "truncate", fontSize: 10 } }),
      series: [{
        type: "bar",
        data: datos.map((fila) => ({
          value: fila.nacimientos,
          itemStyle: {
            color: filtros.departamento !== "Todos" && fila.departamento_residencia === filtros.departamento
              ? COLORES_TEMA.defunciones
              : COLORES_TEMA.nacimientos,
          },
        })),
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18,
      }],
    };
  }, [filas, filtros.departamento]);
  return <Tarjeta titulo="Principales rutas de residencia a ocurrencia" ayuda="Quince rutas interdepartamentales con más nacimientos. Al seleccionar un departamento, verde indica que recibe esos nacimientos y rojo que sus residentes paren fuera." cargando={cargando} error={error}>
    {!cargando && !error && filas.length ? <Grafico opcion={opcion} /> : null}
    {!cargando && !error && !filas.length ? <Vacio>No hay rutas entre departamentos con estos filtros.</Vacio> : null}
  </Tarjeta>;
}

function sqlHeatmap(filtros) {
  return `
    WITH totales AS (
      SELECT cod_residencia, SUM(nacimientos)::DOUBLE AS total_residentes
      FROM flujos_nacimientos GROUP BY cod_residencia
    )
    SELECT f.departamento_residencia, f.departamento_ocurrencia,
           f.nacimientos::DOUBLE / NULLIF(t.total_residentes, 0) AS porcentaje,
           f.nacimientos::DOUBLE AS nacimientos,
           t.total_residentes
    FROM flujos_nacimientos f
    JOIN totales t ON t.cod_residencia = f.cod_residencia
    WHERE f.cod_residencia <> f.cod_ocurrencia AND ${whereDepartamento(filtros)}
  `;
}

export function HeatmapFlujos({ filtros }) {
  const { filas, cargando, error } = useConsulta(sqlHeatmap(filtros));
  const opcion = useMemo(() => {
    const residencias = [...new Set(filas.map((fila) => fila.departamento_residencia))].sort((a, b) => a.localeCompare(b, "es"));
    const ocurrencias = [...new Set(filas.map((fila) => fila.departamento_ocurrencia))].sort((a, b) => a.localeCompare(b, "es"));
    const x = new Map(residencias.map((nombre, indice) => [nombre, indice]));
    const y = new Map(ocurrencias.map((nombre, indice) => [nombre, indice]));
    const celdas = filas.map((fila) => [x.get(fila.departamento_residencia), y.get(fila.departamento_ocurrencia), fila.porcentaje, fila.nacimientos, fila.total_residentes]);
    const maximo = Math.max(0.0001, ...filas.map((fila) => fila.porcentaje));
    return {
      grid: { left: 100, right: 12, top: 10, bottom: 90 },
      tooltip: { ...tooltip(decimal, { trigger: "item" }), formatter: (p) => {
        const [xi, yi, pct, nacimientos, total] = p.value;
        return `<strong>${ocurrencias[yi]} ← ${residencias[xi]}</strong><br/>${decimal(100 * pct)}% de residentes<br/>${entero(nacimientos)} de ${entero(total)} nacimientos fuera`;
      } },
      xAxis: ejeCategoria(residencias, { axisLabel: { interval: 0, rotate: 55, fontSize: 8, width: 84, overflow: "truncate" } }),
      yAxis: ejeCategoria(ocurrencias, { axisLabel: { interval: 0, fontSize: 8, width: 86, overflow: "truncate" } }),
      visualMap: { dimension: 2, min: 0, max: maximo, formatter: (valor) => `${decimal2(100 * valor)}%`, calculable: false, orient: "horizontal", left: "center", bottom: 2, itemWidth: 12, itemHeight: 100, text: ["Mayor", "Menor"], inRange: { color: ["#eff6ff", "#93c5fd", "#2563eb", "#172554"] } },
      series: [{ type: "heatmap", data: celdas, progressive: 0, itemStyle: { borderColor: "#64748b", borderWidth: 1.2 }, emphasis: { itemStyle: { borderColor: "#0f172a", borderWidth: 2 } } }],
    };
  }, [filas]);
  return <Tarjeta titulo="Porcentaje de residentes que paren fuera" ayuda="La matriz muestra valores relativos: cada celda representa el porcentaje de todos los nacimientos de residentes de esa fila que ocurrió en otro departamento. Se excluye la diagonal." cargando={cargando} error={error}>
    {!cargando && !error && filas.length ? <Grafico opcion={opcion} /> : null}
    {!cargando && !error && !filas.length ? <Vacio>No hay flujos entre departamentos con estos filtros.</Vacio> : null}
  </Tarjeta>;
}

function sqlSistema(filtros) {
  return `
    WITH residentes AS (
      SELECT cod_residencia AS codigo, departamento_residencia AS departamento,
             MAX(nacimientos_residencia)::DOUBLE AS total_residentes,
             MAX(nacimientos_fuera_residencia)::DOUBLE AS expulsan
      FROM flujos_nacimientos GROUP BY 1, 2
    ),
    ocurrencias AS (
      SELECT cod_ocurrencia AS codigo, departamento_ocurrencia AS departamento,
             MAX(nacimientos_ocurrencia)::DOUBLE AS atendidos,
             SUM(CASE WHEN cod_ocurrencia <> cod_residencia THEN nacimientos ELSE 0 END)::DOUBLE AS atraen,
             COUNT(DISTINCT cod_residencia) FILTER (WHERE cod_ocurrencia <> cod_residencia) AS deptos_atendidos
      FROM flujos_nacimientos GROUP BY 1, 2
    )
    SELECT COALESCE(o.codigo, r.codigo) AS codigo,
           COALESCE(o.departamento, r.departamento) AS departamento,
           COALESCE(o.atendidos, 0)::DOUBLE AS atendidos,
           COALESCE(o.atraen, 0)::DOUBLE AS atraen,
           COALESCE(r.expulsan, 0)::DOUBLE AS expulsan,
           COALESCE(o.atraen, 0)::DOUBLE - COALESCE(r.expulsan, 0)::DOUBLE AS saldo,
           COALESCE(o.deptos_atendidos, 0)::DOUBLE AS deptos_atendidos
    FROM ocurrencias o FULL OUTER JOIN residentes r ON o.codigo = r.codigo
    WHERE ${filtros.departamento && filtros.departamento !== "Todos" ? `COALESCE(o.departamento, r.departamento) = ${literal(filtros.departamento)}` : "TRUE"}
  `;
}

export function ScatterFlujos({ filtros }) {
  const { filas, cargando, error } = useConsulta(sqlSistema(filtros));
  const opcion = useMemo(() => {
    const datos = filas.map((fila) => ({
      name: fila.departamento,
      value: [fila.atraen, fila.expulsan, fila.atendidos, fila.saldo],
    }));
    return {
      grid: { left: 58, right: 18, top: 15, bottom: 52 },
      tooltip: { trigger: "item", formatter: (p) => {
        const [atraen, expulsan, atendidos, saldo] = p.value;
        return `<strong>${p.name}</strong><br/>Recibidos: ${entero(atraen)}<br/>Residentes que salen: ${entero(expulsan)}<br/>Atendidos totales: ${entero(atendidos)}<br/>Saldo neto: ${saldo > 0 ? "+" : ""}${entero(saldo)}`;
      } },
      xAxis: ejeValor(Math.max(0, ...filas.map((fila) => fila.atraen)), { name: "Partos recibidos de otros", nameLocation: "middle", nameGap: 30, nameTextStyle: { color: COLORES_TEMA.texto }, axisLabel: { formatter: entero, color: COLORES_TEMA.texto } }),
      yAxis: ejeValor(Math.max(0, ...filas.map((fila) => fila.expulsan)), { name: "Residentes que paren fuera", nameLocation: "middle", nameGap: 42, nameTextStyle: { color: COLORES_TEMA.texto }, axisLabel: { formatter: entero, color: COLORES_TEMA.texto } }),
      series: [{ type: "scatter", data: datos, symbolSize: (value) => Math.max(12, Math.min(42, Math.sqrt(value[2]) / 16)), itemStyle: { color: ({ value }) => value[3] > 0 ? COLORES_TEMA.nacimientos : COLORES_TEMA.defunciones, opacity: 1, borderColor: "#334155", borderWidth: 1.5 }, emphasis: { focus: "self", itemStyle: { borderColor: "#0f172a", borderWidth: 2.5 }, label: { show: true, formatter: ({ data }) => data.name, position: "top", fontSize: 10, color: COLORES_TEMA.texto } } }],
    };
  }, [filas]);
  return <Tarjeta titulo="Atracción y expulsión de partos" ayuda="El eje horizontal cuenta nacimientos recibidos desde otros departamentos; el vertical, nacimientos de residentes atendidos fuera. El tamaño representa los nacimientos atendidos y el color el saldo neto." cargando={cargando} error={error}>
    {!cargando && !error && filas.length ? <Grafico opcion={opcion} /> : null}
    {!cargando && !error && !filas.length ? <Vacio>No hay datos para este territorio.</Vacio> : null}
  </Tarjeta>;
}

export function RankingCapitales({ filtros }) {
  const { filas, cargando, error } = useConsulta(sqlSistema(filtros));
  const opcion = useMemo(() => {
    const datos = [...filas].sort((a, b) => a.atraen - b.atraen).slice(-15);
    return {
      grid: { left: 112, right: 34, top: 12, bottom: 24 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (params) => {
        const fila = datos[params[0]?.dataIndex];
        return fila ? `<strong>${fila.departamento}</strong><br/>Recibidos de otros: ${entero(fila.atraen)}<br/>Departamentos de residencia: ${entero(fila.deptos_atendidos)}` : "";
      } },
      xAxis: ejeValor(Math.max(0, ...datos.map((fila) => fila.atraen))),
      yAxis: ejeCategoria(datos.map((fila) => fila.departamento), { axisLabel: { width: 102, overflow: "truncate" } }),
      series: [{ type: "bar", data: datos.map((fila) => fila.atraen), itemStyle: { color: COLORES_TEMA.nacimientos, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 18 }],
    };
  }, [filas]);
  return <Tarjeta titulo="Departamentos receptores" ayuda="Ranking de departamentos por nacimientos recibidos desde otras residencias. El detalle indica cuántos departamentos aportan esos nacimientos." cargando={cargando} error={error}>
    {!cargando && !error && filas.length ? <Grafico opcion={opcion} /> : null}
    {!cargando && !error && !filas.length ? <Vacio>No hay datos para este territorio.</Vacio> : null}
  </Tarjeta>;
}
