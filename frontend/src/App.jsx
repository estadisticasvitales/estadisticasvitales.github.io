import { useState } from "react";
import { DatosProvider, useDatos } from "@/datos/DatosProvider";
import { Disposicion } from "@/componentes/Disposicion";
import { paginaDeSeccion, Portada } from "@/componentes/Portada";
import { FiltrosProvider, useFiltros } from "@/estado/FiltrosProvider";

function Contenido() {
  const { listo, error } = useDatos();
  const { listos } = useFiltros();
  const [seccion, setSeccion] = useState(null);
  const datosListos = listo && listos;

  if (seccion && datosListos && !error) {
    return <Disposicion paginaInicial={paginaDeSeccion(seccion)} alInicio={() => setSeccion(null)} />;
  }

  return <Portada seccion={seccion} listo={datosListos} error={error} alElegir={setSeccion} />;
}

export function App() {
  return (
    <DatosProvider>
      <FiltrosProvider>
        <Contenido />
      </FiltrosProvider>
    </DatosProvider>
  );
}
