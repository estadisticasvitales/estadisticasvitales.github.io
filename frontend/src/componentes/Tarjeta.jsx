import { useEffect, useId, useRef, useState } from "react";

export function Ayuda({ texto }) {
  const notaId = useId();
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const ayudaRef = useRef(null);

  useEffect(() => {
    if (!ayudaAbierta) return undefined;
    const cerrarAlHacerClickAfuera = (evento) => {
      if (!ayudaRef.current?.contains(evento.target)) setAyudaAbierta(false);
    };
    document.addEventListener("pointerdown", cerrarAlHacerClickAfuera);
    return () => document.removeEventListener("pointerdown", cerrarAlHacerClickAfuera);
  }, [ayudaAbierta]);

  return (
    <span className="ancla-ayuda" ref={ayudaRef}>
      <button
        type="button"
        className="boton-ayuda"
        aria-label="Mostrar nota"
        aria-expanded={ayudaAbierta}
        aria-describedby={notaId}
        onClick={() => setAyudaAbierta((abierta) => !abierta)}
      >
        ?
      </button>
      <span id={notaId} className={`nota-ayuda${ayudaAbierta ? " visible" : ""}`} role="tooltip">
        {texto}
      </span>
    </span>
  );
}

export function Tarjeta({ titulo, children, cargando, error, ayuda }) {
  return (
    <section className="tarjeta">
      <h2 className={ayuda ? "tarjeta-titulo-con-ayuda" : undefined}>
        <span>{titulo}</span>
        {ayuda ? <Ayuda texto={ayuda} /> : null}
      </h2>
      <div className="tarjeta-cuerpo">
        {cargando ? <p className="aviso">Cargando…</p> : null}
        {!cargando && error ? <p className="aviso error">{error}</p> : null}
        {!cargando && !error ? children : null}
      </div>
    </section>
  );
}

export function Vacio({ children }) {
  return <p className="aviso">{children}</p>;
}
