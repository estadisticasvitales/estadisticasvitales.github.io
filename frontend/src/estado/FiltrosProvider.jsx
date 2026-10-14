import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDatos } from "@/datos/DatosProvider";

const FiltrosContext = createContext(null);

const INICIAL = {
  anio: null,
  departamento: "Todos",
  municipio: "Todos",
  causa: "Todas",
  externa: "Todas",
  edadMadre: "Todos",
  nivelEducativo: "Todos",
  regimen: "Todos",
  tipoParto: "Todos",
};

export function FiltrosProvider({ children }) {
  const { catalogos, listo } = useDatos();
  const [filtros, setFiltros] = useState(INICIAL);

  useEffect(() => {
    if (!listo || filtros.anio !== null) return;
    setFiltros((actual) => ({ ...actual, anio: String(catalogos.anios[0]) }));
  }, [catalogos, filtros.anio, listo]);

  const valor = useMemo(
    () => ({
      filtros,
      listos: filtros.anio !== null,
      actualizar(campo, valor) {
        setFiltros((actual) => {
          const siguiente = { ...actual, [campo]: valor };
          if (campo === "departamento") siguiente.municipio = "Todos";
          return siguiente;
        });
      },
      reiniciar() {
        setFiltros((actual) => ({
          ...actual,
          departamento: "Todos",
          municipio: "Todos",
          causa: "Todas",
          externa: "Todas",
          edadMadre: "Todos",
          nivelEducativo: "Todos",
          regimen: "Todos",
          tipoParto: "Todos",
        }));
      },
    }),
    [filtros],
  );

  return <FiltrosContext.Provider value={valor}>{children}</FiltrosContext.Provider>;
}

export function useFiltros() {
  const contexto = useContext(FiltrosContext);
  if (!contexto) throw new Error("useFiltros debe usarse dentro de FiltrosProvider");
  return contexto;
}
