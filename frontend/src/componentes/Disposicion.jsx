import { useMemo, useState } from "react";
import { BarraLateral } from "@/componentes/BarraLateral";
import { CaidaNatalidad } from "@/paginas/CaidaNatalidad";
import { CausasExternas } from "@/paginas/CausasExternas";
import { Defunciones } from "@/paginas/Defunciones";
import { Fecundidad } from "@/paginas/Fecundidad";
import { IntervalosIntergenesicos } from "@/paginas/IntervalosIntergenesicos";
import { Mortalidad } from "@/paginas/Mortalidad";
import { Panorama } from "@/paginas/Panorama";

const MENU = [
  {
    id: "panorama",
    titulo: "Panorama",
    hijos: [{ id: "panorama", titulo: "Panorama" }],
  },
  {
    id: "nacimientos",
    titulo: "Nacimientos",
    hijos: [
      { id: "caida", titulo: "Natalidad" },
      { id: "fecundidad", titulo: "Fecundidad" },
      { id: "intervalos", titulo: "Intervalos Intergenésicos" },
    ],
  },
  {
    id: "defunciones",
    titulo: "Defunciones",
    hijos: [
      { id: "mortalidad", titulo: "Mortalidad" },
      { id: "causas", titulo: "Causas" },
      { id: "externas", titulo: "Causas externas" },
    ],
  },
];

const PAGINAS = {
  panorama: Panorama,
  fecundidad: Fecundidad,
  intervalos: IntervalosIntergenesicos,
  caida: CaidaNatalidad,
  causas: Defunciones,
  mortalidad: Mortalidad,
  externas: CausasExternas,
};

function seccionDe(pagina) {
  return MENU.find((item) => item.id === pagina || item.hijos?.some((hijo) => hijo.id === pagina));
}

export function Disposicion() {
  const [pagina, setPagina] = useState("panorama");
  const seccion = useMemo(() => seccionDe(pagina), [pagina]);
  const Vista = PAGINAS[pagina] ?? Panorama;

  function irSeccion(item) {
    if (!item.hijos) {
      setPagina(item.id);
      return;
    }
    if (item.hijos.some((hijo) => hijo.id === pagina)) return;
    setPagina(item.hijos[0].id);
  }

  return (
    <div className="app">
      <header className="encabezado">
        <div>
          <h1>Estadísticas Vitales: Nacimientos y Defunciones</h1>
          <p>
            Nacimientos y defunciones en Colombia publicadas por el Departamento Administrativo Nacional
            de Estadística (DANE)
          </p>
        </div>
        <nav className="menu">
          {MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              className={seccion?.id === item.id ? "activo" : ""}
              onClick={() => irSeccion(item)}
            >
              {item.titulo}
            </button>
          ))}
        </nav>
      </header>
      {seccion?.hijos ? (
        <div className="subnav">
          {seccion.hijos.map((hijo) => (
            <button
              key={hijo.id}
              type="button"
              className={pagina === hijo.id ? "activo" : ""}
              onClick={() => setPagina(hijo.id)}
            >
              {hijo.titulo}
            </button>
          ))}
        </div>
      ) : null}
      <BarraLateral pagina={pagina} />
      <main className="contenido">
        <Vista />
      </main>
    </div>
  );
}
