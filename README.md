# Estadísticas vitales de Colombia (EEVV)

Dashboard estático de nacimientos y defunciones en Colombia a partir de las estadísticas vitales del DANE. Consulta Parquet en el navegador con DuckDB WASM: no hay backend en producción.

Sitio publicado: [https://estadisticasvitales.github.io/](https://estadisticasvitales.github.io/)

## ¿Qué muestra?

- **Panorama:** conteos, tasas brutas por 1.000 habitantes, relación nacimientos-defunciones, mapa y rankings.
- **Nacimientos:** fecundidad por edad, tasa global y fecundidad adolescente (Fecundidad), caída de la natalidad desde 2019 por edad, educación y régimen (Natalidad), intervalos intergenésicos por departamento de ocurrencia y perfil materno, y flujos obstétricos entre residencia y ocurrencia (2025), con mapas de dependencia y saldo, rutas, ranking de receptores, heatmap y dispersión de atracción/expulsión.
- **Defunciones:** causas, mortalidad específica y estandarizada, y causas externas por 100.000 con mapa municipal.

Los filtros incluyen año y departamento, y municipio donde hay detalle municipal. Intervalos intergenésicos usa departamento de ocurrencia y filtros de edad materna, educación, régimen de salud y tipo de parto.

## Stack

| Capa | Tecnología |
| --- | --- |
| Interfaz | React 19 + Vite |
| Consultas | DuckDB WASM sobre Parquet |
| Gráficos | Apache ECharts (tema macarons) |
| Mapa | Apache ECharts |

El frontend vive en `frontend/`. Los gráficos y los mapas están en `frontend/src/graficos/echarts/`: `motor.js` registra los módulos de ECharts y el tema, `Grafico.jsx` es el contenedor común y `opciones.js` reúne ejes, etiquetas y tooltips compartidos. Los cortes analíticos están en `datos/` (`panorama.parquet`, `causas.parquet`, `geografia.parquet`, entre otros).

Los intervalos se exportan de `nacimientos.mv_intervalos` como agregados por departamento de ocurrencia, perfil materno, tipo de parto y mes del intervalo; no se publican filas individuales. Los GeoJSON del mapa están en `frontend/public/mapas/`.
