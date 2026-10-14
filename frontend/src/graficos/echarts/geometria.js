import { useEffect, useState } from "react";
import { echarts } from "@/graficos/echarts/motor";
import { FUENTE } from "@/graficos/echarts/opciones";

let geometriaPromesa;

export function cargarGeometria() {
  if (!geometriaPromesa) {
    geometriaPromesa = Promise.all(
      ["departamentos", "municipios"].map(async (nombre) => {
        const respuesta = await fetch(`${import.meta.env.BASE_URL}mapas/${nombre}.geojson`);
        if (!respuesta.ok) throw new Error(`No se pudo leer el mapa de ${nombre}.`);
        return respuesta.json();
      }),
    ).then(([departamentos, municipios]) => ({ departamentos, municipios }));
  }
  return geometriaPromesa;
}

export function useGeometria() {
  const [estado, setEstado] = useState({ capas: null, error: "" });

  useEffect(() => {
    let activo = true;
    cargarGeometria()
      .then((capas) => {
        if (activo) setEstado({ capas, error: "" });
      })
      .catch((error) => {
        if (activo) setEstado({ capas: null, error: error.message });
      });
    return () => {
      activo = false;
    };
  }, []);

  return estado;
}

export function recortar(capas, filtros, municipios, { municipal = false, soloDepartamentos = false } = {}) {
  if (soloDepartamentos) return capas.departamentos;
  if (filtros.municipio !== "Todos") {
    const codigo = filtros.municipio.split("|")[1];
    return {
      type: "FeatureCollection",
      features: capas.municipios.features.filter((feature) => feature.properties.codigo === codigo),
    };
  }
  if (filtros.departamento !== "Todos") {
    const departamento = municipios.find((fila) => fila.departamento === filtros.departamento)?.cod_departamento;
    return {
      type: "FeatureCollection",
      features: capas.municipios.features.filter((feature) => feature.properties.departamento === departamento),
    };
  }
  return municipal ? capas.municipios : capas.departamentos;
}

export const RECUADRO = "recuadro-88";

const ISLA_DEPARTAMENTO = { left: -78.72, top: 10.75, width: 0.7 };
const ISLAS_MUNICIPIO = {
  88001: { left: -78.9, top: 10.62, width: 0.48 },
  88564: { left: -78.28, top: 10.62, width: 0.4 },
};
const MARCO = [
  [-79.0, 10.5],
  [-77.75, 10.5],
  [-77.75, 12.35],
  [-79.0, 12.35],
  [-79.0, 10.5],
];

function esIsla(feature) {
  return feature.properties.codigo === "88" || feature.properties.departamento === "88";
}

function conRecuadro(coleccion) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { codigo: RECUADRO },
        geometry: { type: "Polygon", coordinates: [MARCO] },
      },
      ...coleccion.features,
    ],
  };
}

export function registrarMapa(nombre, coleccion) {
  const islas = coleccion.features.filter(esIsla);
  const hayContinente = coleccion.features.some((feature) => !esIsla(feature));
  const insertar = islas.length > 0 && hayContinente;
  const geometria = insertar ? conRecuadro(coleccion) : coleccion;
  const specialAreas = {};
  if (insertar) {
    for (const feature of islas) {
      const codigo = String(feature.properties.codigo);
      specialAreas[codigo] =
        codigo === "88" ? ISLA_DEPARTAMENTO : (ISLAS_MUNICIPIO[codigo] ?? ISLA_DEPARTAMENTO);
    }
  }
  echarts.registerMap(nombre, {
    geoJSON: geometria,
    specialAreas: insertar ? specialAreas : undefined,
  });
  return {
    geometria,
    insertar,
    islas: islas.map((feature) => String(feature.properties.codigo)),
  };
}

export function datoRecuadro() {
  return {
    name: RECUADRO,
    value: null,
    label: { show: false },
    tooltip: { show: false },
    itemStyle: { areaColor: "#ffffff", borderColor: "#94a3b8", borderWidth: 1 },
    emphasis: { disabled: true },
  };
}

export function tooltipMapa(formatter) {
  return {
    trigger: "item",
    borderWidth: 0,
    backgroundColor: "rgba(50, 50, 50, 0.55)",
    textStyle: { fontFamily: FUENTE, color: "#fff", fontSize: 12 },
    formatter: (params) => (params.name === RECUADRO ? "" : formatter(params)),
  };
}

export function serieMapa(nombre, datos, extra = {}) {
  return {
    id: "mapa",
    type: "map",
    map: nombre,
    nameProperty: "codigo",
    roam: true,
    selectedMode: false,
    aspectScale: 1,
    layoutCenter: ["50%", "50%"],
    layoutSize: "95%",
    itemStyle: { areaColor: "#E2E8F0", borderColor: "#94a3b8", borderWidth: 0.6 },
    emphasis: {
      label: { show: false },
      itemStyle: { borderColor: "#0f172a", borderWidth: 1.2 },
    },
    data: datos,
    ...extra,
  };
}
