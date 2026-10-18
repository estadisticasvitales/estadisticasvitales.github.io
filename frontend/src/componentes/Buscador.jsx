import { useEffect, useId, useMemo, useRef, useState } from "react";

function normalizar(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function levenshtein(origen, destino) {
  if (Math.abs(origen.length - destino.length) > 2) return 3;
  const fila = Array.from({ length: destino.length + 1 }, (_, indice) => indice);
  for (let i = 1; i <= origen.length; i += 1) {
    let previo = fila[0];
    fila[0] = i;
    let minimo = fila[0];
    for (let j = 1; j <= destino.length; j += 1) {
      const actual = fila[j];
      const costo = origen[i - 1] === destino[j - 1] ? 0 : 1;
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + costo);
      previo = actual;
      minimo = Math.min(minimo, fila[j]);
    }
    if (minimo > 2) return 3;
  }
  return fila[destino.length];
}

function puntaje(etiqueta, consulta) {
  const texto = normalizar(etiqueta);
  const partes = consulta.split(/\s+/).filter(Boolean);
  if (partes.every((parte) => texto.includes(parte))) {
    if (texto.startsWith(consulta)) return 0;
    const tokens = texto.split(/[^a-z0-9]+/);
    if (partes.every((parte) => tokens.some((token) => token.startsWith(parte)))) return 1;
    return 2;
  }
  const tokens = texto.split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
  let peor = 0;
  for (const parte of partes) {
    if (parte.length < 4) return null;
    const mejor = tokens.reduce(
      (distancia, token) => Math.min(distancia, levenshtein(token, parte)),
      3,
    );
    if (mejor > 2) return null;
    peor = Math.max(peor, mejor);
  }
  return 10 + peor;
}

function filtrarOpciones(opciones, consulta) {
  const texto = normalizar(consulta).trim();
  if (!texto) return opciones;
  const cercanas = opciones
    .map((opcion, indice) => ({ opcion, indice, puntaje: puntaje(opcion.etiqueta, texto) }))
    .filter((fila) => fila.puntaje !== null);
  const hayExactas = cercanas.some((fila) => fila.puntaje < 10);
  return cercanas
    .filter((fila) => (hayExactas ? fila.puntaje < 10 : true))
    .sort((a, b) => a.puntaje - b.puntaje || a.indice - b.indice)
    .map((fila) => fila.opcion);
}

export function Buscador({
  etiqueta,
  valor,
  vacioValor,
  vacioEtiqueta,
  opciones,
  alElegir,
  incluirVacio = true,
  buscar = true,
}) {
  const listaId = useId();
  const contenedor = useRef(null);
  const lista = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [activo, setActivo] = useState(0);

  const etiquetaActual =
    valor === vacioValor
      ? vacioEtiqueta
      : (opciones.find((opcion) => opcion.valor === valor)?.etiqueta ?? vacioEtiqueta);

  const visibles = useMemo(() => {
    const todas = incluirVacio ? [{ valor: vacioValor, etiqueta: vacioEtiqueta }, ...opciones] : opciones;
    if (!buscar) return todas;
    return filtrarOpciones(todas, consulta);
  }, [buscar, consulta, incluirVacio, opciones, vacioEtiqueta, vacioValor]);

  useEffect(() => {
    setActivo(0);
  }, [consulta, abierto]);

  useEffect(() => {
    setAbierto(false);
    setConsulta("");
  }, [valor]);

  useEffect(() => {
    const nodo = lista.current?.querySelector("[data-activo='true']");
    nodo?.scrollIntoView({ block: "nearest" });
  }, [activo, visibles]);

  useEffect(() => {
    function cerrar(evento) {
      if (!contenedor.current?.contains(evento.target)) {
        setAbierto(false);
        setConsulta("");
      }
    }
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, []);

  function elegir(opcion) {
    alElegir(opcion.valor);
    setAbierto(false);
    setConsulta("");
  }

  function alTeclado(evento) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAbierto(true);
      setActivo((indice) => Math.min(indice + 1, Math.max(visibles.length - 1, 0)));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setActivo((indice) => Math.max(indice - 1, 0));
    } else if (evento.key === "Enter" && abierto && visibles[activo]) {
      evento.preventDefault();
      elegir(visibles[activo]);
    } else if (evento.key === "Escape") {
      setAbierto(false);
      setConsulta("");
    }
  }

  return (
    <div className={`campo buscador${valor !== vacioValor ? " con-valor" : ""}`} ref={contenedor}>
      <span>{etiqueta}</span>
      {buscar ? (
        <input
          role="combobox"
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          value={abierto ? consulta : etiquetaActual}
          placeholder="Escribe para buscar"
          onPointerDown={() => setAbierto(true)}
          onFocus={() => {
            setAbierto(true);
            setConsulta("");
          }}
          onChange={(evento) => {
            setConsulta(evento.target.value);
            setAbierto(true);
          }}
          onKeyDown={alTeclado}
        />
      ) : (
        <button
          type="button"
          className="buscador-disparador"
          aria-expanded={abierto}
          aria-controls={listaId}
          onClick={() => setAbierto((actual) => !actual)}
          onKeyDown={alTeclado}
        >
          {etiquetaActual}
        </button>
      )}
      {abierto ? (
        <ul className="buscador-lista" id={listaId} role="listbox" ref={lista}>
          {visibles.length === 0 ? (
            <li className="buscador-vacio">Sin coincidencias</li>
          ) : (
            visibles.map((opcion, indice) => (
              <li key={opcion.valor}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opcion.valor === valor}
                  data-activo={indice === activo}
                  className={indice === activo ? "activo" : ""}
                  onMouseEnter={() => setActivo(indice)}
                  onClick={() => elegir(opcion)}
                >
                  {opcion.etiqueta}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
