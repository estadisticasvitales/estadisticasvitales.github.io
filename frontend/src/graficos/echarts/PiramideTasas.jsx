import { useMemo } from "react";
import { Tarjeta, Vacio } from "@/componentes/Tarjeta";
import { useConsulta } from "@/datos/useConsulta";
import { decimal, ORDEN_EDAD_SIMPLE } from "@/estilos/tema";
import { Grafico } from "@/graficos/echarts/Grafico";
import { opcionPiramide } from "@/graficos/echarts/opcionesPiramide";

function clave(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function PiramideTasas({ sql, ayuda }) {
  const { filas, cargando, error } = useConsulta(sql);

  const datos = useMemo(() => {
    const ordenClaves = new Map(ORDEN_EDAD_SIMPLE.map((edad, indice) => [clave(edad), { edad, indice }]));
    const grupos = new Map();
    for (const fila of filas) {
      const id = clave(fila.grupo_edad);
      if (!grupos.has(id)) {
        grupos.set(id, {
          edad: ordenClaves.get(id)?.edad ?? fila.grupo_edad,
          indice: ordenClaves.get(id)?.indice ?? 1000,
          hombres: 0,
          mujeres: 0,
        });
      }
      if (fila.sexo === "Hombres") grupos.get(id).hombres = -(fila.tasa ?? 0);
      if (fila.sexo === "Mujeres") grupos.get(id).mujeres = fila.tasa ?? 0;
    }
    return [...grupos.values()]
      .filter((fila) => fila.hombres !== 0 || fila.mujeres !== 0)
      .sort((a, b) => a.indice - b.indice);
  }, [filas]);

  const contenido = datos.length * 22 + 60;
  const opcion = useMemo(() => opcionPiramide(datos, decimal), [datos]);

  return (
    <Tarjeta
      titulo="Mortalidad por edad y sexo (por 1.000)"
      ayuda={ayuda}
      cargando={cargando && filas.length === 0}
      error={error}
    >
      {datos.length === 0 && !cargando ? (
        <Vacio>No hay mortalidad específica para este filtro.</Vacio>
      ) : (
        <Grafico opcion={opcion} contenido={contenido} cargando={cargando} />
      )}
    </Tarjeta>
  );
}
