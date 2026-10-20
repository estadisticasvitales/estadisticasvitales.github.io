const SECCIONES = [
  {
    id: "panorama",
    titulo: "Panorama",
    pagina: "panorama",
    imagen: "/panorama_screenshot.JPG",
    texto: "Resumen de las estadísticas vitales en Colombia.",
  },
  {
    id: "nacimientos",
    titulo: "Nacimientos",
    pagina: "caida",
    imagen: "/nacimientos_screenshot.JPG",
    texto: "Natalidad, fecundidad, intervalos, flujos y perfil de los padres.",
  },
  {
    id: "defunciones",
    titulo: "Defunciones",
    pagina: "mortalidad",
    imagen: "/defunciones_screenshot.JPG",
    texto: "Mortalidad, causas de muerte y causas externas.",
  },
  {
    id: "poblaciones",
    titulo: "Poblaciones",
    pagina: null,
    imagen: "/proximamente.JPG",
    texto: "Proyecciones de población del DANE.",
  },
];

export function paginaDeSeccion(id) {
  return SECCIONES.find((seccion) => seccion.id === id)?.pagina ?? "panorama";
}

export function Portada({ seccion, listo, error, alElegir }) {
  const elegida = SECCIONES.find((item) => item.id === seccion);
  const esperando = Boolean(elegida) && !listo && !error;

  let estado = "Cargando datos...";
  if (error) estado = error;
  else if (esperando) estado = `Entrarás a ${elegida.titulo} en cuanto terminen`;
  else if (listo) estado = "Explora por sección";

  return (
    <div className="portada">
      <header className="portada-marca">
        <img className="portada-logo" src="/favicon.png" alt="" />
        <h1>Estadísticas Vitales</h1>
        <p>Nacimientos y defunciones en Colombia publicadas por el Departamento Administrativo Nacional de Estadística (DANE)</p>
        <p className={error ? "portada-estado error" : "portada-estado"} role="status" aria-live="polite">
          {esperando ? <span className="espera-giro" aria-hidden="true" /> : null}
          {estado}
        </p>
      </header>
      <div className="portada-secciones">
        {SECCIONES.map((item) => {
          const enEspera = esperando && item.id === seccion;
          return (
            <button
              key={item.id}
              type="button"
              className={enEspera ? "puerta espera" : "puerta"}
              aria-busy={enEspera}
              aria-disabled={item.pagina ? undefined : true}
              disabled={Boolean(error)}
              onClick={() => {
                if (item.pagina) alElegir(item.id);
              }}
            >
              <span className="puerta-vista">
                <img src={item.imagen} alt="" />
              </span>
              <span className="puerta-cuerpo">
                <span className="puerta-titulo">{item.titulo}</span>
                <span className="puerta-texto">{item.texto}</span>
                <span className="puerta-accion">
                  {enEspera ? <span className="espera-giro" aria-hidden="true" /> : null}
                  {item.pagina ? (enEspera ? "Esperando los datos" : "Entrar") : "Próximamente"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <nav className="portada-contacto" aria-label="Contacto">
        <span className="portada-contacto-titulo">Contacto</span>
        <a className="portada-red" href="https://www.linkedin.com/in/juliangomez96/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
          </svg>
        </a>
        <span className="portada-red" title="X">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.23 10.16 22.15 1.5h-1.88l-6.87 7.52L7.9 1.5H1.5l8.3 11.37L1.5 22.5h1.88l7.26-7.95 5.8 7.95h6.4l-8.61-11.34Zm-2.57 2.81-.84-1.2-6.69-9.56h2.88l5.4 7.72.84 1.2 7.02 10.03h-2.88l-5.73-8.19Z" />
          </svg>
        </span>
        <a className="portada-red correo" href="mailto:juliangomez9614@gmail.com" aria-label="Enviar un correo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6.2h18v11.6H3V6.2Zm.8 1.1 8.2 5.7 8.2-5.7" />
          </svg>
        </a>
      </nav>
      <p className="portada-credito">Desarrollado por Julián Gómez (2026) | Datos abiertos del DANE</p>
    </div>
  );
}
