import { useEffect, useMemo } from "react";
import { Buscador } from "@/componentes/Buscador";
import { CAUSAS_EXTERNAS, whereTerritorio } from "@/datos/consultas";
import { useConsulta } from "@/datos/useConsulta";
import { useDatos } from "@/datos/DatosProvider";
import { useFiltros } from "@/estado/FiltrosProvider";

export function BarraLateral({ pagina }) {
  const { catalogos } = useDatos();
  const { filtros, actualizar, reiniciar } = useFiltros();
  const consultaCausas =
    pagina === "causas"
      ? `
        SELECT cod_causa, MAX(causa) AS causa
        FROM causas
        WHERE ${whereTerritorio(filtros)}
        GROUP BY cod_causa
        HAVING SUM(defunciones) > 0
        ORDER BY SUM(defunciones) DESC
      `
      : "";
  const { filas: causasDisponibles, cargando: cargandoCausas, error: errorCausas } =
    useConsulta(consultaCausas);

  const anios = useMemo(
    () => (pagina === "intervalos" ? catalogos.aniosIntervalos : pagina === "flujos" ? [2025] : catalogos.anios)
      .map((anio) => ({ valor: String(anio), etiqueta: String(anio) })),
    [catalogos.anios, catalogos.aniosIntervalos, pagina],
  );

  const departamentos = useMemo(
    () => catalogos.departamentos.map((nombre) => ({ valor: nombre, etiqueta: nombre })),
    [catalogos.departamentos],
  );

  const municipios = useMemo(
    () =>
      catalogos.municipios
        .filter(
          (fila) => filtros.departamento === "Todos" || fila.departamento === filtros.departamento,
        )
        .map((fila) => ({
          valor: `${fila.cod_departamento}|${fila.cod_municipio}`,
          etiqueta:
            filtros.departamento === "Todos"
              ? `${fila.municipio} · ${fila.departamento}`
              : fila.municipio,
        })),
    [catalogos.municipios, filtros.departamento],
  );

  const causas = useMemo(
    () =>
      causasDisponibles.map((fila) => ({
        valor: String(fila.cod_causa),
        etiqueta: String(fila.causa),
      })),
    [causasDisponibles],
  );

  useEffect(() => {
    if (pagina !== "causas" || cargandoCausas || errorCausas) return;
    if (filtros.causa === "Todas") return;
    const sigue = causasDisponibles.some((fila) => String(fila.cod_causa) === filtros.causa);
    if (!sigue) actualizar("causa", "Todas");
  }, [actualizar, cargandoCausas, causasDisponibles, errorCausas, filtros.causa, pagina]);

  useEffect(() => {
    if (pagina !== "intervalos" || !catalogos.aniosIntervalos.length) return;
    const anioActual = Number(filtros.anio);
    if (!catalogos.aniosIntervalos.includes(anioActual)) {
      actualizar("anio", String(catalogos.aniosIntervalos[0]));
    }
  }, [actualizar, catalogos.aniosIntervalos, filtros.anio, pagina]);

  useEffect(() => {
    if (pagina === "flujos" && filtros.anio !== "2025") actualizar("anio", "2025");
  }, [actualizar, filtros.anio, pagina]);

  const hayFiltros =
    filtros.departamento !== "Todos" ||
    (pagina !== "intervalos" && pagina !== "flujos" && filtros.municipio !== "Todos") ||
    (pagina === "causas" && filtros.causa !== "Todas") ||
    (pagina === "externas" && filtros.externa !== "Todas") ||
    (pagina === "intervalos" &&
      [filtros.edadMadre, filtros.nivelEducativo, filtros.regimen, filtros.tipoParto].some(
        (valor) => valor !== "Todos",
      ));

  return (
    <aside className="barra">
      <div className="barra-cabecera">
        <span className="barra-icono" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />
          </svg>
        </span>
        <div>
          <h2 className="barra-titulo">Filtros</h2>
          <p className="nota">
            Para información más detallada:
          </p>
        </div>
      </div>
      <Buscador
        etiqueta="Año"
        buscar={false}
        valor={String(filtros.anio)}
        vacioValor="Todos"
        vacioEtiqueta="Todos"
        opciones={anios}
        alElegir={(siguiente) => actualizar("anio", siguiente)}
      />
      <Buscador
        etiqueta="Departamento"
        valor={filtros.departamento}
        vacioValor="Todos"
        vacioEtiqueta="Todos"
        opciones={departamentos}
        alElegir={(siguiente) => actualizar("departamento", siguiente)}
      />
      {pagina !== "intervalos" && pagina !== "flujos" ? (
        <Buscador
          etiqueta="Municipio"
          valor={filtros.municipio}
          vacioValor="Todos"
          vacioEtiqueta="Todos"
          opciones={municipios}
          alElegir={(siguiente) => actualizar("municipio", siguiente)}
        />
      ) : null}
      {pagina === "intervalos" ? (
        <>
          <Buscador
            etiqueta="Edad de la madre"
            valor={filtros.edadMadre}
            vacioValor="Todos"
            vacioEtiqueta="Todas"
            opciones={catalogos.filtrosIntervalos.edadMadre.map((valor) => ({ valor, etiqueta: valor }))}
            alElegir={(siguiente) => actualizar("edadMadre", siguiente)}
          />
          <Buscador
            etiqueta="Educación de la madre"
            valor={filtros.nivelEducativo}
            vacioValor="Todos"
            vacioEtiqueta="Todos los niveles"
            opciones={catalogos.filtrosIntervalos.nivelEducativo.map((valor) => ({ valor, etiqueta: valor }))}
            alElegir={(siguiente) => actualizar("nivelEducativo", siguiente)}
          />
          <Buscador
            etiqueta="Régimen de salud"
            valor={filtros.regimen}
            vacioValor="Todos"
            vacioEtiqueta="Todos"
            opciones={catalogos.filtrosIntervalos.regimen.map((valor) => ({ valor, etiqueta: valor }))}
            alElegir={(siguiente) => actualizar("regimen", siguiente)}
          />
          <Buscador
            etiqueta="Tipo de parto"
            valor={filtros.tipoParto}
            vacioValor="Todos"
            vacioEtiqueta="Todos"
            opciones={catalogos.filtrosIntervalos.tipoParto.map((valor) => ({ valor, etiqueta: valor }))}
            alElegir={(siguiente) => actualizar("tipoParto", siguiente)}
          />
        </>
      ) : null}
      {pagina === "causas" ? (
        <Buscador
          etiqueta="Causa de defunción"
          valor={filtros.causa}
          vacioValor="Todas"
          vacioEtiqueta="Todas las causas"
          opciones={causas}
          alElegir={(siguiente) => actualizar("causa", siguiente)}
        />
      ) : null}
      {pagina === "externas" ? (
        <Buscador
          etiqueta="Causa externa"
          buscar={false}
          valor={filtros.externa}
          vacioValor="Todas"
          vacioEtiqueta="Todas"
          opciones={CAUSAS_EXTERNAS.map((causa) => ({ valor: causa, etiqueta: causa }))}
          alElegir={(siguiente) => actualizar("externa", siguiente)}
        />
      ) : null}
      {hayFiltros ? (
        <button type="button" className="reiniciar" title="Reiniciar filtros" onClick={reiniciar}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>Limpiar filtros</span>
        </button>
      ) : null}
    </aside>
  );
}
