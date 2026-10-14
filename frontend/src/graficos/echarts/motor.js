import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, CustomChart, HeatmapChart, LineChart, MapChart, ScatterChart } from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  BoxplotChart,
  CustomChart,
  LineChart,
  MapChart,
  HeatmapChart,
  ScatterChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

export const TEMA = "macarons";

export const PALETA = [
  "#2ec7c9",
  "#b6a2de",
  "#5ab1ef",
  "#ffb980",
  "#d87a80",
  "#8d98b3",
  "#e5cf0d",
  "#97b552",
  "#95706d",
  "#dc69aa",
];

export const COLORES_TEMA = {
  nacimientos: "#2ec7c9",
  defunciones: "#d87a80",
  relacion: "#ffb980",
  hombres: "#5ab1ef",
  mujeres: "#dc69aa",
  gris: "#8d98b3",
  suave: "#f3c6c9",
  lila: "#b6a2de",
  tinta: "#008acd",
  texto: "#0f172a",
  linea: "#eeeeee",
};

export const ESCALA_TGF = {
  cortes: [0.8, 0.9, 1, 1.2, 1.5],
  colores: ["#b5545c", "#d87a80", "#f3c6c9", "#b9eced", "#5fd3d4", "#1f9a9c"],
};

export const ESCALA_RIESGO = ["#fdf0d5", "#fdd9a8", "#ffb980", "#f0968a", "#d87a80", "#b5545c", "#7f2f3a"];

echarts.registerTheme(TEMA, {
  color: PALETA,
  title: { textStyle: { fontWeight: "normal", color: COLORES_TEMA.tinta } },
  tooltip: {
    borderWidth: 0,
    backgroundColor: "rgba(50,50,50,0.5)",
    textStyle: { color: "#fff" },
    axisPointer: {
      type: "line",
      lineStyle: { color: COLORES_TEMA.tinta },
      shadowStyle: { color: "rgba(200,200,200,0.2)" },
    },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: COLORES_TEMA.tinta } },
    splitLine: { lineStyle: { color: [COLORES_TEMA.linea] } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: COLORES_TEMA.tinta } },
    splitArea: {
      show: true,
      areaStyle: { color: ["rgba(250,250,250,0.1)", "rgba(200,200,200,0.1)"] },
    },
    splitLine: { lineStyle: { color: [COLORES_TEMA.linea] } },
  },
  line: { smooth: false, symbol: "emptyCircle", symbolSize: 4 },
  graph: { itemStyle: { color: "#d87a80" }, linkStyle: { color: "#2ec7c9" } },
});

export { echarts };
