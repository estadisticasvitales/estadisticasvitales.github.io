import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { useDatos } from "@/datos/DatosProvider";
import { useFiltros } from "@/estado/FiltrosProvider";
import { decimal, entero } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import {
  datoRecuadro,
  recortar,
  RECUADRO,
  registrarMapa,
  serieMapa,
  tooltipMapa,
  useGeometria,
} from "@/graficos/echarts/geometria";

const SIN_DATO = "#E2E8F0";

function escapar(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function cuantiles(valores, clases) {
  const orden = [...valores].sort((a, b) => a - b);
  const cortes = [];
  for (let indice = 1; indice < clases; indice += 1) {
    const corte = orden[Math.min(orden.length - 1, Math.floor((indice * orden.length) / clases))];
    if (!cortes.length || corte > cortes[cortes.length - 1]) cortes.push(corte);
  }
  return cortes;
}

function rangos(cortes, colores, formato) {
  return colores.slice(0, cortes.length + 1).map((color, indice) => {
    const desde = cortes[indice - 1];
    const hasta = cortes[indice];
    let texto;
    if (desde == null) texto = `< ${formato(hasta)}`;
    else if (hasta == null) texto = `≥ ${formato(desde)}`;
    else texto = `${formato(desde)} – ${formato(hasta)}`;
    return { color, texto };
  });
}

function claseDe(valor, cortes) {
  let indice = 0;
  while (indice < cortes.length && valor >= cortes[indice]) indice += 1;
  return indice;
}

export function MapaCoropletas({
  titulo,
  ayuda,
  sql,
  municipal = false,
  ignorarMunicipio = false,
  soloDepartamentos = false,
  colores,
  cortes,
  divergente = false,
  formato = decimal,
  unidad = "",
  hechoEtiqueta = "Hechos",
}) {
  const { filtros } = useFiltros();
  const { catalogos } = useDatos();
  const { capas, error: errorMapa } = useGeometria();
  const { filas, cargando, error } = useConsulta(sql);
  const filtrosMapa = ignorarMunicipio ? { ...filtros, municipio: "Todos" } : filtros;
  const coleccion = useMemo(
    () => (capas ? recortar(capas, filtrosMapa, catalogos.municipios, { municipal, soloDepartamentos }) : null),
    [capas, catalogos.municipios, filtrosMapa, municipal, soloDepartamentos],
  );
  const nombreMapa = `coropletas-${municipal ? "mun" : "dep"}-${filtros.departamento}-${filtrosMapa.municipio}`;

  const escala = useMemo(() => {
    const valores = filas.map((fila) => fila.valor).filter((valor) => Number.isFinite(valor));
    const maximoAbsoluto = Math.max(0, ...valores.map((valor) => Math.abs(valor)));
    const limites = cortes ?? (divergente && maximoAbsoluto
      ? [-maximoAbsoluto * 0.4, -maximoAbsoluto * 0.025, maximoAbsoluto * 0.025, maximoAbsoluto * 0.4]
      : valores.length ? cuantiles(valores, colores.length) : []);
    const paleta = divergente
      ? colores
      : cortes || limites.length + 1 === colores.length
        ? colores
        : colores.slice(colores.length - limites.length - 1);
    return { cortes: limites, colores: paleta, rangos: rangos(limites, paleta, formato) };
  }, [colores, cortes, divergente, filas, formato]);

  const opcion = useMemo(() => {
    if (!coleccion || coleccion.features.length === 0) return null;
    const { geometria } = registrarMapa(nombreMapa, coleccion);
    const porCodigo = new Map(filas.map((fila) => [String(fila.codigo), fila]));
    const colorDe = (valor) =>
      valor == null || !Number.isFinite(valor) ? SIN_DATO : escala.colores[claseDe(valor, escala.cortes)];
    const datos = geometria.features.map((feature) => {
      const codigo = String(feature.properties.codigo);
      if (codigo === RECUADRO) return datoRecuadro();
      const valor = porCodigo.get(codigo)?.valor ?? null;
      const tinta = colorDe(valor);
      return {
        name: codigo,
        value: valor,
        itemStyle: { areaColor: tinta },
        emphasis: { itemStyle: { areaColor: tinta } },
      };
    });
    return {
      backgroundColor: "#ffffff",
      tooltip: tooltipMapa((params) => {
        const fila = porCodigo.get(String(params.name));
        if (!fila) return "Sin tasa";
        const lugar = fila.detalle ? `<br/>${escapar(fila.detalle)}` : "";
        const hechos = Number.isFinite(fila.hechos) ? `<br/>${hechoEtiqueta}: ${entero(fila.hechos)}` : "";
        const tasa = fila.valor == null ? "—" : formato(fila.valor);
        return `<strong>${escapar(fila.nombre)}</strong>${lugar}${hechos}<br/>${unidad || "Tasa"}: ${tasa}`;
      }),
      series: [serieMapa(nombreMapa, datos)],
    };
  }, [coleccion, escala, filas, formato, hechoEtiqueta, nombreMapa, unidad]);

  const fallo = error || errorMapa;
  const listo = !cargando && Boolean(coleccion) && !fallo;

  return (
    <Tarjeta titulo={titulo} ayuda={ayuda} cargando={!listo && !fallo} error={fallo}>
      {listo && coleccion.features.length === 0 ? <Vacio>No hay geometría para este territorio.</Vacio> : null}
      {listo && opcion ? (
        <div className="marco-mapa">
          <Grafico key={nombreMapa} opcion={opcion} cargando={cargando} />
          <div className="leyenda leyenda-clases">
            {escala.rangos.map((rango) => (
              <span key={rango.texto} className="leyenda-clase">
                <span className="leyenda-muestra" style={{ background: rango.color }} />
                {rango.texto}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Tarjeta>
  );
}
