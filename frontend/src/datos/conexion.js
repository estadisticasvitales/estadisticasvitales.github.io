const ARCHIVOS = [
  "panorama.parquet",
  "causas.parquet",
  "geografia.parquet",
  "poblacion.parquet",
  "poblacion_area.parquet",
  "nac_edad.parquet",
  "nac_padres.parquet",
  "caracterizacion.parquet",
  "estado_conyugal.parquet",
  "estado_civil.parquet",
  "nac_perfil.parquet",
  "def_edad.parquet",
  "externas.parquet",
  "intervalos.parquet",
  "flujos_nacimientos.parquet",
];

let inicio;

export function obtenerBase() {
  if (!inicio) inicio = iniciar();
  return inicio;
}

async function iniciar() {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundle = await duckdb.selectBundle(paquetes());
  const worker = await duckdb.createWorker(bundle.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule);

  for (const nombre of ARCHIVOS) {
    const ruta = `${import.meta.env.BASE_URL}datos/${nombre}`;
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) {
      throw new Error(`No se pudo leer ${ruta}`);
    }
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    await db.registerFileBuffer(nombre, bytes);
  }

  const conexion = await db.connect();
  await conexion.query(`
    CREATE TABLE panorama AS SELECT * FROM read_parquet('panorama.parquet');
    CREATE TABLE causas AS SELECT * FROM read_parquet('causas.parquet');
    CREATE TABLE geografia AS SELECT * FROM read_parquet('geografia.parquet');
    CREATE TABLE poblacion AS SELECT * FROM read_parquet('poblacion.parquet');
    CREATE TABLE poblacion_area AS SELECT * FROM read_parquet('poblacion_area.parquet');
    CREATE TABLE nac_edad AS SELECT * FROM read_parquet('nac_edad.parquet');
    CREATE TABLE nac_padres AS SELECT * FROM read_parquet('nac_padres.parquet');
    CREATE TABLE caracterizacion AS SELECT * FROM read_parquet('caracterizacion.parquet');
    CREATE TABLE estado_conyugal AS SELECT * FROM read_parquet('estado_conyugal.parquet');
    CREATE TABLE estado_civil AS SELECT * FROM read_parquet('estado_civil.parquet');
    CREATE TABLE nac_perfil AS SELECT * FROM read_parquet('nac_perfil.parquet');
    CREATE TABLE def_edad AS SELECT * FROM read_parquet('def_edad.parquet');
    CREATE TABLE externas AS SELECT * FROM read_parquet('externas.parquet');
    CREATE TABLE intervalos AS SELECT * FROM read_parquet('intervalos.parquet');
    CREATE TABLE flujos_nacimientos AS SELECT * FROM read_parquet('flujos_nacimientos.parquet');
  `);

  let cola = Promise.resolve();
  const consultar = (sql) => {
    const tarea = cola.then(async () => filasDe(await conexion.query(sql)));
    cola = tarea.then(
      () => undefined,
      () => undefined,
    );
    return tarea;
  };

  return { consultar };
}

function paquetes() {
  return {
    mvp: {
      mainModule: new URL("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm", import.meta.url).href,
      mainWorker: new URL(
        "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js",
        import.meta.url,
      ).href,
    },
    eh: {
      mainModule: new URL("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", import.meta.url).href,
      mainWorker: new URL(
        "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js",
        import.meta.url,
      ).href,
    },
  };
}

function filasDe(tabla) {
  return tabla.toArray().map((fila) => {
    const objeto = fila.toJSON();
    for (const [clave, valor] of Object.entries(objeto)) {
      if (typeof valor === "bigint") objeto[clave] = Number(valor);
      if (clave === "anio") objeto[clave] = Number(objeto[clave]);
    }
    return objeto;
  });
}
