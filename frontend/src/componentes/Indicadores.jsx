import { Ayuda } from "@/componentes/Tarjeta";

export function Indicador({ titulo, valor, tono, clase = "", estilo, variacion = null, ayuda }) {
  return (
    <article className={`indicador tono-${tono} ${clase}`.trim()} style={estilo}>
      <span className={ayuda ? "indicador-titulo-con-ayuda" : undefined}>
        {titulo}
        {ayuda ? <Ayuda texto={ayuda} /> : null}
      </span>
      <strong>
        {variacion == null ? (
          valor
        ) : (
          <span className="valor-indicador">
            <span className="cifra">{valor}</span>
            <small className="variacion" title={variacion.detalle}>
              {variacion.texto}
            </small>
          </span>
        )}
      </strong>
    </article>
  );
}

export function FilaIndicadores({ children }) {
  return <section className="indicadores">{children}</section>;
}
