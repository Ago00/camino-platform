# Decisiones técnicas

Log permanente de decisiones de arquitectura. Cada entrada: qué se decidió, qué
alternativas se valoraron, por qué se eligió, fecha.

---

## DT-001 — Dos representaciones de la traza: cálculo y pintado

**Fecha:** 2026-07-30 · **Tarea:** F1 — Base

**Decisión.** La traza vive en dos ficheros con responsabilidades distintas:

| | Cálculo | Pintado |
|---|---|---|
| Fichero | `lib/traza/traza.geojson` | `lib/traza/traza-mapa.geojson` |
| Puntos | 7.121 (sin simplificar, traza extendida DT-005) | ~2.011 (Douglas-Peucker, 3 m) |
| Peso | ~147 KB | ~42 KB (~16 KB gzip) |
| Dónde se usa | Solo servidor (`proyeccion.ts`) | Se envía al navegador (mapa, F3) |
| Exactitud | Longitud real, intocable | ±3 m, estética |

> Nota (DT-015, 2026-08-07): la fila "Puntos" de esta tabla es la cifra en la
> fecha de esta decisión. DT-015 corrige la extensión sur del corredor y las
> cifras vigentes pasan a 7.951 puntos / 110,43 km (cálculo). El reparto en
> dos ficheros con estas responsabilidades no cambia — solo el punto de
> corte al sur.

**Por qué.** Douglas-Peucker corta esquinas y por tanto **siempre acorta la
línea**. Medido sobre nuestra traza real **antes de la extensión sur de F1.1**
(6.911 puntos, 100 km) — el análisis sigue siendo válido, las cifras son históricas:

| Tolerancia | Puntos | Longitud | Pérdida |
|---|---|---|---|
| — | 6.911 | 100,0008 km | — |
| 1 m | 3.198 | 99,934 km | −67 m |
| 3 m | 1.724 | 99,662 km | −339 m |
| 5 m | 1.302 | 99,419 km | −582 m |
| 10 m | 829 | 98,769 km | −1.232 m |

Una tolerancia de 5 m es visualmente invisible en el mapa y aun así evapora
**582 metros**. Si el cálculo usara la traza simplificada, Santi llegaría al
Obradoiro y la web le diría que le faltan 600 m — el fallo más caro posible,
justo en el momento que justifica todo el proyecto.

**Consecuencia de diseño:** `proyeccion.ts` se ejecuta **en servidor**. Al
cliente solo viajan los números del `Progreso`, no la traza de cálculo.

**Alternativas valoradas.** Una sola traza simplificada (descartada: rompe la
distancia). Una sola traza completa enviada al cliente (descartada: 147 KB sobre
la cobertura móvil de la ruta, y el cálculo en cliente sería manipulable).

**Tolerancia elegida para el pintado: 3 m.** 5 m ahorra 9 KB y no compensa
arriesgar fidelidad visual en el elemento central del producto.

---

## DT-002 — La meta es la Praza do Obradoiro; la traza mide 100,21 km

> ⚠️ **DEROGADA parcialmente por DT-005** (2026-07-30). La meta en el Obradoiro
> y el tramo final manual siguen vigentes. Lo que decae es el punto de inicio y
> el objetivo de longitud: la traza ya no persigue una cifra, es un corredor.

**Fecha:** 2026-07-30 · **Tarea:** F1 — Base · **Decisión de producto de Santi**

**Contexto.** La traza oficial de la Xunta termina en **Praza da Quintana**,
detrás de la catedral, a 93 m en línea recta del Obradoiro (andando son ~210 m:
no se atraviesa la catedral, hay que rodearla). Tres objetivos que hasta ahora
eran compatibles dejaron de serlo:

```
(a) arrancar en el mojón físico del km 100
(b) terminar en la Praza do Obradoiro
(c) que el total sean 100,000 km exactos
```

**Decisión.** Se extiende la traza hasta el Obradoiro (+209,5 m) y **el inicio no
se mueve**. La traza pasa a medir **100,210 km**. Se renuncia a (c).

**Por qué.** 210 m sobre 100 km es un 0,2%. Mantener el inicio conserva el punto
ya calculado y validado contra el mojón, evita rehacer el recorte desde el KML
original, y deja un pelín de margen: se anda algo más de lo que se promete, nunca
menos. La cifra "100 km" es el nombre del reto, no una medición de precisión.

**Alternativas valoradas.**
- *Extender y recortar 210 m por el inicio* para mantener 100,000 km exactos.
  Descartada por Santi: mueve un punto de inicio ya bueno para ganar precisión
  simbólica.
- *Dejar la traza en Quintana* y pintar el Obradoiro como icono. Descartada: la
  barra marcaría 100% dos minutos antes de pisar la plaza.

**Deuda que genera.** Los ~210 m finales son geometría **dibujada a mano** (5
waypoints rodeando la catedral por Praza da Inmaculada), no dato oficial. Van
marcados con `tramo_final_manual: true` en las propiedades del GeoJSON y
registrados en `DEBT.md` para validar sobre el terreno.

**Waypoints del tramo manual** (lon, lat):

| # | Coordenada | Lugar | Tramo |
|---|---|---|---|
| 1 | -8.543659, 42.880599 | Fin de la traza oficial (Quintana) | — |
| 2 | -8.543850, 42.880950 | Quintana, extremo norte | 42,0 m |
| 3 | -8.544300, 42.881350 | Praza da Inmaculada (Azabachería) | 57,6 m |
| 4 | -8.544900, 42.881050 | Arco do Pazo de Xelmírez | 59,2 m |
| 5 | -8.544800, 42.880600 | **Praza do Obradoiro** | 50,7 m |

---

## DT-003 — `proyeccion.ts` es dominio puro con la traza inyectada

**Fecha:** 2026-07-30 · **Tarea:** F1 — Base

**Decisión.** API en dos piezas:

```ts
prepararTraza(geojson): TrazaPreparada      // km acumulados por vértice, una vez
calcularProgreso(historico, traza): Progreso
```

Sin I/O, sin lectura de ficheros, sin `Date.now()` implícito. La traza entra como
parámetro.

**Por qué.** Los tests se escriben con trazas sintéticas de 3 puntos en vez de
depender del GeoJSON real de 7.951 vértices (estado actual tras DT-015; eran
7.121 tras DT-005, 6.911 antes de la extensión sur de F1.1): fixtures legibles
y fallos que señalan la línea exacta del bug. `prepararTraza` separada evita
recalcular las distancias acumuladas en cada petición (el día del reto habrá
~3.600 posiciones).

---

## DT-004 — Umbrales del dominio en un único módulo

**Fecha:** 2026-07-30 · **Tarea:** F1 — Base

| Constante | Valor | Razón |
|---|---|---|
| `EN_RUTA_MAX_M` | 50 m | El error típico de GPS urbano es de 10-30 m |
| `DESVIO_MENOR_MAX_M` | 250 m | Por encima ya no es ruido: se ha ido por otra calle |
| `VELOCIDAD_MAX_KMH` | 15 km/h | Andando + margen. Por encima es salto de GPS |
| `PRECISION_MAX_M` | 150 m | Puntos más imprecisos no suman al odómetro |

**Por qué en un módulo propio.** El día del reto puede hacer falta ajustar un
umbral en caliente. Buscarlos esparcidos por el código, con el reloj corriendo y
Santi andando, es exactamente lo que no queremos.

---

## DT-005 — La traza es un corredor, no un recorrido: se extiende al sur y el progreso se ancla al inicio real

**Fecha:** 2026-07-30 · **Tarea:** F1.1 — Ajuste de traza y anclaje
**Deroga:** el punto de inicio y el objetivo de longitud de DT-002

**Decisión de producto de Santi.** El reto debe **arrancar en un mojón físico
cuya cifra grabada sea ≥ 100 km**. Y, textualmente: *"la ruta empieza donde yo le
dé a iniciar"* y *"debe mostrar que llevo lo que lleve y que me queda lo
calculado; debemos hacerlo de manera que empiece antes de los 100 km
calculados"*.

### El problema

El inicio actual de la traza está 1,7 km al **norte** de O Porriño siguiendo la
ruta. En la escala de los mojones eso es ≈98,7 km: **incumple el criterio**.

Y no se puede corregir con precisión, por dos motivos independientes:

1. **Las coordenadas de los mojones no existen en ningún dataset público.** El
   dataset de la Xunta solo publica los trazados de etapa; OpenStreetMap en esa
   zona solo tiene mojones de carretera (AP-9V, AG-46). Único ancla documentada
   encontrada: el mojón **99,408**, donde el Camino abandona la N-550 para
   entrar en O Porriño por la rúa Manuel Rodríguez.
2. **Nuestra medición y la grabada en las piedras no coinciden.** Contrastando
   hitos contra las distancias oficiales de etapa, nuestra traza mide de más de
   forma creciente hacia el sur:

   | Hito | Restante s/ traza | Guías | Desvío |
   |---|---|---|---|
   | Padrón | 25,310 km | 23,7 | +1,61 |
   | Caldas de Reis | 44,411 km | 42,3 | +2,11 |
   | Pontevedra | 65,690 km | 63,4 | +2,29 |
   | Redondela | 85,495 km | 83,0 | +2,49 |
   | O Porriño | 101,92 km | 98,2 | +3,72 |

   **No es un fallo de la traza**: se verificó que no se solapa consigo misma en
   ningún punto (0 zonas de repaso), así que no hay tramos duplicados del KML.
   Es la diferencia normal entre un track GPS detallado y las distancias de
   etapa redondeadas de las guías.

### La decisión

**1. La traza se extiende ~4,7 km hacia el sur**, atravesando O Porriño en
dirección Tui, hasta ~3 km al sur del centro. Total ≈ **105 km**.

En vez de acertar el mojón exacto —imposible con los datos disponibles— se
ensancha la red: con 105 km, el punto donde una piedra pone `100` queda dentro de
la traza incluso en el escenario de desfase más pesimista (+3,7 km).

**2. El progreso se ancla al primer punto del intento, no al origen de la traza.**
El porcentaje se mide desde donde Santi pulsa Iniciar hasta el Obradoiro. Sin
esto, con la traza empezando 4,7 km antes, la barra marcaría ~4,5% antes de dar
un paso. Odómetro y km restantes no cambian de semántica.

**3. Se abandona el objetivo de longitud exacta.** El compromiso pasa de "100,000
km exactos" a **"nunca menos de 100"**. Se anda algo más de lo que dice el
titular, nunca menos.

### Por qué esto es robusto

La traza deja de ser *el recorrido* y pasa a ser *el corredor previsto*. Eso la
hace inmune a las dos incógnitas que no podemos cerrar desde aquí (dónde está el
mojón y cuál es el desfase real de la escala grabada): el recorrido de verdad lo
define Santi al pulsar Iniciar.

### Alternativas valoradas

- *Localizar el mojón por investigación* (Wikiloc, fotos geolocalizadas, Street
  View). Descartada por Santi a favor de estimar: más lento y aun así incierto.
- *Estimar desde el mojón 99,408 y contar 500 m hacia atrás.* Encadena dos
  estimaciones (dónde está ese cruce y que el espaciado sea regular) para ganar
  una precisión que el diseño de corredor hace innecesaria.

### Deuda que genera

El día del reto, **la pantalla y las piedras no dirán el mismo número** (~1,5-3,7
km de diferencia). Se aparca deliberadamente hasta F3: cuando Santi ande la ruta
se podrán anotar mojones reales y calibrar con datos en vez de con estimaciones.
Registrado en `DEBT.md`.

---

## DT-006 — Defensa en dos capas contra el envenenamiento del ancla de progreso

**Fecha:** 2026-07-30 · **Tarea:** F2 — Datos e ingesta · **Decisión de producto de Santi**

**Contexto.** El Agente de Seguridad detectó en la revisión de F1.1 que el ancla
del porcentaje (el primer punto no descartado del histórico) determina el
denominador de todo el cálculo del intento. Si `/api/track` acepta un primer
punto falso muy adelantado en la traza, la barra queda fijada cerca del 100%
desde el arranque. Registrado inicialmente en `DEBT.md` como **irreversible sin
tocar la BD directamente**.

**Corrección de esa premisa.** `calcularProgreso` recalcula el ancla en cada
llamada como `validas[0]` — el primer punto con `descartado: false`. Si ese
punto se marca como descartado, el ancla salta automáticamente al siguiente
punto válido. **Es reversible desde el panel de admin, sin tocar la BD a mano.**

**El matiz real.** La especificación v1 solo prevé "descartar **último**
punto" (el más reciente), pensado para el caso típico de un salto de GPS que se
nota al momento. Si el punto envenenado queda enterrado bajo horas de datos
reales posteriores, ese botón no llega hasta él — aunque el modelo de datos sí
lo permite (`descartado` es un booleano por fila, sin restricción de cuál).

**Decisión.** Defensa en dos capas, cada una barata por separado:

1. **F2 — filtro de plausibilidad geográfica en `/api/track`.** Se rechaza
   (sin guardar, sin dar pistas al remitente) cualquier punto a más de **100 km**
   de la traza de cálculo. Es un margen deliberadamente generoso: cubre
   cualquier situación real (incluida la de un coche de apoyo puntual), y solo
   corta puntos verdaderamente absurdos o maliciosos. No debe interferir nunca
   con un desvío real de Santi.
2. **F4 — el botón de descartar pasa de "último punto" a "cualquier punto del
   histórico".** Mejora que además es útil por sí misma (Santi puede querer
   limpiar un punto raro de hace una hora, no solo el de ahora). Cierra el hueco
   que deja la capa 1 si algo la esquivara.

**Por qué las dos y no solo una.** Sin la capa 1, el endpoint queda
desprotegido durante toda la ventana entre que F2 se despliega y F4 existe. Sin
la capa 2, un punto envenenado que sí burlara el filtro geográfico (por ejemplo,
alguien con acceso al token insertando un punto dentro de esos 100 km pero muy
adelantado) seguiría sin tener arreglo si se descubre tarde.

**Alternativas valoradas.**
- *Umbral de 10 km* (propuesta inicial). Descartado por Santi a favor de más
  margen: prioriza no rechazar nunca un punto real por encima de un filtro más
  ajustado.
- *Solo capa 2, sin filtro en F2.* Descartada: deja el endpoint sin protección
  hasta que F4 esté construido y desplegado.
- *Solo capa 1, sin ampliar F4.* Descartada: no cierra el caso límite de un
  punto envenenado que se descubre después de haberse enterrado en el
  histórico.

**Actualiza `DEBT.md`**: la entrada de envenenamiento del ancla pasa de
"irreversible" a "reversible vía admin, con la ampliación de alcance de F4
descrita aquí"; prioridad se mantiene Alta hasta que ambas capas estén
implementadas.

---

## DT-007 — Web pública: polling + caché TTL en memoria en vez de Realtime o progreso incremental en BD

**Fecha:** 2026-07-31 · **Tarea:** F3 — Web pública · **Decisión de arquitectura**

**Contexto.** F3 necesita que "durante" refleje la posición y el progreso de
Santi con datos vivos, y que el muro de comentarios se actualice. Dos
decisiones relacionadas:

**1. Cómo llega el dato vivo al cliente.**

**Decisión:** *polling* del cliente a `GET /api/progreso` y `GET
/api/comentarios` cada 30 s, en vez de Supabase Realtime.

**Por qué.** `calcularProgreso` necesita `traza.geojson` (solo servidor, DT-001)
— un evento de Realtime en el cliente igualmente tendría que disparar una
llamada al servidor para recalcular, así que Realtime solo ahorraría el
intervalo fijo, no el coste real de cómputo. Con audiencia familiar/amigos,
30 s de retardo es imperceptible. Realtime añadiría gestión de conexión
(reconexión, cleanup) sin resolver el problema real.

**2. Coste de `calcularProgreso` en cada petición.**

`calcularProgreso` recorre todo el histórico de posiciones y proyecta cada
una sobre los ~7.951 segmentos de la traza (cifra tras DT-015; ~7.121 en la
fecha de esta decisión) — con ~3.600 posiciones al final del reto, hasta
~28M operaciones de distancia por llamada. Con varios
seguidores haciendo polling cada 30 s durante 24-30 h, esto se ejecutaría sin
caché justo cuando la web más tráfico tiene.

**Decisión:** caché en memoria de proceso con TTL corto (15-20 s) dentro de
`app/api/progreso/route.ts`. **No** se persiste progreso incremental en BD.

**Por qué.** La alternativa correcta "de verdad" (guardar el estado
acumulado — máximo histórico, odómetro, ancla — en `intentos` y actualizarlo
incrementalmente desde `/api/track`) cambiaría la firma de `calcularProgreso`
(dominio ya cerrado y testeado en F1, DT-003), la migración de F2 ya
verificada contra Supabase real, y el propio `/api/track`. Eso excede el
alcance aprobado para F3. La caché TTL en memoria resuelve el riesgo real
(recomputación repetida en ráfagas de polling) sin tocar nada fuera de F3.

**Alternativas valoradas.**
- *Supabase Realtime.* Descartada — no evita la recomputación, solo el
  intervalo; añade complejidad de conexión no justificada para este evento.
- *Progreso incremental persistido en BD (Opción C).* Descartada para F3 por
  alcance; ver `DEBT.md` — queda como el arreglo de fondo si la caché TTL
  resulta insuficiente el día del evento.

**Actualiza `DEBT.md`**: la entrada sobre el coste de `calcularProgreso` /
`kmAcumulados` sin usar pasa de "evaluar en F2" a "mitigado en F3 con caché
TTL en memoria; el arreglo de fondo (progreso incremental en BD) queda
pendiente si el TTL no basta en producción".

---

## DT-008 — Worker de MapLibre GL pre-empaquetado con esbuild, servido desde `public/`

**Fecha:** 2026-07-31 · **Tarea:** F3 — Web pública (bug post-cierre, PR #6) · **Decisión de arquitectura**

**Contexto.** El mapa base de MapTiler (calles/agua) no se pintaba en `Mapa.tsx`.
Investigación extensa (Debugger + Orquestador, con verificación directa en
consola/red del navegador real del usuario) encontró la causa raíz completa:

1. `maplibre-gl@6` calcula la URL de su Web Worker con un patrón
   `new URL(target-condicional, import.meta.url)` que Turbopack no resuelve
   bien (colapsa siempre al bundle principal). Fijar `config.WORKER_URL` a
   mano evita esto.
2. Pero apuntar `WORKER_URL` a cualquier fichero — de `node_modules` o de la
   propia app — referenciado como `new URL(literal, import.meta.url)` hace
   que Turbopack lo trate como **asset estático copiado en crudo**, sin
   bundlear sus imports internos. El propio worker de MapLibre importa
   `./maplibre-gl-shared.mjs` (sin hash de contenido); esa ruta nunca existe
   en el output (solo la versión con hash), así que el import falla con
   **404 dentro del contexto del worker** — confirmado con una captura real
   de la pestaña Network del usuario en la preview de Vercel desplegada.
3. Este fallo es **invisible desde el hilo principal**: `maplibre-gl` nunca
   engancha `worker.onerror` al `Worker` nativo, así que ni `window.onerror`,
   ni `map.on('error')`, ni la consola muestran nada. Solo se ve mirando
   directamente la pestaña Network.
4. Causa raíz de fondo, documentada en `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`:
   Turbopack solo aplica su tratamiento especial de bundling de Web Workers
   cuando el propio código de la app contiene literalmente la expresión
   `new Worker(new URL(...))`. Como `maplibre-gl` construye el `Worker`
   internamente con una URL que le llega en tiempo de ejecución (vía
   `config.WORKER_URL`), Turbopack nunca puede aplicar ese análisis estático,
   sin importar desde qué fichero se referencie la URL.

**Decisión.** Pre-empaquetar el worker de MapLibre GL (y su dependencia
`maplibre-gl-shared.mjs`) en un único fichero autocontenido, sin ningún
import externo, usando `esbuild` en un script de build
(`scripts/bundle-maplibre-worker.ts`, patrón análogo a
`scripts/simplificar-traza.ts`). El resultado se sirve desde `public/`
(fichero estático servido tal cual por Next, sin pasar por el pipeline de
bundling de Turbopack) y `config.WORKER_URL` apunta a esa ruta pública fija
(`/maplibre-gl-worker.bundled.js`), sin `new URL(..., import.meta.url)` de
por medio.

**Por qué.** Al no tener ningún import interno que resolver, el fichero
pre-empaquetado es inmune a las dos limitaciones de Turbopack descritas
arriba. Servirlo desde `public/` evita por completo el pipeline de asset
bundling de Turbopack (que es precisamente la pieza que falla), en vez de
seguir intentando trabajar en contra de él.

**Alternativas valoradas.**
- *Bajar la versión de `maplibre-gl`.* Descartada: sin garantía de que una
  versión anterior no tenga el mismo problema con Turbopack (la causa raíz
  es de Turbopack + patrón de Worker en tiempo de ejecución, no específica
  de la v6), y obligaría a revalidar todo el mapa de nuevo.
- *Parchear el import a mano con un Blob en tiempo de ejecución* (fetch del
  código fuente del worker + reescritura de string del import + Blob URL).
  Descartada: frágil, dependiente de la estructura interna exacta del
  paquete (rompe con cualquier actualización de `maplibre-gl`), y es
  exactamente el tipo de "parche stringly-typed sobre código de terceros"
  que el framework desaconseja.

**Nueva dependencia:** `esbuild` (devDependency) + script de build que se
ejecuta antes de `dev`/`build` (`predev`/`prebuild` en `package.json`) o de
forma manual, según decida el Implementador — el artefacto generado
(`public/maplibre-gl-worker.bundled.js`) puede regenerarse o commitearse,
a criterio del Implementador, documentado en `README.md`/`AGENTS.md`.

---

## DT-009 — Perfil de elevación: dato estático generado una vez con Open-Elevation, commiteado

**Fecha:** 2026-07-31 · **Tarea:** Foto + perfil de elevación · **Decisión de arquitectura**

**Contexto.** Se pide mostrar distancia, desnivel (ascenso/descenso) y un
perfil de elevación de la ruta en el modo "Antes". La traza real no tiene
datos de altitud: el KML fuente de la Xunta trae elevación `0` en todos los
puntos (confirmado por inspección directa), así que hace falta una fuente
externa.

**Decisión.**
1. Nuevo script `scripts/generar-perfil-elevacion.ts`, ejecución **manual**
   (no enganchado a `predev`/`prebuild`). Remuestrea `traza-mapa.geojson`
   (traza de PINTADO, nunca la de cálculo — es contenido de visualización)
   a intervalos de ~1 km, consulta **Open-Elevation** (API pública, gratis,
   sin clave, endpoint de lote) en una sola petición, y escribe
   `lib/traza/perfil-elevacion.json`.
2. El artefacto generado **se commitea al repositorio**, igual que
   `traza-mapa.geojson` — no se regenera en cada build. La ruta es fija; no
   tiene sentido que cada deploy de Vercel dependa de la disponibilidad de
   una API externa de terceros para un dato que no cambia.
3. La web pública **nunca llama a Open-Elevation** — cero dependencia
   externa en producción, cero riesgo de indisponibilidad en el reto.

**Por qué Open-Elevation y no la API de MapTiler.** Ya hay cuenta/clave de
MapTiler, pero al ejecutarse una sola vez y nunca en producción, no compensa
generar dependencia de su cuota por un dato que se pide una vez y se
commitea. Open-Elevation no requiere clave ni gestión de cuenta.

**Alternativas valoradas.**
- *Regenerar el perfil en cada build (`predev`/`prebuild`, patrón DT-008).*
  Descartada: DT-008 lo hacía porque el artefacto depende de la versión
  instalada de una librería (`maplibre-gl`) que puede cambiar; aquí el dato
  depende de la geografía real de la ruta, que es fija. Regenerarlo siempre
  añadiría una dependencia de red externa a cada build sin ningún beneficio.
- *API de elevación de MapTiler.* Descartada por la razón de cuota/clave
  explicada arriba.

---

## DT-010 — Sesión de admin: cookie HMAC casera con `node:crypto`; corrección `middleware.ts` → `proxy.ts`

**Fecha:** 2026-07-31 · **Tarea:** F4 — Panel admin · **Decisión de arquitectura**

**Contexto.** F4 necesita proteger `/admin/*` con una sesión de admin único
(contraseña en `ADMIN_PASSWORD`). `docs/tecnico/arquitectura.md` documentaba
`middleware.ts` como el fichero que protegería esas rutas.

**Hallazgo previo a la decisión.** `middleware.ts` está deprecado desde
Next.js **16.0.0** y renombrado a `proxy.ts` (función exportada `proxy()`,
no `middleware()`) — confirmado en
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`,
no en la documentación de entrenamiento del modelo (aviso de `AGENTS.md`
sobre Next 16). `arquitectura.md` quedaba desactualizado en este punto desde
que se escribió en F1. Además, Proxy en Next 16 usa **runtime Node.js por
defecto** (antes Edge) — sin restricción para usar `node:crypto`. La propia
documentación de Next advierte: las Server Actions se sirven como POST a la
misma ruta donde se usan, así que un cambio de matcher en `proxy.ts` puede
dejarlas sin cobertura sin que se note — **cada Server Action debe verificar
la sesión por sí misma**, nunca asumir que `proxy.ts` ya lo hizo.

**Decisión — sesión.** `lib/auth/admin-session.ts`: cookie `HttpOnly` con
payload mínimo `{ exp: timestamp }` en base64url, firmado HMAC-SHA256
(`ADMIN_SESSION_SECRET`), verificado con `timingSafeEqual` — mismo patrón que
ya usa `/api/track` para `TRACK_TOKEN`. TTL 7 días, renovada en cada petición
válida a `/admin/*` desde `proxy.ts`. Cada función de
`app/admin/actions.ts` verifica la sesión ella misma antes de mutar nada.

**Decisión — fichero.** `proxy.ts` (no `middleware.ts`) protege `/admin/*`
excepto `/admin/login`.

**Por qué HMAC casero y no `jose`/JWT.** Un solo admin, sin roles ni claims
adicionales — un JWT completo resuelve un problema (multi-claim,
interoperabilidad) que este proyecto no tiene. El HMAC casero es igual de
seguro (mismo algoritmo por debajo) con cero dependencias nuevas y reutiliza
un patrón ya presente y revisado en el proyecto.

**Alternativas valoradas.**
- *JWT con `jose`.* Descartada: dependencia nueva sin beneficio real para un
  admin único.
- *TTL corto (horas) sin renovación.* Descartada: obligaría a Santi a volver
  a loguearse en pleno reto (24-30 h), justo el peor momento.
- *TTL muy largo (meses) o sin expiración.* Descartada: amplía innecesariamente
  la ventana de exposición si el móvil se pierde; las intenciones que protege
  la sesión son datos privados de terceros.

**Actualiza `arquitectura.md`**: `proxy.ts` sustituye a `middleware.ts` en la
tabla de estructura; se añaden `lib/auth/admin-session.ts` y
`components/admin/`.

---

## DT-011 — Rate limiting en memoria de proceso, sin infraestructura nueva

**Fecha:** 2026-08-01 · **Tarea:** F5 — Cierre · **Decisión de arquitectura**

**Contexto.** `DEBT.md` marca explícitamente "sin rate limiting" como bloqueante
antes de desplegar a producción real, en 6 endpoints: `POST /api/track`,
`POST /api/comentarios`, `GET /api/comentarios`, `POST /api/intenciones`,
`GET /api/progreso` y `POST /api/admin/login`.

**Opciones valoradas:**
- **Redis gestionado (Upstash vía `@upstash/ratelimit`).** Contador realmente
  compartido entre instancias/regiones. Descartada: exige dar de alta una
  cuenta/integración externa nueva y env vars adicionales, sobredimensionado
  para un proyecto Hobby con audiencia familiar/amigos de un solo día.
- **Reglas de rate limiting del Firewall de Vercel.** Sin tocar código.
  Descartada sin explorar más: las reglas personalizadas de rate limiting del
  Firewall son función de plan Pro; el proyecto es explícitamente Hobby.

**Decisión:** rate limiter en memoria de proceso, módulo compartido
`lib/rate-limit.ts` con una función genérica `consumir(clave, limite,
ventanaMs): boolean` sobre un `Map<string, {count, resetAt}>` en scope de
módulo. Cada ruta la llama con su propia clave (IP vía `x-forwarded-for` para
las públicas, token para `/api/track`) y su propio límite:

| Endpoint | Clave | Límite |
|---|---|---|
| `POST /api/track` | token | 40 req/min |
| `POST /api/comentarios` | IP | 10 req/min |
| `POST /api/intenciones` | IP | 10 req/min |
| `GET /api/progreso` | IP | 60 req/min |
| `GET /api/comentarios` | IP | 60 req/min |
| `POST /api/admin/login` | IP | 10 intentos/15 min |

**Por qué.** Mismo patrón ya validado en **DT-007** (caché TTL en memoria de
proceso en `/api/progreso`), coherente con el resto del proyecto. Coste cero,
sin dependencias ni cuentas nuevas. El riesgo real a mitigar —token filtrado o
spam puntual desde un mismo origen— no requiere precisión distribuida: el
límite es por clave (IP o token), así que una ráfaga de visitantes distintos
nunca se bloquea entre sí, solo se frena a quien excede su propio límite.

**Limitación conocida (aceptada, igual que DT-007):** el contador vive por
instancia de función serverless — no se comparte entre regiones ni sobrevive
a un cold start. Un atacante distribuido en múltiples instancias lo esquiva
parcialmente. Aceptable para el tráfico esperado (evento de un día, audiencia
familiar/amigos); si el tráfico real lo desborda, la solución de fondo es
migrar a un contador compartido (Upstash u otro), igual que ya se anticipa
para DT-007 en `DEBT.md`.

---

## DT-012 — Auto-refresco de fase: endpoint dedicado `GET /api/fase`, sin Realtime

**Fecha:** 2026-08-01 · **Tarea:** Auto-refresco de fase en la web pública · **Decisión de arquitectura**

**Contexto.** La web pública decide en servidor (`app/page.tsx`, Server
Component) qué modo mostrar (`antes`/`durante`/`llegada`) en cada petición.
Un visitante con la página ya cargada no ve el cambio de fase hasta que
refresca a mano. Se pide que la web detecte el cambio sola y recargue.

**Opción valorada y descartada:** reutilizar `GET /api/progreso` (ya
devuelve datos del intento activo) añadiéndole el campo `fase`. Descartada:
en modo "durante" habría dos pollings independientes al mismo endpoint cada
30 s (el de `ModoDurante` para el progreso, y el nuevo para la fase), y ese
endpoint ejecuta `calcularProgreso()` — caro — solo para exponer un campo
que no lo necesita.

**Decisión:** endpoint nuevo `GET /api/fase`, de responsabilidad única:
`select fase from intentos where not cerrado`, sin cálculo de progreso, sin
caché (la consulta ya es mínima). Rate limit 60 req/min por IP, mismo
criterio que `/api/progreso`/`/api/comentarios` GET (DT-011).

Un único componente cliente, `RefrescoAlCambiarFase` (`components/publico/`),
se renderiza una vez en `app/page.tsx` junto al modo activo, recibe la fase
actual como prop desde el servidor, hace polling a `/api/fase` cada 30 s
(mismo patrón e intervalo que DT-007) y ejecuta `window.location.reload()`
si la fase del servidor ya no coincide con la mostrada. No se modifica
`ModoAntes`, `ModoDurante` ni `ModoLlegada`.

**Por qué.** Sigue el patrón ya establecido en el proyecto: un endpoint por
responsabilidad (igual que `/api/track`, `/api/comentarios`,
`/api/intenciones`, `/api/progreso`, `/api/admin/login`), consulta mínima en
vez de reutilizar un cálculo caro para un dato que no lo necesita, y sin
introducir Realtime/WebSockets (coherente con DT-007: la audiencia
familiar/amigos no necesita menos de 30 s de latencia).

---

## DT-013 — Minuto a minuto: tabla scoped por intento, Storage público, polling (no Realtime)

**Fecha:** 2026-08-01 · **Tarea:** Minuto a minuto (feed en directo con fotos) · **Decisión de arquitectura**

**Contexto.** Nueva sección "Minuto a minuto" (idea de `roadmap.md`, hasta
ahora sin definir): entradas de texto + foto opcional + posición asociada,
publicadas solo por el admin, visibles en "durante" (en directo) y "llegada"
(recopilatorio), con clic → marcador temporal en el mapa. Mockup aprobado en
`design-sandbox/app/camino/{admin,durante}-minuto-a-minuto/page.tsx`.

**Decisiones sin alternativa real:**

1. **Fotos → Supabase Storage, bucket público** (`minuto-a-minuto`). Mismo
   proyecto Supabase ya existente, sin cuenta nueva. Todas las subidas pasan
   por Server Actions con el cliente `service role`, que bypassa RLS de
   Storage igual que bypassa RLS de BD — no hace falta ninguna política de
   Storage para `insert`. Bucket público porque nada de este contenido es
   privado (mismo criterio que `posiciones`/`comentarios`, ya públicos).
   Alternativas descartadas por el mismo motivo que DT-011 descartó Upstash:
   un servicio externo (Cloudinary) añade una cuenta nueva sin necesidad
   real; base64 en la fila degradaría cualquier consulta del feed.
2. **Tabla `minuto_a_minuto` con `intento_id` FK**, mismo patrón que
   `posiciones`: RLS de `anon` solo `SELECT` de entradas cuyo intento no esté
   `cerrado`, cero políticas de escritura para `anon` (solo `service role`
   vía Server Actions). "Reiniciar" resetea el feed automáticamente, sin
   código extra — coherente con que el resto de datos del intento también
   se resetean así.
   ```sql
   create table minuto_a_minuto (
     id          bigint generated always as identity primary key,
     intento_id  bigint not null references intentos(id),
     texto       text not null check (char_length(texto) between 1 and 500),
     foto_url    text,               -- URL pública de Storage; null = sin foto
     lat         double precision,   -- snapshot de la última posición al publicar
     lon         double precision,
     created_at  timestamptz not null default now(),
     updated_at  timestamptz not null default now()
   );
   create index minuto_a_minuto_intento_idx on minuto_a_minuto (intento_id, created_at desc);
   alter table minuto_a_minuto enable row level security;
   create policy "select_intento_activo" on minuto_a_minuto for select
     using (exists (select 1 from intentos where intentos.id = minuto_a_minuto.intento_id and not intentos.cerrado));
   ```
3. **"Editar" se limita a corregir el texto, no a cambiar la foto adjunta.**
   El mockup no especificaba el detalle de edición; para no gestionar
   borrado/reemplazo de objetos huérfanos en Storage (complejidad real sin
   beneficio para un evento de un día), si la foto está mal la solución es
   borrar la entrada y publicarla de nuevo.
4. **`Mapa.tsx` gana una prop opcional `puntoResaltado`** (`{lat, lon, hora}
   | null`), pintada por el overlay SVG existente igual que el resto de
   marcadores — aditiva, valor por defecto `null`, no cambia el
   comportamiento actual cuando no se usa.

**Decisión con tradeoffs — actualización en vivo en "durante":**
**Polling** de entradas nuevas cada 30 s (extiende DT-007), no Supabase
Realtime. Descartado Realtime por ser la primera vez que el proyecto lo
introduciría, con gestión de conexión/reconexión que DT-007 ya evitó
explícitamente por no aportar nada real a esta audiencia (30 s es
imperceptible para audiencia familiar/amigos mirando el móvil de vez en
cuando). En "llegada" el feed se carga una vez, sin polling (modo ya
diseñado para quedar congelado, ver `ModoLlegada.tsx`).

**Nota (2026-09-30, plataforma).** El bucket `minuto-a-minuto` se creaba en
`0002_minuto_a_minuto.sql`, que pertenece al proyecto Supabase original; el
schema de la plataforma (`0007`) no lo incluía, así que en el proyecto de la
plataforma no existía y toda subida de foto (feed, llegada, quién camina)
fallaba. Lo crea `supabase/migrations/0013_bucket_fotos.sql` (público, 4 MB,
jpeg/png/webp), aplicada y verificada. La columna `clave_envio` de la tabla
la añade `0014` (DT-033).

---

## DT-014 — Snapshot de posición de `crearMinutoAMinuto` desde la caché compartida de `/api/progreso`, no de una lectura fresca de `posiciones`

**Fecha:** 2026-08-02 · **Tarea:** Fix — coherencia entre el snapshot de "Minuto a minuto" y el mapa público · **Decisión de arquitectura (Opción A)**

**Contexto.** `crearMinutoAMinuto` (`app/admin/actions.ts`, DT-013) guardaba
el `lat`/`lon` de cada entrada nueva leyendo en fresco y sin caché la última
fila de `posiciones` (`SELECT lat, lon ... ORDER BY ts DESC LIMIT 1`). Pero
el mapa público muestra la posición servida por `GET /api/progreso`, que
tiene caché de hasta 20 s en servidor (DT-007) más polling de 30 s en
cliente. El resultado: una entrada podía quedar con una coordenada más
"adelantada" que la que el mapa está pintando en ese instante para
cualquier espectador — inconsistencia visible entre el feed y el mapa al
pinchar la entrada (`puntoResaltado`, DT-013).

**Decisión.** Extraer el estado de caché de `app/api/progreso/route.ts` a un
módulo compartido, `lib/progreso-cache.ts` (misma forma de datos
`{timestamp, valor: ProgresoPublico}`, mismas funciones de lectura/
escritura/limpieza, mismo `CACHE_TTL_MS = 20_000`). `route.ts` pasa a usar
ese módulo — su comportamiento externo (respuesta HTTP, TTL, rate limiting)
no cambia. `crearMinutoAMinuto` deja de consultar `posiciones` y lee en su
lugar `obtenerCacheProgreso()?.valor.ultimaPosicion`:

- Si hay caché con `ultimaPosicion` no nulo → usa ese `lat`/`lon`: es
  exactamente la coordenada que el mapa público está mostrando ahora mismo.
- Si no hay caché, o `ultimaPosicion` es `null` (nadie ha llamado a
  `/api/progreso` todavía en este proceso, o el intento no tiene ninguna
  posición aún) → la entrada se guarda con `lat: null, lon: null`, igual que
  el caso ya existente hoy de "aún no hay ninguna posición registrada".
  **Sin fallback a una lectura fresca de `posiciones`** — reintroducir ese
  fallback deshace el fix.
- No se comprueba el TTL al leer: cualquier valor presente es "lo último
  calculado/pintado" y es válido usarlo tal cual, esté o no dentro de su
  ventana de 20 s. El TTL solo determina si `/api/progreso` recalcula en la
  siguiente petición GET, no invalida retroactivamente un dato ya servido.

**Por qué.** Es la solución más simple que resuelve la causa raíz real (dos
fuentes de verdad para "la posición actual de Santi": la caché de
`/api/progreso` que ve el público, y una query directa que veía el admin)
sin tocar el esquema de BD ni el contrato de `/api/progreso`.

**Riesgo aceptado — no hay garantía entre invocaciones de funciones
serverless en Vercel.** Igual que DT-007/DT-011, esta caché vive en memoria
de proceso: no se comparte entre instancias ni regiones, no sobrevive a un
cold start. Si `crearMinutoAMinuto` se ejecuta en una instancia serverless
que nunca ha atendido una petición `GET /api/progreso` (o que tuvo un cold
start reciente), la caché está vacía y la entrada se guarda con `lat`/`lon`
a `null` — aunque haya posiciones reales en BD. Este es el mismo tipo de
limitación ya aceptada en DT-007 y DT-011, no una nueva categoría de riesgo
para el proyecto.

**Alternativas valoradas.**
- **Opción B (descartada por ahora): persistir el último snapshot en BD**
  (por ejemplo una fila `ultima_posicion_publica` en `intentos`, actualizada
  por `/api/progreso` en cada recálculo). Resolvería el riesgo de caché vacía
  entre instancias con garantía real, pero exige migración de esquema y
  escritura desde un GET público — mayor alcance para un fix cuyo síntoma es
  cosmético (desalineación de unos pocos metros/segundos entre feed y mapa,
  nunca datos incorrectos ni de otro intento).
- **Fallback a `posiciones` si la caché está vacía.** Descartada
  explícitamente: es exactamente el comportamiento que causaba el problema
  original — reintroduce la posibilidad de que la entrada quede "por
  delante" del mapa.

**Si en producción se observa demasiada frecuencia de `lat`/`lon` a `null`**
(por ejemplo, cold starts frecuentes en el entorno serverless de Vercel
durante el reto) habría que escalar a la Opción B — persistencia del
snapshot en `intentos`, con su propia migración y actualización desde
`/api/progreso`.

**Actualiza `arquitectura.md`**: se añade `lib/progreso-cache.ts` a la tabla
de estructura, y se documenta que es la fuente del snapshot de posición de
`crearMinutoAMinuto`, no `posiciones` directamente.

---

## DT-015 — La extensión sur usa la variante `t03v` en vez de `t03` (verificado contra GPX real); el corredor no persigue precisión de mojón

**Fecha:** 2026-08-07 · **Tarea:** Fix — corrección de la extensión sur del corredor (`scripts/simplificar-traza.ts`) · **Decisión de geometría, sin alternativas de diseño reales**

### 1. El fix de geometría

**Contexto.** DT-005 extiende el corredor ~4,7 km al sur de O Porriño usando
el tramo `CPO-e01t03-TUI-O_PORRIÑO(PolígonoIndustrial-OPorriño)` del KML
oficial de la Xunta (`docs/traza-source/doc.kml`, bloque índice 2, "t03"),
desde su índice 0 (centro de O Porriño) hasta su índice 126 (~3.046 m al
sur).

**Hallazgo.** Contrastado contra un track GPS real de un peregrino
(Wikiloc, `camino-de-santiago-portugues-1a-etapa-tui-porrino-2018.gpx`,
3.308 puntos, etapa Tui→O Porriño), `t03` se desvía del camino que se anda
de verdad de forma creciente hacia el sur: en su índice 126 (el corte
antiguo) la separación al punto más cercano del track real es **838,1 m**.
No es un caso aislado — la desviación crece de forma sostenida desde el
índice ~90 en adelante.

El mismo KML contiene una variante alternativa,
`CPO-e01t03v-TUI-O_PORRIÑO(TramoAlternativo-AsGándaras-Porriño)` (bloque
índice 3, "t03v", 863 puntos), que sí sigue el camino real en esa zona.

**Empalme exacto verificado.** El índice 0 de `t03v`
(lon −8,62272810062411, lat 42,14596909710470) coincide con el índice 94 de
`t03` con **distancia 0,00 m** — es una bifurcación literal del KML, no una
aproximación ni una coincidencia geográfica casual.

**Criterio de corte del extremo sur de `t03v`.** Se comparó (haversine) cada
uno de los 863 puntos de `t03v` contra el punto más cercano del track GPS
real, usando como vara de medir el orden de magnitud de los umbrales ya
validados del dominio (`lib/traza/umbrales.ts`: `EN_RUTA_MAX_M = 50`,
`DESVIO_MENOR_MAX_M = 250` — solo como referencia de fiabilidad geométrica
en este análisis puntual, no se editan ni se usan en runtime). Resultado:
la separación se mantiene siempre por debajo de 128 m en todo el bloque, con
un único pico de 127,8 m justo en el índice 0 (la propia bifurcación) que
baja a menos de 20 m hacia el índice 11, un segundo pico menor de hasta
93 m entre los índices ~430-448, y el resto casi siempre por debajo de
10-20 m. Nunca se acerca a `DESVIO_MENOR_MAX_M` (250 m). **Conclusión: se
usa el bloque `t03v` completo**, sus 863 puntos (índices 0 a 862).

**Composición resultante** (`scripts/simplificar-traza.ts`): `t03` desde el
centro de O Porriño (índice 0) hasta la bifurcación (índice 94) + `t03v`
completo desde la bifurcación hacia el sur (índices 0 a 862, sin duplicar el
punto de bifurcación). El nuevo corte sur queda a **8.508,2 m** del centro
de O Porriño (antes: 3.045,6 m) — el corredor se alarga, no se acorta.
Guardarraíl cumplido explícitamente antes de implementar.

**No se persigue el empalme con `t02`.** El extremo sur de `t03v` queda a
**1.358,9 m** del inicio del bloque `t02`
(`CPO-e01t02-TUI-O_PORRIÑO(PonteDasFebres-PolígonoIndustrial)`) — un tramo
sin conexión documentada en el KML entre ambos bloques. Fuera de alcance
deliberadamente: el corredor ya gana ~5,5 km de margen sur fiable con solo
`t03v`; cerrar ese hueco de 1,4 km exigiría o bien dibujar geometría manual
(mismo tipo de deuda ya aceptada para el tramo final norte, ver DT-002) o
investigar más bloques del KML sin verificación GPS disponible en esta
tarea. No aporta nada al objetivo real del corredor (dar margen sur
suficiente), así que no se persigue.

**Resultado tras regenerar (`pnpm simplificar-traza`):** `traza.geojson`
pasa de 7.121 a **7.951 puntos**, de **104,9684 km a 110,4310 km**
(+5.462,6 m, todo en la extensión sur). `traza-mapa.geojson` (pintado) pasa
a 2.101 puntos, 110,1328 km.

### 2. Aclaración de DT-005: el corredor no persigue precisión de mojón

DT-005 ya establece que el corredor es *"el recorrido previsto"*, no *"el
recorrido real"* — la precisión fina del progreso mostrado el día del reto
la resuelve el anclaje al primer punto GPS real del intento
(`calcularProgreso`, ancla en `validas[0]`, dominio cerrado y sin tocar en
esta tarea). Esta corrección de geometría **no busca acertar el mojón físico
"100 km"** — busca únicamente que el corredor tenga margen sur suficiente
para que `clasificarEstado` (`lib/traza/proyeccion.ts`) no muestre
`desvio-mayor` al primer punto real del intento, sea cual sea el punto
exacto donde Santi pulse Iniciar dentro de la zona corregida.

**Contexto no bloqueante — investigación de mojones reales.** Durante esta
tarea se localizaron en OpenStreetMap dos mojones del Camino Portugués
Central georreferenciados al norte de O Porriño (lat 42,1696, marcado
"97,602"; lat 42,1934, marcado "94,512"), ambos fuera de la zona corregida
por este fix. Se intentó usarlos para calibrar el desfase entre la traza y
la escala grabada en piedra (mismo problema documentado en DT-005 y
`DEBT.md`), pero la calibración no fue concluyente con los dos únicos puntos
disponibles y no formaba parte del alcance aprobado de esta tarea — queda
como contexto para una futura tarea de calibración de mojones, no como
bloqueo de esta.

### Alternativas valoradas

- *Corregir solo el tramo más desviado de `t03` con geometría manual
  dibujada a mano.* Descartada: el KML oficial ya tiene un tramo real
  (`t03v`) verificado contra GPS — no hay motivo para dibujar a mano cuando
  existe dato oficial mejor.
- *Perseguir el empalme completo con `t02` para no dejar ningún hueco sin
  documentar.* Descartada por alcance: el corredor ya cumple su objetivo
  (margen sur suficiente) sin cerrar ese hueco; ver razonamiento arriba.
- *Recalibrar el mojón físico "100 km" con los dos mojones de OSM
  encontrados.* Descartada: dos puntos no bloqueantes y no concluyentes no
  justifican reabrir el diseño de "corredor con margen" que DT-005 ya
  resolvió con una solución más robusta (anclaje al primer punto real).

**Actualiza `arquitectura.md`**: tabla de las dos trazas con las cifras
nuevas (7.951 puntos, 110,43 km de cálculo / 110,13 km de pintado) y el
comentario de estructura de `traza.geojson`. **Actualiza `DEBT.md`**: sin
deuda nueva — el hueco de 1,4 km con `t02` y la calibración de mojón físico
ya estaban registrados (DEBT.md, entrada "Desfase entre la pantalla y las
piedras") y siguen igual de vigentes, sin cambio de prioridad.

---

## DT-016 — Modo de intento (guiado/libre): camino paralelo con tipos unión, sin tocar `proyeccion.ts`

**Fecha:** 2026-08-07 · **Tarea:** Feature — modo de intento configurable desde el admin · **Decisión de arquitectura (Opción B)**

**Contexto.** El usuario quiere poder elegir, al pulsar "Iniciar", entre el
modo actual ("guiado": progreso sobre la traza del Camino Portugués — %, km,
ritmo, ETA) y un modo nuevo ("libre": pensado para trazar otras rutas, en
cualquier lugar). En modo libre se fija un destino (lat/lon) al iniciar; la
web muestra solo la distancia restante en línea recta (haversine) hasta ese
destino, y el mapa dibuja únicamente el trazado de los puntos GPS recibidos,
sin ninguna línea de ruta de fondo. Dato decisivo: los puntos de modo libre
se aceptan y dibujan **sin validar si tienen sentido** (sin el rechazo por
velocidad implícita imposible que sí aplica `calcularProgreso()` en modo
guiado) — eso descarta reutilizar el dominio de progreso guiado con un flag
interno.

**Decisión.**
- Migración nueva: `intentos.modo` (`'guiado' | 'libre'`, default
  `'guiado'`) + `intentos.destino_lat`/`destino_lon` (nullable, solo se
  rellenan en modo libre). El modo se fija en `iniciarReto()` (transición
  `antes` → `durante`) y no cambia durante la vida del intento — para
  cambiarlo hace falta "Reiniciar".
- `ProgresoPublico` (`lib/types.ts`) pasa a ser una **unión discriminada** por
  `modo`: la rama `'guiado'` mantiene exactamente los campos actuales
  (`porcentaje`, `kmAvanzados`, `kmRestantes`, `odometroKm`, `estado`); la
  rama `'libre'` expone `distanciaRestanteKm: number | null`. `ultimaPosicion`
  se mantiene en ambas ramas (mismo nombre y tipo) para que
  `lib/progreso-cache.ts` y `crearMinutoAMinuto` (DT-014) sigan leyéndolo sin
  narrowing especial.
- Nueva función de dominio pura, fuera de `lib/traza/proyeccion.ts`
  (`proyeccion.ts` no se toca — dominio cerrado, DT-014/DT-015), que calcula
  `distanciaRestanteKm` con `haversineKm` entre la última posición no
  descartada y el destino. Sin corredor, sin rechazo de velocidad, sin
  anclaje de porcentaje.
- `app/page.tsx` bifurca una sola vez, arriba, según `intentoActivo.modo`,
  hacia componentes propios `ModoDuranteLibre`/`ModoLlegadaLibre` (no ramas
  condicionales dentro de `ModoDurante`/`ModoLlegada`).
- `components/mapa/Mapa.tsx` gana un prop `variante: "ruta" | "libre"` — en
  `"libre"` omite la traza de fondo y el overlay de color andado/restante, y
  solo dibuja la polilínea de los puntos recibidos. Reutiliza la
  inicialización de MapLibre/worker (la parte fràgil documentada en
  `docs/LESSONS.md`) en vez de duplicarla en un componente de mapa aparte.
- `app/api/track/route.ts`: se reordena para resolver primero
  `{id, modo}` del intento activo, y el filtro de plausibilidad geográfica de
  100 km (DT-006 capa 1) solo se aplica si `modo === 'guiado'`. En modo
  libre no hay traza contra la que comparar, así que el filtro queda
  desactivado por completo para ese intento.

**Por qué.** El requisito de "aceptar puntos sin validar" es estructuralmente
incompatible con reutilizar `calcularProgreso()` (que sí valida velocidad y
corredor). Separar el camino evita que una corrección futura del dominio
guiado afecte sin querer al modo libre (o viceversa), mantiene
`proyeccion.ts` como dominio puro cerrado, y el tipo unión hace imposible en
tiempo de compilación mezclar datos de un modo con la UI del otro — sin
opcionales sueltos ni `any`.

**Alternativas valoradas.**
- **Opción A (descartada): rama condicional dentro de los componentes
  existentes**, con `ProgresoPublico` de campos opcionales. Descartada
  porque llena los componentes de stats de `if (modo === 'libre')` y
  `?.`/`??`, y con TypeScript estricto los opcionales obligan a null-checks
  en cada consumidor aunque el modo ya se sepa en ese punto — viola el
  principio de responsabilidad única por archivo (framework, sección 7).
- **Reutilizar `calcularProgreso()` con un flag interno que desactive
  validación en modo libre.** Descartada: mezclar en una función de dominio
  cerrada dos conjuntos de invariantes incompatibles (guiado valida,
  libre no) es más frágil que mantenerlas separadas, y contradice el
  criterio ya aplicado en DT-014/DT-015 de no tocar `proyeccion.ts` sin
  necesidad real.

**Actualiza `arquitectura.md`** y **`modelo-datos.md`**: nueva migración,
campos nuevos de `intentos`, componentes nuevos de modo libre, y la nota de
que el filtro geográfico de `/api/track` es condicional al modo del intento.

### Nota posterior (2026-09-30) — sin ruta, solo modo libre

Un reto sin ruta (`ruta_id` null, FP2.5) podía iniciarse en modo guiado (el
default del selector) y quedaba sin destino. `lib/retos/modo-inicio.ts`
(`modosDeInicioPermitidos`, puro) decide los modos admitidos: sin ruta, solo
`libre`. `iniciarReto` lanza "Este reto no tiene ruta: solo se puede iniciar en
modo libre, con un destino." sin escribir, y `ActividadAcciones` no ofrece
"Guiado" (preselecciona libre y lo explica). Como el resto de transiciones de
fase, la acción lanza en vez de devolver resultado: en producción Next redacta
el mensaje, pero la interfaz ya no permite llegar a ese caso.

---

## DT-017 — Fotos del minuto a minuto: compresión adaptativa en el navegador + reintento, sin subida directa a Storage

**Fecha:** 2026-08-09 · **Tarea:** Fix de la subida de fotos del minuto a minuto · **Decisión de arquitectura**

**Contexto.** Vercel rechaza en el edge, con `413` y
`x-vercel-error: FUNCTION_PAYLOAD_TOO_LARGE`, cualquier petición de más de
~4,5 MB, **antes de invocar la función**. Medido contra producción el
2026-08-08: body de 4,0 y 4,3 MB llegan a la función (`401`), body de 4,5 / 5
/ 6 MB devuelven `413`. Como la foto viaja dentro del `FormData` de la Server
Action `crearMinutoAMinuto` (DT-013), cualquier foto de más de ~4,4 MB nunca
llega a ejecutar código del proyecto. Durante la prueba real del 2026-08-07
esto dejó a Santi 2 h 30 min sin poder publicar fotos.

Dos creencias falsas que había codificadas en el proyecto y que esta decisión
corrige: (a) `experimental.serverActions.bodySizeLimit: "10mb"` en
`next.config.ts` no puede elevar el límite — es de aplicación, no de
plataforma; (b) `TAMANO_MAXIMO_BYTES = 8 MB` en `lib/supabase/storage.ts` era
inalcanzable, porque ninguna petición de ese tamaño llega a evaluarse.

**Decisión.** La foto se re-codifica en el navegador **antes** de enviarla,
con una escalera adaptativa que conserva el máximo de calidad que quepa en el
presupuesto, y el envío reintenta solo ante fallos de red.

1. **Escalera adaptativa, no parámetros fijos.** Se prueba primero
   **resolución nativa a calidad alta** y solo se baja un peldaño (calidad,
   luego dimensiones) si el resultado no cabe en el presupuesto. Medido sobre
   las 4 fotos reales del intento 10 (todas 4032×3024, 12,2 MP, originales de
   2,04 a 4,48 MB): a resolución completa y calidad 0,92 quedan en 1,72-3,42
   MB — es decir, **el caso normal conserva la resolución nativa intacta** y
   aun así baja del límite. Solo una foto excepcionalmente pesada llega a
   perder dimensiones, y solo lo justo.
2. **Presupuesto por debajo del corte de plataforma.** El objetivo del
   compresor y el `TAMANO_MAXIMO_BYTES` del servidor se fijan por debajo de
   los ~4,5 MB de Vercel, para que el límite que se aplique sea el nuestro,
   con nuestro mensaje, en vez del `413` mudo del edge.
3. **Degradación sin bloqueo.** Si el navegador no puede procesar la imagen,
   no se impide publicar: se intenta con el fichero original, y si ese
   tampoco cabe, el error sale en el móvil al instante, sin gastar una subida
   condenada a fallar por una conexión mala.
4. **Reintento automático con espera creciente**, y el composer nunca pierde
   el texto ni la foto al fallar. **Sin cola persistente**: iOS Safari no
   soporta Background Sync, así que ninguna web puede subir con la pantalla
   bloqueada — prometer "se envía cuando se pueda" en segundo plano sería
   falso. El reintento cubre lo que sí es posible: reanudar solo al volver a
   primer plano.

**Alternativas valoradas.**
- **Subida directa del navegador a Supabase Storage con signed upload URL
  (descartada).** Se salta el límite de Vercel y conserva el original íntegro,
  pero no resuelve el problema real: seguir mandando 4-8 MB por 4G rural
  durante 30 h es precisamente lo que falla. Además convierte un viaje de red
  en dos, añade un endpoint nuevo que proteger y limitar, deja objetos
  huérfanos en Storage si el segundo paso falla, y rompe la invariante de
  DT-013 ("todas las subidas pasan por Server Actions con `service role`")
  a pocos días del evento.
- **Compresión + subida directa como red de seguridad (descartada).** Cubre
  el caso de que la compresión no baje del límite, que con la escalera
  adaptativa no se da: todo el coste y el riesgo de la anterior para un caso
  que no ocurre.
- **Compresión fija a 1600 px (descartada tras medirlo).** Era la propuesta
  inicial. Los datos de arriba la desmontan: reduce 11x el tamaño cuando con
  1,9x ya se baja del límite, sacrificando resolución sin necesidad. La
  lección general queda en `docs/LESSONS.md`: en una foto de móvil el peso
  está sobre todo en el encoder, no en los píxeles — medir antes de elegir
  parámetros de compresión.

**No cambia** el contrato de `crearMinutoAMinuto` ni el esquema de BD ni las
políticas de Storage: la Server Action sigue recibiendo un `File` en el
`FormData` y subiendo con `service role`. Todo el cambio vive en el borde
cliente y en los umbrales.

### Nota de cierre (2026-08-09) — tres desviaciones respecto a lo aprobado arriba

Aprobadas por el Reviewer en la Ronda 1 de revisión. Se dejan escritas aquí
porque este documento es el registro permanente: el detalle completo estaba
solo en `docs/tareas/CURRENT.md`, que se archiva al cerrar la tarea.

1. **El contrato de `crearMinutoAMinuto` sí cambió: `Promise<void>` →
   `Promise<ResultadoPublicacion>`** (`{ ok: true } | { ok: false; mensaje }`,
   en `lib/types.ts`). El párrafo de arriba afirma lo contrario y se corrige
   aquí. **Por qué:** el punto 5 exige que Santi vea el motivo real del fallo,
   y con un `throw` eso es imposible en producción — Next redacta el mensaje
   de todo error lanzado en el servidor y lo sustituye por un texto genérico
   con digest, justo el "error genérico" que el prompt clarificado prohíbe. Es
   además lo que recomienda la propia guía de Next para errores esperados de
   formulario ("model expected errors as return values"). Lo que sí se
   mantiene intacto es lo que este DT declaraba fuera de alcance: sigue
   recibiendo un `File` en el `FormData`, subiendo con `service role`, sin
   tocar esquema ni políticas de Storage.

2. **El composer envía con `onSubmit` + `preventDefault`, no con
   `<form action={fn}>`.** React 19 solicita un reset del formulario *antes*
   de ejecutar una `action` de tipo función (`startHostTransition` llama a
   `requestFormReset` y después a la acción), y ese reset se aplica al
   terminar la transición, haya ido bien o mal. Con `action`, al fallar el
   envío se vaciaría el `<input type="file">` —no controlado— dejando la
   miniatura en pantalla sin fichero detrás: rompía el punto 4 ("si falla, no
   se pierde lo escrito").

3. **Los peldaños "a resolución nativa" están acotados a 4032 px de lado
   largo** (`LADO_LARGO_MAXIMO_PX`), no son ilimitados. **Por qué:** Safari en
   iOS limita el área de un `<canvas>` a 16.777.216 px y por encima de ese
   límite no lanza — `toBlob` devuelve un JPEG válido pero **en blanco**, que
   pasaría todas las validaciones de tamaño y se publicaría. Los iPhone
   recientes capturan a 24 MP (5712×4284) y pueden llegar a 48 MP. La cota se
   fija en 4032 px porque es el lado largo de las fotos de 12 MP sobre las que
   se midió la tabla de este DT: esas fotos siguen codificándose a resolución
   nativa byte por byte igual, y una foto de 24 o 48 MP acaba en 4032×3024,
   que es exactamente la resolución para la que existen las mediciones.

---

## DT-018 — Histórico de posiciones: paginación completa + proyección con ventana deslizante en `calcularProgreso`

**Fecha:** 2026-08-09 · **Tarea:** Corte a 1000 filas del histórico de posiciones · **Decisión de arquitectura**

**Contexto.** PostgREST (Supabase) limita a 1000 filas cualquier `SELECT` sin
`Range` explícito. Las dos consultas que alimentan el progreso y el mapa
(`app/api/progreso/route.ts`, `app/page.tsx`) piden el histórico completo sin
paginar. Verificado con la clave `anon` real: 564 puntos (2 h 21 min) del
intento 10 quedaron fuera de todo lo que el histórico alimenta —
`ultimaPosicion`, `odometroKm`, `porcentaje`/`kmAvanzados`/`kmRestantes`, la
polilínea del mapa en modo libre. En modo guiado real (30 h, ~7200 puntos a
15 s de cadencia), el corte llegaría a las ~4 h de empezar.

**Hallazgo que cambió el alcance de la tarea.** Medido con el algoritmo real
del proyecto (`tsx`, sin reimplementar nada) contra la traza real
(`traza.geojson`, 7951 vértices, 110,43 km) y un histórico sintético a ritmo
humano constante (4,5 km/h, cadencia 15 s — por debajo del umbral de 15 km/h
de `VELOCIDAD_MAX_KMH`, para que ningún punto se descarte y el benchmark mida
el camino real de `calcularProgreso`, no el atajo barato del rechazo por
velocidad):

| n (puntos) | `calcularProgreso` actual (full-scan por punto) |
|---|---|
| 2000 (≈ 8,3 h de reto) | 53,2-53,9 s |
| 7200 (≈ 30 h de reto, día completo) | **281,4 s (4,7 min)** |

**Arreglar solo el corte de 1000 filas habría sido peligroso, no una mejora.**
Con la paginación arreglada pero el algoritmo intacto, cada recálculo de
`/api/progreso` con el histórico de un día completo tardaría varios minutos —
muy por encima de cualquier timeout de función serverless (el proyecto no
declara `maxDuration`, así que aplica el límite por defecto de la plataforma).
La causa: `calcularProgreso` proyecta cada punto del histórico sobre **toda**
la traza con `@turf/nearest-point-on-line` (`O(n × m)`, con `m` = 7951
segmentos) — la misma complejidad ya señalada como deuda en `DEBT.md`
("`kmAcumulados` se calcula pero no se usa").

**Decisión — dos cambios, ninguno cambia el contrato externo de nada:**

1. **Paginación completa donde de verdad hace falta el histórico entero.**
   Función compartida que pagina con `.range()` en bucle hasta agotar
   (con tope de seguridad y logging si se alcanza, para no colgarse en
   silencio ante un caso patológico). Se usa en `calcularProgreso` (modo
   guiado, siempre necesita el histórico completo: el odómetro suma
   distancia real entre cada par consecutivo, y el máximo monótono se
   calcula sobre toda la secuencia) y en la construcción inicial de
   `puntosGps` del mapa en modo libre (`app/page.tsx`, solo en la carga de
   página).
2. **La ruta de polling en modo libre deja de pedir el histórico completo.**
   `calcularProgresoLibre` solo usa la posición no descartada más reciente
   — cambia a `.order(ts desc).limit(1)` en `/api/progreso`. Mismo
   resultado, sin traer miles de filas para quedarse con una.
3. **Proyección con ventana deslizante dentro de `calcularProgreso`** (el
   cambio que hace viable el punto 1 a escala de un día completo). Como el
   histórico se procesa en orden cronológico y una persona caminando no
   teletransporta, se mantiene el índice de traza del último punto
   proyectado y cada punto siguiente busca primero solo en una ventana de
   **±30 segmentos** (±≈417 m de corredor) alrededor de ese índice — con
   `@turf/nearest-point-on-line` sobre un *slice* de `traza.coordenadas`, no
   sobre la traza completa. Si la mejor coincidencia de la ventana queda a
   más de **300 m** (por encima de `DESVIO_MENOR_MAX_M`, así que cualquier
   punto en ruta o con desvío menor siempre se resuelve por ventana; solo un
   desvío mayor o un hueco de datos largo puede no encajar), se reintenta
   con un escaneo completo de la traza — igual que hace hoy el código sin
   ventana — y el índice se realinea desde ahí. La ventana y el umbral se
   suben a `lib/traza/umbrales.ts` como constantes nombradas (`VENTANA_...`,
   mismo criterio que el resto de umbrales: ajustables en caliente el día
   del reto si hiciera falta).

   **Medido con el algoritmo real, ventana ±30 / umbral 300 m:**

   | Escenario | Full-scan (actual) | Con ventana | Diferencia |
   |---|---|---|---|
   | 2000 puntos, marcha normal | 53,2-53,9 s | 0,71 s (75,2×) | odómetro 0,0000 km |
   | 7200 puntos, marcha normal (día completo) | 281,4 s | **2,87 s** | (extrapolado de lo anterior, mismo patrón) |
   | 500 puntos con desvío real de ~3 km (300 normal → 50 desviados → 150 reenganchados) | referencia | 0,0 s de diferencia perceptible, 3 escaneos completos de 500 | odómetro y `kmAvanzados` **idénticos** (0,0000 km), `separacionM` idéntico |

   El caso del desvío confirma que el mecanismo de respaldo (reintentar con
   escaneo completo) preserva la corrección exacta incluso cuando alguien se
   sale de la traza más allá de la ventana — nunca da un resultado distinto
   al del código actual, solo tarda más en ese caso puntual (raro, no es el
   estado estable de las 30 h).

**No cambia:** el contrato externo de `calcularProgreso` (mismo
`Posicion[]` + `TrazaPreparada` → mismo `Progreso`), `progreso-libre.ts`,
`separacionDeTrazaM` (llamada una vez por posición entrante en `/api/track`,
no en un bucle sobre el histórico — sin problema de escala, no se toca), ni
el esquema de BD.

**Alternativas valoradas.**
- **Paginar sin optimizar el algoritmo (descartada tras medirlo).** Era la
  propuesta inicial de esta tarea. Los datos de arriba la descartan: habría
  cambiado "el mapa se congela a las 4 h" por "el endpoint tarda minutos en
  responder ya desde la primera hora" — un fallo distinto, y peor, no una
  solución.
- **Persistir progreso incremental en `intentos`, actualizado en la
  ingesta (descartada).** Resuelve el mismo problema de raíz sin necesidad de
  recorrer el histórico en cada lectura, pero exige tocar el endpoint de
  ingesta y el esquema de BD, con migración, a días del reto — el mismo
  criterio de riesgo/alcance por el que ya se descartó en DT-007 (Opción C) y
  en la entrada de `DEBT.md` sobre `kmAcumulados`. La ventana deslizante logra
  la misma robustez (validada con los mismos datos: full-day baja de 281 s a
  2,87 s, dentro de cualquier presupuesto de timeout razonable) sin tocar
  ingesta ni esquema. Queda registrada como mejora de fondo si en producción
  real hiciera falta ir más allá.

**Actualiza `arquitectura.md`** con la función de paginación nueva, y
`umbrales.ts` con las dos constantes de la ventana.

### Nota de cierre (2026-08-09) — endurecimiento post-revisión de Seguridad (S1 + S2)

Aprobado por el Reviewer sin bloqueantes en la Ronda 1. El Agente de
Seguridad encontró 2 bloqueantes reales, ambos alrededor del propio
mecanismo de respaldo de la ventana deslizante — corregidos antes del
cierre. Se dejan escritos aquí porque este documento es el registro
permanente (mismo criterio que la nota de cierre de DT-017).

**El hallazgo.** El fallback a escaneo completo (arriba: "si la mejor
coincidencia de la ventana queda a más de 300 m, reintenta con un escaneo
completo") cuesta lo mismo por punto (~39 ms medidos) que el problema
original que esta tarea resuelve. Y ese umbral de 300 m
(`VENTANA_PROYECCION_FALLBACK_MAX_M`) es tres órdenes de magnitud más
estricto que el filtro de plausibilidad geográfica de `/api/track` (100 km,
`SEPARACION_TRAZA_MAX_KM`, DT-006). Eso deja un hueco: alguien con el token
de `/api/track` filtrado (riesgo residual ya aceptado en DT-006/DT-011, con
sus propias capas de defensa) puede mandar puntos deliberadamente a más de
300 m entre sí —pero dentro de esos 100 km, y a velocidad plausible
insertando huecos de tiempo— para forzar que cada punto dispare el escaneo
completo. Con el rate limit de 40 req/min (DT-011), ~300 puntos
(~8 min de envío) ya bastarían para que un solo recálculo de
`calcularProgreso` tardara ~11,7 s — por encima de cualquier timeout
serverless. Y como esos puntos quedan persistidos (no `descartado`), el
coste se repite en cada recálculo futuro, no solo una vez: la ventana,
pensada para resolver un problema de volumen, reabría el mismo problema por
una vía de contenido.

**S1 — tope de seguridad al número de fallbacks por llamada.** Nueva
constante `VENTANA_PROYECCION_MAX_FALLBACKS = 50` en `umbrales.ts`.
`calcularProgreso` mantiene un contador propio de la llamada (nunca a nivel
de módulo, para no filtrar estado entre invocaciones distintas); al agotar
el tope, los puntos restantes usan el resultado de la ventana tal cual
—aunque su separación supere el umbral de fiabilidad— en vez de seguir
pagando el escaneo completo, y se registra un único `console.warn` (mismo
patrón que el tope de seguridad de `lib/supabase/paginacion.ts`). Con ~39
ms/fallback, 50 fallbacks acotan el peor caso a ~2 s por invocación — muy
por encima de cuántas veces se desviaría Santi de verdad más de 300 m
durante 30 h reales (unas pocas, no cientos), y muy por debajo de cualquier
timeout serverless. Validado con benchmark adversarial real (no solo
diseño) en `lib/traza/proyeccion.ventana.test.ts`: 300 puntos con el
patrón exacto descrito arriba se calculan en ~1,1 s con el tope activo,
frente a varios segundos (réplica sin ventana ni tope, escalado
linealmente) sin él.

**S2 — la carga de página pública (`app/page.tsx`) amplificaba S1.** A
diferencia de `GET /api/progreso` (que ya usa la caché compartida
`lib/progreso-cache.ts`, TTL 15-20 s, DT-007/DT-014), `calcularProgresoDelIntento`
recalculaba desde cero en cada visita — cada visitante real durante un
ataque habría vuelto a disparar el cálculo caro. Se reutiliza la misma
caché compartida ya existente (consultar antes de calcular, guardar
después), sin infraestructura nueva: el invariante de que solo hay un
intento activo a la vez (`docs/tecnico/arquitectura.md`) hace seguro
compartir la caché entre `/api/progreso` y esta función, ya que ambas
calculan el progreso del mismo (único) intento en curso. `export const
dynamic = "force-dynamic"` no cambia — la página sigue siendo dinámica,
solo que dentro de la ventana de caché no repite el cálculo caro.

**No cambia nada del comportamiento validado en la decisión original**: la
ventana para el caso normal (no adversarial) sigue exactamente igual,
sin tocar; S1 y S2 son capas de defensa alrededor de ella, no un rediseño.
Los tests de `proyeccion.test.ts` y de la sección 1-4 de
`proyeccion.ventana.test.ts` (equivalencia numérica, desvío con reenganche,
hueco largo, rendimiento a escala de un día) siguen en verde sin cambios.

### Nota de cierre (2026-08-09) — el atajo `.limit(1)` de modo libre se revierte en la tarea de estadísticas de modo libre (CURRENT.md/DT-020)

Aprobada por el Orquestador tras el bloqueo mayor señalado por el
Implementador al ejecutar CURRENT.md (feature: tiempo en marcha, ritmo medio
y km caminados en modo libre). Se deja constancia aquí porque este documento
es el registro permanente (mismo criterio que las notas de cierre de
DT-017/DT-020).

**Lo que decía esta entrada:** en el punto 2 de la decisión original,
"la ruta de polling en modo libre deja de pedir el histórico completo" —
`calcularProgresoLibre` solo usaba la posición no descartada más reciente,
así que `calcularProgresoActual` (`lib/traza/progreso-actual.ts`) pedía
únicamente esa fila (`.order(ts desc).limit(1)`) en cada poll de 30 s, en
vez de paginar el histórico completo como sí hace modo guiado.

**Por qué se revierte:** CURRENT.md/DT-020 añade `odometroKm` a
`calcularProgresoLibre` — suma de `haversineKm` entre cada par consecutivo
de posiciones del histórico recibido. Con un histórico de una sola fila (el
atajo de este DT), ese cálculo no tiene ningún tramo que sumar y da siempre
0: la cifra "Caminados" (y el ritmo medio, que depende de ella) era correcta
en la carga inicial de página (`app/page.tsx`, que sí trae el histórico
completo) pero caía a 0 km en el primer poll y se quedaba ahí el resto de la
fase "durante" en modo libre — la premisa de esta optimización ("modo libre
solo necesita el último punto") dejó de ser cierta con la nueva feature.

**Por qué no reabre el hallazgo de Seguridad de este mismo DT (S1/S2):**
S1/S2 son específicos del mecanismo de ventana deslizante con fallback de
`calcularProgreso()` (modo **guiado**) — el vector de denegación de servicio
que motivó esos dos endurecimientos era forzar escaneos completos repetidos
de la traza (~39 ms cada uno). `calcularProgresoLibre` no proyecta nada
sobre ninguna traza: es una suma `O(n)` trivial de `haversineKm` sin Turf de
por medio, ninguna relación con ese vector. El único coste real de volver a
pedir el histórico completo en modo libre es el fetch paginado en sí, que ya
tenía su propio tope de seguridad independiente
(`MAX_PAGINAS` = 50 páginas / 50.000 filas, `lib/supabase/paginacion.ts`) y
queda además acotado por la misma caché compartida con TTL de 20 s que ya
paga modo guiado en cada recálculo (`lib/progreso-cache.ts`, DT-007) — mismo
orden de magnitud de coste que el modo guiado ya asume desde este mismo DT,
no un vector nuevo.

**Qué cambia en el código:** `lib/traza/progreso-actual.ts` — la rama de
modo libre pasa a usar el mismo `obtenerTodasLasFilas` (paginado ascendente
por `ts`) que ya usaba la rama de modo guiado, extraído a un helper interno
compartido `obtenerHistoricoCompleto`. Tests actualizados:
`lib/traza/progreso-actual.test.ts` y `app/api/progreso/route.test.ts`
verifican ahora que modo libre pagina con `.range()` (no `.limit(1)`) y que
`odometroKm` refleja el histórico completo — con guardarraíles explícitos
(`expect(limitMock).not.toHaveBeenCalled()`) para que una regresión futura a
este atajo no pase desapercibida.

---

## DT-019 — `crearMinutoAMinuto`: si la caché de progreso está vacía, recalcular en el momento (reutilizando el cálculo de `/api/progreso`), no leer `posiciones` en bruto

**Fecha:** 2026-08-09 · **Tarea:** Fix — entradas del minuto a minuto sin posición (`lat`/`lon` a `null`) · **Decisión de arquitectura**

**Contexto.** `crearMinutoAMinuto` (`app/admin/actions.ts`) lee la posición a
guardar de `lib/progreso-cache.ts` (DT-014), la misma caché en memoria de
proceso que usa `GET /api/progreso`. Esa caché no se comparte entre
instancias serverless (mismo patrón que DT-007/DT-011). En la prueba real
del 2026-08-07, las **16 de 16** entradas publicadas quedaron con
`lat`/`lon` a `null` — el 100 %, no el caso raro que preveía DT-014
("escalar si se observa con demasiada frecuencia"). Explicación más
probable: con poco tráfico público real ese día, casi nunca había una
petición `GET /api/progreso` reciente que hubiera calentado la caché de la
instancia que atendía cada publicación.

**Decisión.** Cuando la caché está vacía, `crearMinutoAMinuto` ya no se
rinde (`lat`/`lon` a `null`): **recalcula el progreso en el momento,
reutilizando la misma función que ya usa `GET /api/progreso`** para decidir
qué mostrar (`calcularProgresoActual`, hoy privada de
`app/api/progreso/route.ts`), extraída a un módulo compartido para que
ambos puntos de llamada la usen sin duplicar lógica. El resultado recalculado
también rellena la caché (`guardarCacheProgreso`), igual que hace hoy
`route.ts` — mismo comportamiento, dos disparadores posibles.

**Por qué esto y no una lectura en bruto de `posiciones` (la primera
propuesta, descartada tras la pregunta del usuario).** Una lectura directa
del último punto de `posiciones` puede diferir de lo que la web pública está
mostrando en ese instante: en modo guiado, `calcularProgreso` puede
descartar el último punto por velocidad implícita imposible (GPS erróneo) —
su `ultimaPosicion` no es siempre literalmente la última fila insertada.
Reutilizar `calcularProgresoActual` en vez de reimplementar una consulta
aparte garantiza que la entrada del feed queda **siempre** con la misma
coordenada que vería cualquier visitante recargando la web pública en ese
mismo instante — es decir, preserva exactamente el objetivo original de
DT-014 ("coincide con lo que el mapa público está mostrando"), incluso en el
camino de respaldo, no solo en el camino normal (caché caliente).

**Por qué no la Opción B de `DEBT.md` (persistir el snapshot en `intentos`
con migración).** Sigue siendo mayor alcance de lo que este bug necesita: el
100 % observado se explica enteramente por "nadie calentó la caché", y
recalcular bajo demanda lo resuelve sin tocar el esquema. Se descarta por el
mismo motivo que ya la descartó DT-014, reforzado por el precedente real de
este proyecto con una migración pendiente de aplicar a producción
(`0003_modo_intento`, ver `DEBT.md`/`BUGS.md`) — no repetir ese riesgo de
proceso a días del reto para un problema que no lo necesita.

**No cambia:** el camino normal (caché caliente) sigue siendo idéntico a
DT-014 — mismo TTL, misma fuente. El esquema de BD no se toca.

**Actualiza `arquitectura.md`** con el módulo nuevo de progreso compartido.

---

## DT-020 — Tiempo en marcha y ritmo medio: anclados al último punto GPS real, no a la hora del navegador de quien mira

**Fecha:** 2026-08-09 · **Tarea:** Añadir estadísticas al modo libre · **Decisión de arquitectura**

**Contexto.** Al diseñar las estadísticas nuevas para el modo libre, el
usuario señaló un problema que también existe hoy en el modo guiado ya en
producción: `ModoDurante.tsx` calcula "tiempo en marcha" y "ritmo medio"
usando la **hora actual del navegador de quien está mirando la web**
(`ahora`, un `Date` que se actualiza cada 60 s en el cliente), no el momento
del último dato real recibido de Santi.

**Problema concreto.** Si el móvil deja de enviar señal (batería agotada,
sin cobertura — un riesgo real en 30 h de camino rural), "tiempo en marcha"
sigue subiendo con el reloj de quien mira, y "ritmo medio" se desploma
artificialmente (se divide entre más horas de las que realmente hay datos),
aunque no haya pasado nada nuevo desde el último punto GPS real. El número
en pantalla dejaría de reflejar el reto real para reflejar cuánto rato lleva
la pestaña del navegador abierta.

**Decisión.** Tiempo en marcha y ritmo medio se calculan siempre con el
timestamp del **último punto GPS recibido** (`ultimaPosicion.ts`, ya
presente en `ProgresoPublico` en ambos modos) como referencia final, nunca
con `Date.now()`/`new Date()` del cliente. Aplica a los dos modos:

- **Modo guiado, "durante"** (`ModoDurante.tsx`): sus funciones privadas
  `formatearTiempoEnMarcha(iniciadoEn, ahora)` y
  `calcularRitmoMedio(odometroKm, iniciadoEn, ahora)` pasan a recibir
  `progreso.ultimaPosicion?.ts ?? null` como referencia final, no `ahora`.
- **Modo libre, "durante"** (`ModoDuranteLibre.tsx`, nuevo): mismo criterio
  desde el principio, sin heredar el problema.
- **Ambos, "llegada"**: sin cambios de fondo — ya usan `ended_at` (un
  timestamp real de BD, no la hora actual), así que ya cumplían este
  criterio antes de esta decisión.

**Reutilización, no triplicación.** `lib/ritmo.ts` ya tenía
`calcularRitmoMedioIntento(odometroKm, iniciadoEn, finalizadoEn)`, genérica
y ya usada por `ModoLlegada.tsx` — se reutiliza tal cual para el ritmo en
los dos "durante" nuevos/corregidos, pasando `ultimaPosicion?.ts` como
`finalizadoEn` en vez de `ended_at`. Se añade a `lib/ritmo.ts` una función
hermana para formatear el tiempo transcurrido ("H:MM") con la misma forma
de parámetros (`iniciadoEn`, `finalizadoEn`), sustituyendo a la función
privada de `ModoDurante.tsx` — cierra de paso (para los "durante") la
duplicación ya registrada en `DEBT.md` ("`calcularRitmoMedioIntento` y sus
equivalentes"), sin necesidad de abrir esa entrada como tarea aparte.

**Qué queda deliberadamente fuera:** `formatearTiempoTotal` en `app/page.tsx`
(usada por `ModoLlegada.tsx`) ya usa dos timestamps reales
(`started_at`/`ended_at`), sin `ahora` de por medio — no tiene el bug que
esta decisión corrige, así que no es obligatorio migrarla a la función
compartida nueva en esta tarea. Queda como candidato de limpieza futura, no
como deuda nueva (no hay comportamiento incorrecto que registrar).

**Por qué corregir el modo guiado en esta misma tarea (no aparte).** Es
exactamente el mismo bug de fondo en dos sitios, y el modo guiado es el que
se usará en el reto real — dejarlo para "más adelante" habría significado
llevar el problema real al día del evento a cambio de nada (el fix es
igual de barato en los dos sitios, mismo patrón, misma función compartida).

### Nota de cierre (2026-08-09) — una ambigüedad resuelta y un bloqueo mayor encontrado, no corregido en esta tarea

Aprobado por el Implementador durante la ejecución de CURRENT.md. Se dejan
escritas aquí dos cosas que no vivían en el análisis original de DT-020,
porque este documento es el registro permanente (mismo criterio que las
notas de cierre de DT-017/DT-018).

1. **Ambigüedad resuelta: tiempo en marcha sin ninguna posición GPS
   todavía.** El "Comportamiento en casos límite" original de
   `docs/tareas/CURRENT.md` (escrito antes del hallazgo de DT-020) decía que
   el tiempo en marcha "se puede calcular igualmente (depende de
   `started_at`, no de posiciones)" mientras no hubiera ninguna posición. Esa
   frase describe el comportamiento **previo** a esta decisión (cuando la
   referencia final era `ahora`, que no depende de haber recibido ningún
   punto GPS). Con la regla de este DT ("nunca `Date.now()`/`new Date()` del
   cliente, siempre la referencia final que corresponda"), sin ninguna
   posición no hay ninguna referencia final real (`ultimaPosicion` es
   `null`), así que tanto tiempo en marcha como ritmo medio dan "—" hasta que
   llega el primer punto — mismo criterio para las dos cifras, sin
   excepción. Se resuelve así por coherencia con el propio espíritu del DT
   (nunca inventar una referencia temporal que no sea un dato real) y porque
   mantener una excepción solo para "sin posición todavía" habría exigido
   volver a leer `ahora` justo en el caso que este DT identifica como el más
   sensible (arranque del intento, antes de la primera señal GPS real).

2. **Bloqueo mayor encontrado, deliberadamente no corregido en esta tarea:**
   `calcularProgresoActual` (`lib/traza/progreso-actual.ts`) — usada por
   `GET /api/progreso` (el polling de 30 s que alimenta `ModoDuranteLibre.tsx`
   en directo) — pide para modo libre solo la última posición
   (`.limit(1)`, optimización de DT-018, correcta cuando modo libre no
   necesitaba más que el último punto). Con `odometroKm` añadido por esta
   tarea, ese atajo hace que el odómetro (y por tanto el ritmo medio) vuelva
   siempre a 0 en cada poll durante la fase "durante" de modo libre — la
   premisa de DT-018 para modo libre ("solo hace falta el último punto") deja
   de ser cierta con este DT. No se corrige aquí porque el fix (pedir el
   histórico completo también en modo libre, como ya hace modo guiado)
   toca un fichero y un comportamiento explícitamente probado (DT-018) fuera
   del alcance que aprobó el Arquitecto para esta tarea concreta, y revierte
   parcialmente una decisión de arquitectura ya tomada con implicaciones de
   coste durante las 30 h del reto real — corresponde que el Arquitecto lo
   revise, no que el Implementador lo decida en solitario. Detalle completo,
   impacto y solución propuesta en `DEBT.md` ("`GET /api/progreso` no puede
   reflejar `odometroKm` real en modo libre durante el polling en directo").

---

## DT-021 — Mapa público en modo guiado pinta la traza real, no la oficial; nueva vista de comparación en el admin

**Fecha:** 2026-08-11 · **Tarea:** Mapa público pinta solo lo avanzado; panel admin ve ambas trazas + referencia · **Decisión de arquitectura**

**Contexto.** Petición directa de Santi: en modo guiado (`variante="ruta"` de
`components/mapa/Mapa.tsx`), el mapa público pintaba siempre la traza oficial
completa (`trazaCoords`), partida en "andado"/"restante" en el vértice más
cercano a la posición actual — nunca el recorrido GPS real. El cálculo de
distancia restante/ETA (server-side, `lib/traza/proyeccion.ts`) no se toca en
absoluto; esto es solo un cambio de **pintado**.

**Decisión.**

1. **Público, modo guiado:** la variante `"ruta"` deja de recortar
   `trazaCoords` y pinta `puntosGps` (histórico real), mismo mecanismo que ya
   usa la variante `"libre"`. Para ello el modo guiado público pasa a cargar
   el histórico completo server-side y a acumularlo en cada poll de 30 s —
   réplica exacta del patrón ya validado en producción por
   `ModoDuranteLibre.tsx`. Marcador de destino: ⛪ (antes ★, decisión de
   Santi).
2. **Dato nuevo expuesto solo al admin:** `Progreso`
   (`lib/traza/proyeccion.ts`/`lib/types.ts`) gana `puntoProyectado: {lat,
   lon} | null` — el punto que Turf ya calculaba internamente en
   `proyectarPunto` y hasta ahora se descartaba. Cero cambios a la fórmula de
   cálculo existente. **Nunca** se añade a `ProgresoPublicoGuiado`: el
   público sigue sin ver el punto de referencia en la traza oficial.
3. **Admin — pestaña "Mapa" nueva:** función server-side dedicada
   (reutiliza `obtenerHistoricoCompleto`, `cargarTrazaDeCalculo`,
   `cargarTrazaDeMapa`, `calcularProgreso` — no pasa por `aProgresoPublico`)
   que sirve un Server Component estático (mismo patrón que
   `SeccionPosicion.tsx`, sin polling). Pinta traza real completa + traza
   oficial completa (colores distintos) + marcador en el último punto real +
   marcador en `puntoProyectado` + línea discontinua entre ambos. Si el
   intento activo es modo libre, aviso ("sin traza oficial") + solo la
   polilínea real, sin línea de referencia (no aplica el concepto).
4. **`components/mapa/Mapa.tsx`:** se extiende con props aditivas
   (`trazaOficialComparacion?`, `puntoReferencia?`), usadas solo por el
   admin — el público nunca las pasa, comportamiento sin cambios salvo lo
   descrito en el punto 1. Se descarta un componente de mapa aparte para el
   admin (ver alternativas) por duplicar infraestructura ya resuelta
   (worker de MapLibre, patrón de overlay SVG con refs anti-stale —
   `docs/LESSONS.md`).

**Alternativas valoradas (punto 4):** un `MapaComparacion.tsx` independiente
para el admin — descartado: reimplementar el init de MapLibre + overlay SVG
+ `map.project()` es exactamente el tipo de código ya resuelto una vez (y
documentado como frágil en `LESSONS.md`) que no conviene duplicar; el riesgo
de divergencia entre dos mapas a medio plazo pesa más que mantener
`Mapa.tsx` con dos props opcionales más.

**Por qué el punto proyectado real y no una aproximación visual.** Santi
pidió explícitamente que el punto de referencia de la línea discontinua sea
el mismo que usa el cálculo real de distancia restante, no un vértice más
cercano aproximado — evita que la línea del admin sugiera una referencia
distinta de la que realmente determina los km restantes mostrados en
público.

### Nota de cierre (2026-08-12) — ampliación de alcance: `ModoLlegada.tsx`

El Implementador señaló un bloqueo mayor durante la ejecución: `ModoLlegada.tsx`
(pantalla de "llegada", modo guiado) usa `Mapa` con la misma combinación
`variante="ruta"` + `modo="directo"` que `ModoDurante.tsx`, pero no estaba en
el alcance original de los 8 puntos aprobados — no se le pasaba histórico
GPS. Con el cambio de pintado aplicado a esa combinación, la pantalla de
llegada se quedaba sin ninguna polilínea (solo el marcador ⛪), una regresión
visual real no contemplada en el análisis. Correctamente escalado por el
Implementador en vez de decidido en solitario (framework, sección 10).

**Decisión (Orquestador, con el usuario):** ampliar el alcance de DT-021 en
el momento para incluir `ModoLlegada.tsx`, con el mismo patrón ya validado
en producción por `ModoLlegadaLibre.tsx`: `app/page.tsx`
(`ModoLlegadaConectado`) carga `obtenerHistoricoPosiciones` y lo pasa como
`puntosGps`; `ModoLlegada.tsx` reenvía esa prop a `Mapa`. Se prefiere cerrar
esto en la misma tarea, sin dejarlo en `DEBT.md`, porque es una regresión
visible el día del reto (el escenario que la propia web pública existe para
cubrir), y el fix es mecánico y de bajo riesgo (mismo patrón ya en
producción, dos ficheros).

**Resuelto (2026-08-12, Implementador).** Aplicado el fix descrito arriba:
`ModoLlegadaConectado` (`app/page.tsx`) carga `obtenerHistoricoPosiciones`
en paralelo con lo que ya cargaba y lo pasa como `puntosGps`;
`ModoLlegada.tsx` acepta esa prop y la reenvía a `<Mapa variante="ruta">`.
Sin polling (la pantalla ya está congelada por diseño) — se carga una única
vez server-side, igual que el resto de datos de esa pantalla. La entrada de
`DEBT.md` sobre este gap se ha retirado (ya no aplica: quedó cerrado dentro
de esta misma tarea, no como deuda pendiente). Quality gates
(`typecheck`/`lint`/`test`) verificadas en verde tras el fix.

### Nota de cierre (2026-08-12) — bug de bucle infinito encontrado en verificación visual post-merge del PR

Con el PR ya abierto (#24) y Reviewer/Seguridad aprobados, el usuario pidió
un ajuste cosmético menor (icono de la meta: silueta de la Catedral en vez
de ⛪). Al verificar ese cambio en el navegador (`docs/LESSONS.md`: ninguna
quality gate detecta problemas puramente visuales) se encontró que la web
pública **entera** (pantallas "antes"/"durante"/"llegada") entraba en un
bucle infinito de renderizado ("Maximum update depth exceeded") nada más
cargar — un bug real ya presente en el código de este mismo DT-021, no
introducido por el ajuste del icono (confirmado revirtiendo el icono a
solas y reproduciendo el bucle igual).

**Causa raíz.** `components/mapa/Mapa.tsx` desestructuraba `puntosGps = []`
y `trazaOficialComparacion = []` directamente en los parámetros de la
función. Un literal `[]` como valor por defecto crea un array **nuevo** en
cada render cuando el caller no pasa la prop — y ningún caller público pasa
`trazaOficialComparacion` (exclusiva del admin), y `ModoAntes.tsx` tampoco
pasa `puntosGps`. Ambas props son dependencias del `useEffect` que recalcula
el overlay del mapa (línea ~344) y ese efecto sí hace `setState`: array
nuevo en cada render → efecto se dispara en cada render → `setState` →
nuevo render → array nuevo otra vez. Bucle infinito, sin ningún error de
compilación ni test que lo detectara — exactamente el mismo patrón de la
lección de Tailwind/`postcss.config.mjs` en `docs/LESSONS.md`: todo verde,
comportamiento roto, solo visible abriendo un navegador real.

**Fix.** Dos constantes a nivel de módulo (`SIN_PUNTOS_GPS`,
`SIN_TRAZA_OFICIAL_COMPARACION`), reutilizadas como valor por defecto en vez
de un literal `[]` recreado en cada render — misma referencia entre
renders mientras el caller no pase nada explícito, rompe el ciclo.
Verificado en el navegador (Browser pane): sin el fix, `docs de consola`
mostraban decenas de errores de bucle infinito nada más cargar `/`; con el
fix, cero errores de ese tipo en una recarga limpia. Quality gates
(`typecheck`/`lint`/`test`, 348/348) en verde tras el fix.

**Por qué no se detectó en el pipeline normal.** Reviewer no tenía acceso a
herramienta de navegador en su entorno delegado (lo señaló explícitamente en
su informe) y confió en el reporte de tests del Implementador; Seguridad
tampoco ejecuta el navegador (su foco es OWASP, no renderizado). Ninguna de
las 348 pruebas unitarias/de integración monta el componente `Mapa` en un
DOM real con React (usan mocks de Supabase, no renderizado de componentes
cliente), así que un bug de re-render en bucle no tiene ningún test que lo
capture. Queda como recordatorio para el Orquestador: en tareas que tocan
`components/mapa/Mapa.tsx` (o cualquier componente cliente con `useEffect`
+ props de tipo array/objeto), la verificación visual en navegador antes de
cerrar no es opcional aunque Reviewer/Seguridad hayan aprobado — ver
`docs/LESSONS.md` para el patrón general ya registrado.

**Bloqueante de Seguridad (2026-08-12) — coste/DoS (A04/A05), resuelto.**
Seguridad revisó la implementación (con el fix de `ModoLlegada.tsx` ya
incluido) y encontró que `ModoDuranteConectado` y `ModoLlegadaConectado`
(`app/page.tsx`) llamaban a `obtenerHistoricoPosiciones` sin ninguna caché
en cada visita a `/` en modo guiado — antes de esta tarea, con la caché de
`progreso` caliente (`lib/progreso-cache.ts`, TTL 20 s, S2 de DT-018), una
visita a `/` en modo guiado no generaba ninguna consulta a Supabase; DT-021
reabría ese vector de coste porque `/` no tiene rate limiting propio
(DT-011 solo cubre `/api/progreso`). Bloqueante para modo guiado (regresión
de esta tarea); el mismo hueco ya existía para modo libre desde antes
(`DEBT.md`, prioridad Media, no bloqueante por no ser una regresión).
**Fix aplicado:** `lib/historico-cache.ts`, mismo patrón y mismo `CACHE_TTL_MS`
(20 s) que `lib/progreso-cache.ts` — un único slot en memoria de proceso,
válido por el mismo invariante (un solo intento activo a la vez). Reutilizado
por `calcularProgresoDelIntento`, `ModoDuranteConectado`,
`ModoLlegadaConectado` y, de paso, también por `calcularProgresoLibreDelIntento`
(modo libre) — mismo código, cierra también la entrada de deuda ya
registrada para libre en `DEBT.md` sin coste adicional. Tests nuevos en
`lib/historico-cache.test.ts` y `app/page.test.ts` (incluye un test explícito
de que una llamada a `calcularProgresoDelIntento` y una llamada directa
posterior a `obtenerHistoricoPosicionesCacheado` comparten la misma caché,
sin doble consulta a Supabase). Quality gates reverificadas en verde
(348/348 tests) tras el fix.

---

## DT-022 — Pestaña "Tráfico" en el panel admin: tracking server-side en `proxy.ts`

**Fecha:** 2026-08-12 · **Tarea:** Ver cuánta gente visita la web pública durante el reto · **Decisión de arquitectura**

**Contexto.** Petición directa de Santi: quiere ver, desde el admin y mientras camina, cuánta gente entra a la web pública — con gráfico de evolución (curva, no barras, por densidad de puntos), granularidad seleccionable (5 min/30 min/1 h) sobre el rango completo transcurrido (sin recortar ventana), y desglose por página/origen. El rango es desde `intentos.started_at` (inicio del intento activo) hasta ahora — no por día de calendario, porque la marcha puede cruzar medianoche.

**Decisión.**

1. **Captura — tracking server-side en `proxy.ts`, no beacon cliente.** Se evaluaron dos opciones: (A) ampliar `proxy.ts` para interceptar también la web pública e insertar la visita server-side, o (B) un componente cliente con `navigator.sendBeacon` a un endpoint dedicado. Se descartó B: su ventaja típica (evitar contar prefetch de Next.js sobre `<Link>`) no aplica — la web pública de este proyecto es una única ruta (`/`), sin ningún `<Link>` en el código. Sin esa ventaja, B solo añade una pieza extra (endpoint + componente cliente) por evitar una latencia de insert que el proyecto ya acepta en `/api/track` al mismo volumen. `proxy.ts` amplía su `matcher` a `["/", "/admin/:path*"]` — literal, sin regex de exclusión de assets, porque la web pública no tiene más rutas que trackear. Se bifurca por `pathname`: `/admin/*` sigue con la lógica de sesión actual sin cambios; `/` lee/crea una cookie anónima (sin fingerprinting, sin datos personales) e inserta en `visitas_web` vía `getSupabaseAdmin()`, `await`, antes de responder. `proxy.ts` pasa de síncrono a `async`. Si el insert falla, se ignora en silencio — nunca debe romper la petición del visitante real (mismo criterio defensivo que `/api/track`).
2. **Tabla nueva `visitas_web`** (`supabase/migrations/0004_visitas_web.sql`): ruta, timestamp, id de visitante (cookie), referer. Sin política RLS para `anon` — cero acceso público, igual que `intenciones`; solo `service role` lee/escribe. Añadida a `BaseDeDatos` en `lib/supabase/admin.ts` con el envoltorio `Row: Pick<T, keyof T>` (obligatorio, ver comentario en el propio fichero — sin él, `.insert()` resuelve a `never` en silencio).
3. **Sin política de retención.** Igual que el resto de tablas del proyecto.
4. **Pestaña "Tráfico" — un único Server Component** (`SeccionTrafico.tsx`, patrón `SeccionActividad`), sin `useState` ni fetch cliente. Lee todas las visitas del rango (`ts >= started_at` del intento activo) con `obtenerTodasLasFilas` (mismo helper de paginación que ya usa el histórico de posiciones). La granularidad (5 min/30 min/1 h) es un parámetro de URL (`?gran=`), mismo patrón que `?tab=`/`?filtroComentarios=` ya usado en el resto del panel — el servidor agrupa los mismos datos en bruto según el parámetro, sin generar ni guardar series distintas. Gráfico: SVG de curva (no barras) en contenedor con `overflow-x: auto`, ancho proporcional al nº de puntos. Único fragmento `"use client"`: el que hace scroll automático al extremo derecho al montar (leer el ancho del contenedor no se puede hacer server-side).
5. **Sin intento activo** (fase `antes`, sin `started_at`): la pestaña debe manejarlo sin romper, mostrando un estado vacío explícito — no hay rango que acotar.

## DT-023 — Pestaña "Tráfico": fases antes/durante/después del intento relevante + contador reseteable

**Fecha:** 2026-08-12 · **Tarea:** Fases de tráfico + reset del contador · **Decisión de arquitectura**

**Contexto.** DT-022 acotaba `visitas_web` al rango `[started_at, ahora]` del intento activo — sin intento activo, la pestaña no mostraba nada. Petición de Santi: querer comparar tráfico de antes/durante/después del reto, y poder "empezar a contar de cero" en un momento dado sin perder ningún dato en bruto (borrar filas de `visitas_web` no es aceptable — es el histórico real de visitas).

**Decisión.**

1. **Contador reseteable, no rango fijo.** Tabla nueva `config_trafico` (`supabase/migrations/0005_config_trafico.sql`), fila única (`id` fijo con `check`) con `cuenta_desde timestamptz` (default `2020-01-01`, sin cutoff real hasta el primer reset). El botón "Reset" de la pestaña (`resetearContadorTrafico` en `app/admin/actions.ts`) hace `update config_trafico set cuenta_desde = now() where id = 1` — nunca toca `visitas_web`. Añadida a `BaseDeDatos` en `lib/supabase/admin.ts` con el mismo envoltorio `Row: Pick<T, keyof T>` que el resto de tablas (obligatorio, ver comentario del propio fichero).
2. **Clasificación en memoria, no tres queries.** `SeccionTrafico.tsx` trae en una sola consulta (`obtenerTodasLasFilas`) todas las visitas con `ts >= cuenta_desde` — sin más filtro de rango — y las reparte en tres cubos (antes/durante/después) con una función de dominio puro nueva, `lib/trafico/fases.ts` (`clasificarVisitasPorFase`/`faseDeVisita`/`rangoDeFase`/`faseTraficoPorDefecto`), testeada por separado de `bucketing.ts`/`desglose.ts` (que ya existían y se reutilizan tal cual sobre las visitas de la fase activa). El intento relevante es el activo si existe; si no, el más reciente (`order by created_at desc limit 1`) — así "después" tiene sentido incluso sin ningún intento activo (reto ya cerrado con "Reiniciar").
3. **Fronteras semiabiertas, mismo criterio que `bucketing.ts`.** antes = `[cuenta_desde, started_at)`; durante = `[started_at, ended_at)` (o hasta ahora si sigue en marcha); después = `[ended_at, ahora]` (solo si el intento está cerrado). Sin ningún intento nunca, todo cae en "antes".
4. **Pestañas por fase vía query string** (`?fase=`), mismo patrón que `?gran=` (`lib/admin/navegacion.ts`, `esFaseTraficoValida`). Solo se muestran las fases con sentido para el intento actual (si nunca hubo intento, ni siquiera aparece el selector — una única vista "antes"). Fase por defecto sin `?fase=`: "durante" si el reto ha empezado alguna vez (en marcha o ya cerrado), "antes" si no.
5. **Compatibilidad con la migración sin aplicar**, mismo criterio que 0003/0004 (ver DEBT.md): si `config_trafico` no existe todavía, `obtenerCuentaDesde()` trata el error de Supabase como "sin cutoff" (fecha muy antigua) sin loguear nada — es un estado esperado, no un error real. El botón "Reset" sí falla de forma visible en ese caso (documentado en DEBT.md).

**Deuda conocida de antemano:** igual que `0003_modo_intento.sql` (ver `DEBT.md`), la migración `0004_visitas_web.sql` no se aplica sola — Santi debe pegarla en el SQL Editor de Supabase antes de que la pestaña tenga datos reales. El Implementador debe dejar el mismo tipo de salvaguarda que ya existe en `/api/track` ante la posibilidad de que la tabla no exista todavía en producción en el momento del deploy (no debe romper la carga de `/` ni del admin).

### Nota de cierre (2026-08-12) — bug real en producción: la pestaña dejaba de cargar

Con la tarea ya fusionada, Santi reportó que la pestaña "Tráfico" había dejado de cargar en producción. Causa raíz: el punto 5 de esta decisión ("sin cutoff" cuando `config_trafico`/migración `0005` no está aplicada) usaba una fecha fija muy antigua (`new Date(0)`) como fallback — con tráfico real acumulado desde que DT-022 se desplegó, eso significa traer el histórico **completo** de `visitas_web` sin ningún límite temporal, en hasta 50 páginas **secuenciales** de 1.000 filas cada una (`obtenerTodasLasFilas`, `lib/supabase/paginacion.ts`) — de sobra para agotar el timeout de la función serverless antes de terminar de responder. Es exactamente el vector de coste que Seguridad ya había señalado como observación no bloqueante en su revisión de esta tarea (no es una vulnerabilidad OWASP, pero sí un problema real de disponibilidad).

**Fix:** `obtenerCuentaDesde()` deja de caer a "desde siempre" cuando `config_trafico` no está disponible. En su lugar, mismo criterio en cascada:
1. `config_trafico.cuenta_desde` si la migración ya está aplicada (comportamiento normal).
2. `started_at` del intento relevante si existe — mismo límite que ya tenía DT-022 antes de esta tarea, ya probado en producción sin este problema.
3. Solo si tampoco hay ningún intento (nunca se ha pulsado "Iniciar"), un tope fijo de `LIMITE_SIN_CONFIG_DIAS` días (3) hacia atrás desde `ahora` — nunca sin límite.

Aplicar `supabase/migrations/0005_config_trafico.sql` contra producción sigue siendo la solución de fondo (cierra la deuda ya registrada); este fix es la salvaguarda para que la pestaña nunca vuelva a quedar inutilizable mientras esa migración no esté aplicada.

---

## DT-024 — Modal "Finalizar" con preview real y foto de llegada opcional

**Fecha:** 2026-08-12 · **Tarea:** Sustituir el `window.confirm()` + `<textarea>` plano de "Finalizar" por un modal con preview real del mensaje de llegada y una foto opcional · **Decisión de arquitectura**

**Contexto.** `FinalizarYReiniciar` (`components/admin/ActividadAcciones.tsx`) usaba `window.confirm()` + un `<textarea>` para el mensaje de llegada, sin ninguna vista previa de cómo se vería en la web pública, y sin posibilidad de adjuntar una foto — a diferencia del feed "minuto a minuto" (DT-013/DT-017), que sí soporta foto opcional con compresión en el navegador.

**Decisión.**

1. **Foto de llegada — mismo bucket de Storage que el feed, prefijo distinto.** Columna nueva `intentos.foto_llegada_url text` (nullable, migración `0006_foto_llegada.sql`, todavía sin aplicar contra producción — mismo patrón de deuda que 0003/0004). Se sube al bucket público `minuto-a-minuto` ya existente (no se crea uno nuevo — exigiría configuración manual en el dashboard de Supabase) con nombre `llegada-${Date.now()}-${crypto.randomUUID()}.${ext}`, para no colisionar con las fotos del feed. `lib/supabase/storage.ts` extrae la lógica común de `subirFotoMinutoAMinuto` a un helper interno (`subirFotoAlBucket`) del que cuelgan ambas funciones públicas.
2. **`finalizarReto` pasa a recibir `FormData` y devolver `ResultadoPublicacion`** (antes: `mensaje: string`, lanzaba en cada fallo). El cambio de contrato no estaba en el plan original ("mensaje: string" bastaba antes de que la acción pudiera fallar subiendo una foto), pero es necesario por el mismo motivo que ya forzó ese patrón en `crearMinutoAMinuto` (DT-017): Next redacta en producción el mensaje de cualquier error lanzado en el servidor, y la subida de la foto puede fallar de forma esperada (formato, tamaño) — un `throw` no dejaría ver el motivo real en el modal. Distingue tres casos con el `FormData`: sin `foto` ni `quitarFoto` → no se toca `foto_llegada_url` (Retomar → Finalizar de nuevo sin adjuntar nada no borra una foto ya subida); `foto` presente → sube y reemplaza (el objeto anterior en Storage queda huérfano, mismo criterio aceptado que `eliminarMinutoAMinuto`, DT-013); `quitarFoto=true` → pone la columna a `null`.
3. **Preview real compartiendo componentes con la web pública**, no una aproximación en texto plano: se extrajo el recuadro kicker/título/mensaje de `ModoLlegada.tsx` a `components/publico/RecuadroLlegada.tsx`, y la tarjeta de foto a `components/publico/FotoLlegada.tsx` — ambos sin lógica propia, solo marcado y estilos, usados tanto por `ModoLlegada.tsx` (producción) como por el nuevo `components/admin/ModalFinalizar.tsx` (preview mientras se escribe). El kicker/título llegan como props ya resueltos desde `SeccionActividad.tsx` (que ahora también llama a `obtenerTextos()`, antes solo lo hacía la web pública).
4. **`ModalFinalizar.tsx` sigue el patrón de `ComposerMinutoAMinuto.tsx`** (DT-017): `onSubmit` + `preventDefault` (conserva el `<input type="file">` si falla), `prepararFotoParaSubida` antes de enviar, `ejecutarConReintentos` alrededor de `finalizarReto` (4G irregular durante el reto, mismo riesgo que "Publicar").
5. **Consultas de `foto_llegada_url` separadas de las consultas existentes de `modo`/`destino_lat`/`destino_lon`** (`app/page.tsx`, `obtenerFotoLlegadaUrl`; `components/admin/SeccionActividad.tsx`, `obtenerIntentoActividad`) en vez de añadir la columna al mismo `select`. Motivo: esas consultas ya tienen su propio fallback de compatibilidad para la migración 0003 (sin confirmar aplicada, ver `DEBT.md`); sumar una tercera columna nueva (0006, tampoco aplicada) al mismo `select` acoplaría dos migraciones independientes — si solo faltara `foto_llegada_url`, el fallback existente "olvidaría" también `modo`/`destino_lat`/`destino_lon` aunque esos sí existieran ya. Con la consulta separada, si la columna no existe todavía la pantalla se sirve igual, simplemente sin foto.

**Nota de cierre:** durante la implementación, ejecutar la quality gate de tests completa (`pnpm test`) reveló que el árbol de importación de `app/admin/page.test.ts` (que hace `await import("@/app/admin/page")` dentro de cada test, ver `DEBT.md`) creció lo bastante con los componentes nuevos (`ModalFinalizar` + `lib/envio`/`lib/imagen`) para que el timeout de 5 s del test dejara de bastar de forma consistente, no solo en frío. Se movió el `import()` a un `beforeAll` con timeout propio (30 s) — el mismo test ya no repite un `import()` que Node cachea igualmente tras la primera llamada, así que mover el coste fuera del timer por test no cambia lo que se prueba, cierra el hueco documentado en `DEBT.md` para este fichero.

### Nota de cierre (2026-08-12) — fix de seguridad post-revisión

Seguridad encontró un bloqueante en la revisión de esta tarea: `finalizarReto` solo limitaba la longitud del mensaje de llegada en el cliente (`maxLength={1000}`, `ModalFinalizar.tsx`), trivialmente evitable enviando un `FormData` construido a mano contra la Server Action ya autenticada — inconsistente con `crearMinutoAMinuto`/`editarMinutoAMinuto`, que sí revalidan en servidor. Corregido: mismo tope (1000) añadido en servidor, mismo patrón y mismo mensaje de error que esas dos funciones. Sin cambios de contrato ni de comportamiento para el caso normal (un mensaje dentro del límite).

---

## DT-025 — Arquitectura multi-tenant: tabla `retos` con FK directo en cada tabla top-level

**Fecha:** 2026-09-28 · **Tarea:** FP0 — Schema plataforma multi-tenant · **Decisión de arquitectura + producto**

### Contexto

El proyecto pasa de ser una app de un único reto fijo (Camino Portugués de Santi) a una plataforma que puede alojar múltiples retos. Objetivo: que un único proyecto Next.js + Supabase sirva distintos retos, cada uno con sus propios datos (posiciones, comentarios, intenciones, minuto a minuto, textos, visitas web, tráfico), sin que los datos de un reto sean accesibles desde otro.

### Decisión — tabla `retos`

```sql
create table retos (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  nombre      text not null,
  descripcion text,
  ruta_tipo   text not null check (ruta_tipo in ('predefinida', 'libre')),
  ruta_id     text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (ruta_tipo = 'libre' or ruta_id is not null)
);
```

`ruta_id` mapea a una carpeta en `lib/rutas/` del repo (ej. `'portuguesa-110'`). No es FK a ninguna tabla de BD.

### Decisión — scoping multi-tenant: FK directo (Opción A)

Las tablas top-level llevan `reto_id BIGINT NOT NULL REFERENCES retos(id)`. Las tablas ya scoped a través de `intento_id` no cambian.

| Tabla | Cambio |
|---|---|
| `comentarios` | + `reto_id` + `parent_id` (nullable, para hilos — FP3) |
| `intenciones` | + `reto_id` |
| `textos` | + `reto_id` (unique compuesto `(reto_id, clave)`) |
| `visitas_web` | + `reto_id` |
| `intentos` | + `reto_id` |
| `config_trafico` | + `reto_id` (pasa de fila singleton a una fila por reto) |
| `posiciones` | sin cambio — ya scoped vía `intento_id` |
| `minuto_a_minuto` | sin cambio — ya scoped vía `intento_id` |

**Alternativas valoradas y descartadas:**
- *Opción B — schema PostgreSQL por reto*: incompatible con el cliente `supabase-js` sin workarounds costosos. Descartada.
- *Opción C — discriminador en texto sin FK*: sin integridad referencial. Descartada.

### Decisión — organización de assets de rutas

```
lib/rutas/portuguesa-110/traza.geojson       (antes: lib/traza/traza.geojson)
lib/rutas/portuguesa-110/traza-mapa.geojson  (antes: lib/traza/traza-mapa.geojson)
```

`cargar-traza.ts` y `cargar-traza-mapa.ts` reciben `ruta_id: string` como parámetro. Añadir una ruta nueva = añadir carpeta con GeoJSON.

### Decisión de producto — rutas predefinidas v1

- Solo existe `portuguesa-110` en v1.
- Modo libre disponible (sin traza de cálculo).
- Sin subida de GeoJSON desde la UI en v1. Añadir ruta nueva = añadir carpeta + fila en BD.

### Decisión de producto — superadmin

- Panel propio en `/superadmin`, contraseña via env var `SUPERADMIN_PASSWORD`.
- Sin auto-registro. Solo Santi crea y gestiona retos.

### Fases del plan de plataforma

| Fase | Alcance |
|---|---|
| **FP0** | Schema (migración), tipos TS, reorganización de assets de rutas, quality gates en verde. Sin UI, sin cambio de endpoints. |
| **FP1** | Routing multi-tenant (`/[slug]/`), todos los endpoints parametrizados por `reto_id`, web pública y admin funcionando. |
| **FP2** | Panel superadmin (`/superadmin`): CRUD de retos. |
| **FP3** | Features nuevas: hilos de respuesta en comentarios, MAM colapsable, admin más configurable. |

---

## DT-026 — FP1: Routing multi-reto con slug nesting completo

**Fecha:** 2026-09-29 · **Tarea:** FP1 — Routing multi-tenant

### Decisión

Web pública y panel admin se mueven bajo `app/[slug]/`. Los cinco endpoints de API que consumen `reto_id` (comentarios, intenciones, progreso, fase, minuto-a-minuto) se mueven a `app/[slug]/api/`. Solo quedan fuera del slug:
- `app/api/track/route.ts` — URL configurada externamente en OwnTracks; no puede cambiar sin reconfigurar el tracker.
- `app/api/admin/login/route.ts` — autenticación global sin contexto de reto.

El `reto_id` se resuelve con un helper `obtenerRetoPorSlug(slug: string): Promise<Reto>` en `lib/supabase/retos.ts`, envuelto en `React.cache()` para deduplicar dentro del mismo render tree (una sola query a `retos WHERE slug = $slug` por request). `/api/track` resuelve el `reto_id` directamente desde el intento activo (`intentos.reto_id WHERE cerrado = false`), sin necesitar el slug en la URL.

La raíz `/` en `app/page.tsx` hace `redirect('/portuguesa-110')` estático para FP1 (único reto en producción). Se sustituirá en FP2 por lógica dinámica cuando existan múltiples retos.

### Alternativas valoradas

**Opción B — slug como query param (descartada).** APIs se quedan en `app/api/`, reciben `?slug=portuguesa-110` o el slug en el body. Evita mover archivos de API pero es semánticamente pobre: el slug en query param mezcla contexto de enrutamiento con parámetros de la petición, no describe un recurso REST. Los client components necesitan el mismo cambio que en Opción A (pasar el slug), sin ganancia.

**Opción C — resolver desde reto activo (descartada).** APIs resuelven `reto_id` con `SELECT id FROM retos WHERE activo = true LIMIT 1`, sin slug en la URL. Mínimo cambio pero no cumple el requisito explícito del task: "obtenerlo dinámicamente del slug de la URL". Deuda inmediata en FP2.

### Estructura de archivos resultante

**Creados:**
- `lib/supabase/retos.ts` — `obtenerRetoPorSlug` + `React.cache`, con fallback ante migración sin aplicar
- `app/[slug]/layout.tsx` — llama `obtenerRetoPorSlug`, invoca `notFound()` si slug desconocido
- `app/[slug]/page.tsx` — movido de `app/page.tsx`
- `app/[slug]/admin/page.tsx` — movido de `app/admin/page.tsx`
- `app/[slug]/admin/actions.ts` — movido; cada action recibe `slug: string` como primer param; `revalidatePath` usa `/${slug}/admin`
- `app/[slug]/api/{comentarios,intenciones,progreso,fase,minuto-a-minuto}/route.ts`

**Modificados:**
- `app/page.tsx` — solo `redirect('/portuguesa-110')`
- `proxy.ts` — matcher estándar de exclusión, admin protegido en `/:slug/admin/:path*`, visitas capturadas en `/:slug`, login redirect con `?returnTo=/:slug/admin/`
- `app/admin/login/page.tsx` — lee `returnTo` query param y redirige a él tras login exitoso
- `app/api/track/route.ts` — `reto_id` resuelto desde `intentos.reto_id WHERE cerrado = false`
- Los 7 client components en `components/publico/` que hacen fetch a `/api/*`

**Eliminados:** versiones viejas de las APIs en `app/api/` y `app/admin/page.tsx` + `actions.ts`

### Deuda generada

Las caches en memoria (`lib/progreso-cache.ts`, `lib/historico-cache.ts`) no tienen clave por reto. Funciona para FP1 (un reto activo a la vez). En FP2, cuando haya múltiples retos activos simultáneos, necesitan keying por `reto_id`. Registrar en DEBT.md al cerrar FP1.

---

## DT-027 — FP2: Superadmin, CRUD de retos y home dinámica

**Fecha:** 2026-09-29 · **Tarea:** FP2 — Superadmin y gestión de retos

### Decisión

Se implementa un panel `/superadmin` con autenticación propia paralela al admin normal, operaciones CRUD sobre la tabla `retos`, y `app/page.tsx` como listado dinámico de retos activos.

**Auth del superadmin (Opción A — módulo paralelo, secreto compartido):**
Se crea `lib/auth/superadmin-session.ts` que espeja `lib/auth/admin-session.ts` con cookie `superadmin_session` y contraseña leída desde `SUPERADMIN_PASSWORD`. La firma HMAC reutiliza `ADMIN_SESSION_SECRET` (aceptable: admin y superadmin son el mismo sujeto, Santi; no existe un adversario con el secreto de firma que no tenga también la contraseña). La autenticación sigue el mismo patrón que DT-010: proxy como primera línea + verificación independiente en cada Server Action.
> **Superado por DT-029:** desde FP2.6 cada reto tiene su propio admin, que puede ser otra persona. El secreto se sigue compartiendo, pero cada cookie firma con una etiqueta de propósito distinta para que una no valga como la otra.

`proxy.ts` añade una rama para `/superadmin` y `/superadmin/*` con `proxySuperAdmin()`, que verifica `superadmin_session`, redirige a `/superadmin/login` si inválida, y renueva el TTL rolling si válida. Patrón idéntico al de `proxyAdmin()`.

**crearReto + primer intento:** la lógica se inlinea dentro de `crearReto` en `app/superadmin/actions.ts`. No se extrae a `lib/` porque el admin's `crearPrimerIntento` tiene pre-condiciones distintas (verificar que no existe intento activo, resolver reto por slug) que no aplican cuando el reto acaba de crearse.

**`app/page.tsx`:** server component que llama a `listarRetosActivos()` (filtra `activo = true`). Si no hay retos activos muestra mensaje. Enlaza a `/:slug/`. No hace redirect automático aunque haya un solo reto: es un selector público.

**`/superadmin` muestra todos los retos** (activos e inactivos) con acciones editar/eliminar. **`/`** muestra solo retos `activo = true`.

### Alternativas valoradas

**Opción B (auth) — layout-only, proxy solo bypasea tracking.** Descartada por inconsistencia con el patrón DT-010 ya establecido (pierde renovación TTL rolling).

**Opción C (auth) — reutilizar la sesión de admin existente.** Descartada: el requisito pide auth separada con `SUPERADMIN_PASSWORD` propia.

**Extracción de crearPrimerIntento a lib/.** Descartada: las pre-condiciones son distintas en cada contexto; extraer la lógica compartida (un solo INSERT) crea una abstracción que oculta diferencias semánticas importantes.

### Estructura de archivos resultante

**Nuevos:** `lib/auth/superadmin-session.ts`, `app/api/superadmin/login/route.ts`, `app/superadmin/login/page.tsx`, `app/superadmin/(panel)/layout.tsx`, `app/superadmin/(panel)/page.tsx`, `app/superadmin/(panel)/actions.ts`, `app/superadmin/(panel)/BotonEliminarReto.tsx`

**Modificados:** `lib/supabase/retos.ts` (añade `listarRetosActivos` y `listarTodosLosRetos`), `proxy.ts` (rama `/superadmin/*`), `app/page.tsx` (listado dinámico)

**Nueva env var de producción:** `SUPERADMIN_PASSWORD` (sin prefijo `NEXT_PUBLIC_`). `ADMIN_SESSION_SECRET` ya existe y se reutiliza para firmar la sesión superadmin.

### Desviaciones de implementación

**Route group `(panel)`:** El layout se implementó como `app/superadmin/(panel)/layout.tsx` en lugar de `app/superadmin/layout.tsx`. Un layout directo en `app/superadmin/` aplica también a `app/superadmin/login/`, provocando un redirect circular (el layout verifica la sesión y redirige al login, que está dentro del mismo layout). El route group `(panel)` excluye `/superadmin/login` de la protección sin alterar la URL pública (`/superadmin` sigue funcionando igual).

**`listarTodosLosRetos` usa cliente admin:** La especificación decía "cliente público". Se cambió a cliente admin porque la política RLS de la tabla `retos` filtra retos inactivos para el rol `anon` — un cliente público solo vería los activos, haciendo imposible que el superadmin gestione retos inactivos. El cliente admin bypasea RLS y devuelve todos los retos.

### Nota posterior (2026-09-30) — acciones con resultado en vez de `throw`

En producción Next redacta el mensaje de los errores lanzados desde una Server Action. Por eso `crearReto`, `editarReto` y `eliminarReto` devuelven ahora un resultado (`app/superadmin/(panel)/resultado-accion.ts`: `ResultadoAccionSuperadmin`, y `ResultadoCrearReto` con `slug` para enlazar al reto nuevo). No se reutiliza `ResultadoPublicacion` porque aquí el éxito también lleva mensaje.
- Con la sesión caducada no se ejecuta nada y se devuelve un mensaje pidiendo volver a entrar.
- Firmas: `crearReto(estadoPrevio, formData)`, `editarReto(id, estadoPrevio, formData)` y `eliminarReto(id)`. En `page.tsx`, `editarReto` y `eliminarReto` se enlazan con `.bind(null, reto.id)`.
- Los formularios son componentes cliente con `useActionState`. `FormularioCrearReto` y `FormularioEditarReto` envían con `onSubmit` + `startTransition`, porque React resetea el formulario tras un envío por `action` y un error haría perder lo escrito; crear solo resetea tras un éxito. `BotonEliminarReto` usa `action` con `confirm()` en `onSubmit`.
- Editar y eliminar terminan con `redirect()` al panel limpio y el aviso viaja en la query (`?guardado=<id>` / `?eliminado=<slug>`). Al eliminar, la tarjeta desaparece en la misma respuesta y un mensaje guardado en su estado no llegaría a verse. `leerAvisoPanel` solo acepta ids enteros y slugs válidos, así que nunca muestra texto arbitrario de la URL.
- Enlaces "Ver web" / "Panel admin" en cada tarjeta y tras crear (`EnlacesReto`), "Ver portada" en la cabecera y "Ver web" en la cabecera del panel admin del reto, todos en una pestaña nueva.

---

## DT-028 — FP2.5: Aislamiento de datos por reto

**Fecha:** 2026-09-29 · **Tarea:** FP2.5 — Aislamiento de datos por reto

### Contexto

Tras FP0–FP2 todas las tablas top-level llevan `reto_id` (y `posiciones`/`minuto_a_minuto` cuelgan de `intentos`), pero muchas consultas no filtraban por reto: el intento activo se buscaba con `.eq("cerrado", false).maybeSingle()` a secas, `textos`/`comentarios`/`intenciones`/`visitas_web` del panel se leían sin filtro, los borrados/ediciones iban solo por `id`, las cachés de progreso e histórico tenían un único hueco global, `config_trafico` se leía/escribía con `id = 1` y había fallbacks hardcodeados a `"portuguesa-110"`. En BD, `intentos_activo_unico ON intentos ((true)) WHERE NOT cerrado` impedía más de un intento abierto en todo el sistema (y por tanto crear un segundo reto, que siembra su intento inicial).

### Decisión

1. **Migración `0009_intento_abierto_por_reto.sql`:** `drop index intentos_activo_unico` y `create unique index intentos_abierto_por_reto on intentos (reto_id) where not cerrado`. Sin índice global sobre "durante": dos retos pueden estar en marcha a la vez.
2. **Helper `lib/supabase/intentos.ts` → `soloIntentoActivoDelReto(consulta, retoId)`:** aplica juntos `.eq("reto_id", retoId).eq("cerrado", false)` sobre un builder ya seleccionado. Toda búsqueda del intento activo pasa por él.
3. **Reto resuelto una vez y propagado:** `app/[slug]/admin/page.tsx` pasa `reto` a cada `Seccion*`; las APIs `app/[slug]/api/{fase,progreso,minuto-a-minuto}` resuelven el reto con `obtenerRetoPorSlug` (404 si no existe); `app/[slug]/page.tsx` filtra intento/textos/cachés por `reto.id`. Firmas: `obtenerFaseActual(retoId)`, `calcularProgresoActual(reto)`, `obtenerDatosMapaAdmin(reto)`, `obtenerTextos(retoId)`, `obtenerIntentoActivo(retoId)`, `obtenerIntentoActividad(retoId)`.
4. **Server actions:** reto al inicio de cada acción; filas con `reto_id` propio se filtran por `id` **y** `reto_id`; `posiciones`/`minuto_a_minuto` por el intento activo del reto; `config_trafico` por `upsert({reto_id, cuenta_desde}, {onConflict: "reto_id"})` (el unique ya existía en 0007).
5. **Cachés en memoria por reto:** `lib/progreso-cache.ts` y `lib/historico-cache.ts` pasan a `Map<retoId, Entrada>`; `limpiar(retoId?)` sin argumento vacía todo.
6. **Retos sin ruta (`ruta_id` null):** sin traza que pintar ni sobre la que proyectar; el progreso se mide como modo libre aunque el intento esté en modo "guiado" (el default de BD), y el progreso vacío es el libre.
7. **`/api/track?reto=<slug>` (opción B elegida por el usuario):** el tracker indica su reto en la URL; el `TRACK_TOKEN` sigue siendo global. Slug validado con Zod (`^[a-z0-9-]+$`, máx. 60) y resuelto con `obtenerRetoPorSlug`; sin reto, mal formado o inexistente → la misma respuesta vacía 200 (OwnTracks no reintenta). El filtro geográfico usa la traza de `reto.ruta_id` y se omite si es null.
8. **Panel superadmin:** cada tarjeta de reto muestra la URL del GPS para OwnTracks (`<origen>/api/track?reto=<slug>`, origen desde `x-forwarded-host`/`host` + `x-forwarded-proto`; relativa si no hay host válido). El token no se muestra.

### Alternativas valoradas

**Track — opción A: un token por reto** (resolver el reto a partir del token). Descartada por el usuario: exige gestionar N secretos y un cambio de esquema; con un solo operador el token global basta.
**Track — opción C: inferir el reto del único intento en "durante".** Descartada: ambigua con dos retos en marcha, que es justo lo que habilita la migración.
**Helper genérico sobre las columnas** (`obtenerIntentoActivoDelReto(supabase, retoId, columnas)`, lo que proponía el plan): descartado al implementar, ver nota de cierre.

### Notas de cierre (desviaciones de implementación)

- **Helper con forma distinta a la del plan.** El plan proponía `obtenerIntentoActivoDelReto(supabase, retoId, columnas)`. Con `columnas` como genérico `extends string`, TypeScript tiene que instanciar en diferido el parser de columnas de PostgREST y `tsc --noEmit` agota la memoria del proceso (reproducido: OOM a los ~50 s; sin el helper, 10 s). Se implementó `soloIntentoActivoDelReto(consulta, retoId)`, que recibe el builder ya con `select(...)`: mismo objetivo (un único punto que añade los dos filtros), tipado estricto del resultado según las columnas pedidas y cada caller conserva su fallback de compatibilidad con 0003.
- **Reto sin ruta con intento "guiado"** (punto 6): el plan decía "si null → progreso libre vacío" para el progreso vacío; se extendió el mismo criterio al cálculo con histórico (se mide como libre) y a la vista pública/mapa admin, porque no existe traza con la que calcular un progreso guiado.
- **`app/[slug]/page.tsx` y `app/[slug]/admin/page.tsx`** responden `notFound()` si el reto no se resuelve (antes la pública degradaba a `"portuguesa-110"`): el layout ya da 404 en ese caso, y sin reto no hay nada que filtrar.
- **Invalidación del histórico:** `descartarPosicion` y `reiniciarReto` limpian también la caché de histórico del reto (antes solo la de progreso), porque con la caché por reto un reinicio dejaba hasta 20 s el histórico del intento anterior.

### Nota posterior (2026-10-01) — token por reto (DT-035)

El punto 7 queda modificado por DT-035: el token ya no es global sino de cada reto (`retos_gps`), y sin `reto`, con un slug mal formado o con un reto inexistente `/api/track` responde `401 {"error":"unauthorized"}` (antes `200 []`), igual que con un token incorrecto.

---

## DT-029 — FP2.6: Contraseña de admin propia por reto

**Fecha:** 2026-09-29 · **Tarea:** FP2.6 — Contraseña de admin por reto

### Contexto

Hasta FP2.5 todos los paneles `/<slug>/admin` compartían la env var `ADMIN_PASSWORD` y la cookie `admin_session` (HMAC con `ADMIN_SESSION_SECRET`, payload `{exp}`) no estaba ligada a ningún reto: quien entraba en un panel entraba en todos. Con varios retos de organizadores distintos, eso rompe el aislamiento conseguido en DT-028.

### Decisión

1. **Tabla `retos_admin`** (migración `0010_retos_admin.sql`): `reto_id bigint PK → retos(id) on delete cascade`, `password_hash text check (like 'scrypt$%')`, `updated_at`. RLS activado sin políticas y `revoke all` a `anon`/`authenticated`: solo el service role la toca. Tabla aparte porque `retos` es legible por `anon`.
2. **Hash scrypt de `node:crypto`** (`lib/auth/password.ts`), formato `scrypt$N$r$p$salt$hash` (N=16384, r=8, p=1, salt 16 B, clave 64 B). Verificación con `timingSafeEqual`, nunca lanza; parámetros fuera de rango o memoria > 64 MB → `false`. `HASH_SENTINELA` para igualar tiempos.
3. **Cookie ligada al reto — invalidación opción B:** payload `{r: retoId, s: slug, v: huella, exp}`, con `huella = SHA-256(password_hash)` base64url truncado a 16. Cada hash lleva salt nuevo ⇒ cambiar la contraseña cambia la huella e invalida las sesiones abiertas.
4. **Dos niveles de verificación:** `proxy.ts` (`verificarSesionEnProxy`) comprueba firma, caducidad y que `s` es el slug de la URL, sin BD, y renueva la cookie conservando r/s/v. La página del panel y cada Server Action usan `resolverRetoConSesion(slug)` (`lib/auth/sesion-admin-servidor.ts`), que además compara `r` con el id del reto y `v` con la huella del hash actual.
5. **Login** (`/api/admin/login`): rate limit por IP primero; zod `{slug, password}`; `verificarPassword` se ejecuta siempre (contra `HASH_SENTINELA` si no hay reto o hash); reto inexistente, sin contraseña o contraseña errónea → el mismo `401 {error:"credenciales incorrectas"}`. `ADMIN_PASSWORD` deja de leerse (obsoleta).
6. **Superadmin:** contraseña obligatoria al crear (≥ 8, ≤ 200), opcional al editar (vacío = no cambiar); estado "configurada / sin configurar" por tarjeta. Nunca se guarda ni registra texto plano.
7. **Login UI:** el reto sale de `returnTo`; sin `returnTo` válido el formulario queda desactivado (se elimina el reto por defecto fijo).

### Alternativas valoradas

**Invalidación opción A — sin huella (solo r/s/exp).** Descartada: cambiar la contraseña no expulsaría a quien ya tuviera sesión hasta 7 días.
**Invalidación opción C — el proxy consulta BD en cada navegación.** Descartada: una consulta por navegación del panel en el proxy; la verificación completa ya ocurre en la página y en cada Server Action, que es donde se leen o escriben datos.
**Columna `admin_password_hash` en `retos`.** Descartada: `retos` tiene política SELECT para `anon`; habría que excluir la columna en cada consulta pública.
**bcrypt/argon2 como dependencia.** Descartado: scrypt nativo de Node cubre el caso sin dependencia nueva.

### Notas de cierre (implementación)

- **Tiempo de login con reto inexistente:** `verificarPassword` se ejecuta siempre, pero con un reto existente hay una consulta extra a `retos_admin`. La diferencia (un round-trip) solo revela si el slug existe, dato ya público (la web `/<slug>` es pública); no revela si el reto tiene contraseña.
- **Mensaje ante 429 en el login:** además del mensaje de error pedido, la UI muestra "Demasiados intentos…" si la API responde 429, para no hacer creer al usuario que la contraseña es incorrecta.
- **Server Actions que devuelven `ResultadoPublicacion`** (`finalizarReto`, `crearMinutoAMinuto`) usan `resolverRetoConSesion` directamente y devuelven "sesión caducada" si es null (antes distinguían "reto no encontrado"; ahora ambos casos son sesión inválida).
- **`editarReto`** guarda la contraseña nueva tras actualizar el reto y revalidar; si falla ese guardado, lanza "No se pudo guardar la contraseña de admin del reto." con el resto de cambios ya aplicados.
  > **Actualizado (2026-09-30):** ya no lanza; devuelve `{ok:false}` con "Los cambios del reto se guardaron, pero no se pudo cambiar la contraseña". Ver nota de DT-027.
- **Despliegue:** hasta aplicar `0010` y fijar la contraseña de cada reto desde el superadmin, ningún panel admin es accesible (fallar cerrado). Las cookies antiguas `{exp}` dejan de ser válidas al desplegar.
- **Separación de firmas admin / superadmin (hallazgo de Seguridad):** ambas cookies se firmaban con `ADMIN_SESSION_SECRET` y la misma construcción `HMAC(payload)`, y `verificarSesionSuperadmin` solo exigía un `exp` numérico. Una cookie `admin_session` de cualquier reto (y desde FP2, la antigua `{exp}` del admin único) valía como `superadmin_session`. Corregido con una etiqueta de propósito en la firma (`HMAC(secreto, "admin.v2." + payload)` y `"superadmin.v2." + payload`) y validación zod `.strict()` del payload en ambas. Al desplegar se invalidan también las sesiones de superadmin.

---

## DT-030 — FP3a: Respuestas en hilo en los comentarios

**Fecha:** 2026-09-29 · **Tarea:** FP3a — Respuestas en hilo

### Contexto

`comentarios.parent_id` existía desde 0007 sin uso. Producto decidió (cerrado): un solo nivel (solo se responde a raíces públicas, visibles y del mismo reto); responden visitantes (nombre + texto, siempre público) y el caminante desde el admin, con insignia "Caminante" que solo el admin puede poner; ocultar una raíz oculta su hilo en la web y borrarla borra sus respuestas; hilos con más de 2 respuestas plegados; sin notificaciones. La anon key es pública (cualquiera puede llamar a PostgREST directamente), así que las reglas no pueden vivir solo en la API.

### Decisión

1. **Reglas en BD (migración `0011_hilos_comentarios.sql`):** columna `es_autor boolean not null default false`; FK `parent_id` recreada con `on delete cascade`; check `comentarios_respuesta_publica` (respuesta ⇒ pública); trigger `comentarios_validar_respuesta` (security definer, before insert / update of parent_id) que rechaza con `check_violation` un padre inexistente, de otro reto, que sea respuesta, privado u oculto; índices parciales de raíces y de respuestas.
2. **RLS:** SELECT de anon exige además, para una respuesta, `comentario_raiz_visible(parent_id)` — función security definer porque una política no puede consultar su propia tabla sin recursión. INSERT de anon exige `oculto = false and es_autor = false`. EXECUTE revocado a `public`, `anon` y `authenticated` en ambas funciones y concedido solo a `anon` en `comentario_raiz_visible`.
3. **Dominio puro `lib/comentarios/hilos.ts`:** `motivoRechazoPadre(padre, retoId)` (mismas reglas que el trigger, para responder con un error claro antes de escribir), `agruparHilos(raices, respuestas)` (muro) y `agruparHilosAdmin(filas, filtro)` (panel: un hilo aparece si su raíz o alguna respuesta cumple el filtro; la raíz que no lo cumple se pinta atenuada como contexto).
4. **API pública:** GET pagina solo raíces (`parent_id is null`, `created_at desc, id desc`, 20/pág) y pide las respuestas con una segunda consulta `.in("parent_id", ids de la página)`, `oculto = false`, orden ascendente; devuelve `RespuestaMuro` (`HiloPublico[]`). POST acepta `z.union` de dos esquemas `.strict()` (raíz `{nombre, texto, visibilidad}` / respuesta `{nombre, texto, parent_id}`): `es_autor`, o `visibilidad` en una respuesta, ⇒ 400. El padre se lee con el cliente anon filtrando por `id` y `reto_id`; cualquier rechazo ⇒ 422 con un mensaje único (no revela si existe un comentario privado). Mismo rate limit (10 POST/min/IP).
5. **Admin:** Server Action `responderComentario(slug, parentId, texto): ResultadoPublicacion` — sesión con `resolverRetoConSesion`, padre por `id` + `reto_id`, `motivoRechazoPadre`, nombre = texto editable `quien_camina_nombre` (fallback `reto.nombre`, recorte a 80), `es_autor: true`. "Responder" solo en raíces públicas no ocultas; el borrado de una raíz avisa de cuántas respuestas se borran.
6. **UI pública:** `HiloComentario` (plegado si > 2, toggle con `aria-expanded`), `RespuestaForm` (añade la respuesta al hilo en local al acertar), `InsigniaCaminante`. Claves de texto nuevas: `muro_boton_responder`, `muro_boton_ver_respuestas` (`{n}`), `muro_boton_ocultar_respuestas`, `muro_insignia_caminante`, `respuesta_form_placeholder_texto`, `respuesta_form_boton_enviar`. Textos del admin en código.

### Alternativas valoradas

**Reglas solo en la API.** Descartada: la anon key permite insertar/leer por PostgREST sin pasar por la API.
**Política RLS con subconsulta directa a `comentarios`.** Descartada: recursión infinita de políticas; de ahí la función security definer.
**Traer raíces y respuestas en una sola consulta paginada.** Descartada: la paginación por filas partiría hilos entre páginas; se pagina por raíces.
**Guardar el nombre del caminante como constante.** Descartada: cada reto tiene su caminante; se usa su texto editable.

### Notas de cierre (implementación)

- **EXECUTE de las funciones:** el plan revocaba solo a `public`; Supabase concede EXECUTE a `anon`/`authenticated` por default privileges del schema `public`, así que se revoca también explícitamente a esos roles.
- **Insert de la respuesta con `.select(...).single()`:** el POST devuelve la fila creada (id, created_at reales) para pintarla en local; funciona porque la nueva fila cumple la política SELECT (su raíz es visible). Un `check_violation` del trigger (padre ocultado entre la lectura y el insert) se traduce también a 422.
- **Panel sin filtro en BD:** `SeccionComentarios` trae todos los comentarios del reto y filtra al agrupar (necesario para mostrar la raíz como contexto).
- **`FiltroComentarios`** navegaba a `/admin?…` (ruta inexistente desde FP1); corregido a `/${slug}/admin?…`. El mismo fallo en pestañas (`TabsAdmin`), paginación (`EnlacePaginacion`, ambos con `usePathname`) y tráfico (`SeccionTrafico`) se corrigió en la misma tarea.
- **Cliente sin zod:** `RespuestaForm` tipa la respuesta de la API como el resto de componentes públicos, sin añadir zod al bundle del navegador.

### Nota posterior (2026-09-30) — sub-pestañas del admin y "Responder" bajo cada respuesta

- **Admin:** el filtro Todos/Públicos/Ocultos pasa a ser **Públicos / Privados / Ocultos** (`FILTROS_COMENTARIO` en `lib/admin/navegacion.ts`, default "publicos"; `filtroComentarioDesdeQuery` lleva las URLs antiguas con "todos" al default). En `lib/comentarios/hilos.ts`, `agruparHilosAdmin(filas, "publicos" | "ocultos")` excluye siempre los privados.
  - "publicos": raíces no ocultas con sus respuestas no ocultas. Un hilo con la raíz oculta ya no aparece aquí.
  - "ocultos": raíces ocultas con todo su hilo, más respuestas ocultas sueltas con su raíz como contexto.
  - `listarPrivadosAdmin` da los privados en una lista plana; `contarComentariosAdmin` da el número de cada pestaña.
  - Los privados solo tienen "Eliminar" (`AccionesComentario` con `ocultable={false}`) y nunca "Responder" (`puedeResponder`). Las actions de ocultar y mostrar no lo impiden (registrado en `DEBT.md`).
- **Web pública:** cada respuesta tiene su botón "Responder" y el formulario se abre al final del hilo con "Respondiendo a {nombre}" (clave `respuesta_form_respondiendo_a`, bloque de respuestas en `lib/textos/bloques.ts`). Sigue habiendo un solo nivel: toda respuesta se guarda con `parent_id` = raíz, y el destinatario es solo texto de interfaz, no se guarda. Con las respuestas desplegadas, el botón de la raíz no se muestra.

### Nota posterior (2026-09-30) — muro en vivo, privados y accesibilidad de la respuesta

- **Muro en vivo:** `MuroComentarios` vuelve a pedir la página 0 cada 60 s, solo con la pestaña visible (`visibilitychange`: para en oculto; al volver sondea en el acto y reanuda). La fusión es pura (`lib/comentarios/muro-en-vivo.ts`): unión por id de raíces (orden de la API, `created_at desc, id desc`, así las nuevas quedan arriba y no se pierden las páginas de "Cargar más") y de respuestas por hilo (cronológico, nunca se quita una ya presente). Si nada cambia devuelve el mismo estado y React no repinta. La paginación es una unión (`sin-cargar | mas | fin`) que solo fija la carga inicial; luego se conserva el offset (las repeticiones por desplazamiento se descartan al fusionar), salvo con todo cargado y una página 0 llena sin raíces conocidas, que reabre "Cargar más" para el hueco. La recarga tras publicar usa el mismo camino (ya no descarta las páginas extra).
- **Respuestas en el estado del muro:** `HiloComentario` ya no copia `hilo.respuestas` a un estado propio (el poll no le llegaría); la respuesta publicada sube al muro (`aplicarRespuestaPropia`, sin duplicar si el poll ya la trajo). Los hilos conservan su `key`, así que un formulario de respuesta abierto no se desmonta.
- **Sin poll** en la vista previa (`useVistaPrevia`) y, como con la sección apagada el muro no se monta, tampoco entonces. Si el poll recibe 403 (el admin apagó la sección con la página abierta) se para y se hace `router.refresh()` una vez (`useRefrescoSiSeccionApagada`, ver DT-032).
- **Deliberado:** una raíz que el admin oculta o borra no desaparece del muro abierto hasta recargar; el poll solo añade.
- **Ocultar/mostrar solo públicos:** `ocultarComentario`/`mostrarComentario` filtran también `visibilidad = 'publico'` en el propio `update` (con `.select("id")`); sin filas afectadas lanzan "No se puede ocultar/mostrar un mensaje privado." Cierra la salvedad de la nota anterior.
- **`RespuestaForm`:** el `<p>` "Respondiendo a …" tiene `id` (`useId`) y `aria-live="polite"`, y el `textarea` lo referencia con `aria-describedby`. Al cambiar de destinatario con el formulario abierto (prop `destinatarioId`, para distinguir nombres iguales), el foco va al nombre si está vacío o al texto si no.

---

## DT-031 — FP3b: "Minuto a minuto" plegable en la web pública

**Fecha:** 2026-09-30 · **Tarea:** FP3b — Minuto a minuto plegable

### Contexto

Producto decidió (cerrado): la sección "minuto a minuto" entera se puede plegar; abierta en "durante", plegada en "llegada"; la elección no se persiste; plegada, si llegan entradas por polling, la cabecera avisa ("1 nueva" / "{n} nuevas") y al desplegar vuelve a 0; el punto marcado en el mapa se mantiene al plegar. Al analizarlo apareció un bug previo: con el feed vacío el poll salía sin preguntar, así que en "durante" la primera entrada del reto no aparecía hasta recargar.

### Decisión

1. **Estado en `MinutoAMinuto.tsx`:** prop `plegadoInicial?: boolean` (default `false`; `ModoLlegada`/`ModoLlegadaLibre` la pasan a `true`); estados `plegado` y `ultimoVistoId`. `ultimoVistoId` se fija con la entrada más reciente al cargar la página 0, al plegar y al desplegar. El número de nuevas es derivado: `plegado ? contarNuevas(entradas, ultimoVistoId) : 0`.
2. **Dominio puro `lib/minuto-a-minuto/contar-nuevas.ts`:** cuenta `id > ultimoVistoId` (null ⇒ 0). Por id y no por longitud: las páginas antiguas de "Cargar más" no cuentan como nuevas.
3. **Accesibilidad y animación:** botón "Mostrar"/"Ocultar" con `aria-expanded` y `aria-controls` hacia una región siempre montada (`useId`); aviso en un `<span aria-live="polite">` siempre montado (vacío con 0); dentro de la región, `AnimatePresence` + `motion.div` altura 0 ↔ auto, con `MotionConfig reducedMotion="user"`.
4. **Polling sin cambios de cadencia:** mismo intervalo plegado o no. `seleccionada` vive en el componente, que no se desmonta al plegar, así que el punto del mapa se conserva.
5. **Fix del feed vacío (`lib/minuto-a-minuto/polling.ts`):** `construirUrlPolling(slug, masRecienteId)` usa `despuesDeId=0` si no hay entradas (el esquema de la API ya admite `min(0)` y los ids empiezan en 1), así que el poll devuelve las más recientes del intento activo. No hace falta tocar `route.ts`. `fusionarSinDuplicados` une listas descartando ids repetidos.
6. **Textos:** `minuto_a_minuto_boton_mostrar`, `minuto_a_minuto_boton_ocultar`, `minuto_a_minuto_aviso_nueva`, `minuto_a_minuto_aviso_nuevas` (`{n}` con `replaceAll`, como `muro_boton_ver_respuestas`).

### Alternativas valoradas

**Persistir la elección (localStorage).** Descartada por Producto: la fase decide el estado inicial.
**Desmontar la lista al plegar sin región estable.** Descartada: `aria-controls` debe apuntar a un elemento existente.
**Con feed vacío, pedir la página 0 (`offset=0`).** Posible, pero `despuesDeId=0` reutiliza el mismo camino del poll y no mezcla estado de paginación.

### Notas de cierre (implementación)

- **Referencia 0 con el feed vacío:** al plegar con la lista vacía, `ultimoVistoId` es 0 (no null) para que la primera entrada que llegue sí genere el aviso. null solo antes de la primera carga.
- **Fusión sin duplicados también en "Cargar más":** la paginación es por offset; si el poll ha añadido N entradas arriba, la página siguiente repite N filas ya pintadas (claves duplicadas en React). Se deduplica por id al añadir la página. También en el poll, por si se solapa con la carga inicial.
- **Fila extraída a `FilaEntrada`** (mismo fichero) para que el anidamiento de la región plegable no hiciera ilegible el JSX.

### Nota posterior (2026-09-30) — cabecera en acordeón

El botón "Mostrar"/"Ocultar" se sustituye por una cabecera de acordeón:
- Toda la fila es un `<button>` con `aria-expanded`/`aria-controls` y foco visible. Contiene el punto "en directo", el kicker, la insignia de nuevas (`aria-hidden`) y un chevron que rota 180° (motion, respeta `reducedMotion="user"`). El estado lo anuncia solo `aria-expanded`: no hay texto Mostrar/Ocultar.
- El aviso para lectores de pantalla sale de la cabecera: va en un `aria-live="polite"` aparte, prefijado con el kicker ("Minuto a minuto: 2 nuevas").
- Se eliminan las claves `minuto_a_minuto_boton_mostrar` y `minuto_a_minuto_boton_ocultar` (punto 6), porque ya no se usan. Si un reto las tenía personalizadas en `textos`, esas filas quedan sin efecto.

### Nota posterior (2026-09-30) — sección apagada en caliente

Si el poll del minuto a minuto recibe 403 (el admin apagó la sección con la web abierta), se para el intervalo y se hace `router.refresh()` una sola vez para que la página deje de pintar la sección (`useRefrescoSiSeccionApagada` + `esRespuestaDeSeccionApagada`, ver DT-032). El poll del minuto a minuto sigue sin pausarse con la pestaña oculta (el del muro sí, DT-030).

---

## DT-032 — FP3c: Configuración por reto desde el panel admin

**Fecha:** 2026-09-30 · **Tarea:** FP3c — Configuración por reto

### Contexto

Cada reto necesita decidir qué ve su público sin tocar código: encender/apagar las secciones de intenciones, comentarios (formulario + muro), minuto a minuto e Instagram (por defecto encendidas); permitir o no las respuestas de visitantes de FP3a (apagadas: sin botón "Responder", POST de respuesta rechazado, las existentes siguen visibles y el caminante sigue respondiendo desde el admin); y elegir la foto de "quién camina", hasta ahora la constante `FOTO_SANTI` de `ModoAntes.tsx`. La pestaña Textos, con ~70 claves en una lista plana, se agrupa por bloques.

### Decisión

1. **Columnas en `retos` (migración `0012_config_reto.sql`):** `seccion_intenciones`, `seccion_comentarios`, `seccion_minuto_a_minuto`, `seccion_instagram`, `respuestas_visitantes` (boolean not null default true) y `quien_camina_foto_url` (text, null = silueta). El reto `santi-ago` recibe `'/santi.jpg'` para conservar su foto.
2. **RLS de INSERT en `comentarios`:** la política `comentarios_insert_publico` añade `comentarios_insert_permitido(reto_id, parent_id is not null)`, función security definer (no depende de la política SELECT de `retos`, que solo ve activos) con EXECUTE revocado a `public`/`anon`/`authenticated` y concedido solo a `anon`. El GRANT por columnas de 0011 y el trigger de respuestas no cambian. `intenciones` no necesita RLS: anon no tiene ninguna política sobre ella y la API es la única vía.
3. **Dominio puro `lib/retos/config.ts`:** `configDelReto(reto)` (campo ausente ⇒ true, red por si el código se despliega antes que la migración), `fotoQuienCaminaDelReto` y `urlInstagramVisible(config, url)` (interruptor y URL no vacía).
4. **APIs públicas:** comentarios GET/POST ⇒ 403 `{error: "no disponible"}` con la sección apagada; POST con `parent_id` y respuestas apagadas ⇒ 403 antes de leer el padre; un 42501 de RLS en el insert ⇒ 403. Intenciones POST y minuto a minuto GET ⇒ 403 con su sección apagada.
5. **Web pública:** `app/[slug]/page.tsx` pasa `config` a todos los modos (y `fotoQuienCamina` a `ModoAntes`). Una sección apagada no se renderiza en ninguna fase ni modo; el minuto a minuto apagado no se monta (sin polling) y en "llegada" no se cargan sus entradas. `MuroComentarios`/`HiloComentario` reciben `permitirRespuestas`.
6. **Admin:** pestaña "Configuración" (`SeccionConfiguracion` server; `FormConfiguracion` con `role="switch"` y guardado conjunto; `FotoQuienCaminaForm` con `prepararFotoParaSubida` + `ejecutarConReintentos`). Server Actions `guardarConfiguracion` (zod `.strict()` de los cinco booleanos) y `guardarFotoQuienCamina` (`foto` o `quitarFoto=true`), ambas con `resolverRetoConSesion`, update por `id` del reto y revalidación de `/<slug>` y `/<slug>/admin`. Aviso en la pestaña Minuto a minuto si la sección está apagada.
7. **Storage:** `subirFotoQuienCamina(foto, retoId)` sube a `<retoId>/quien-camina-<ts>-<uuid>.<ext>` en el bucket de DT-024. `rutaObjetoDelReto(url, retoId)` (pura) solo reconoce objetos con esa forma exacta bajo la carpeta del reto; es la guarda que decide qué foto anterior se borra (`borrarObjeto`, no lanza).
8. **Textos por bloques (`lib/textos/bloques.ts`):** `BLOQUES_TEXTOS` `as const satisfies readonly BloqueTextos[]` con comprobación de exhaustividad en tipos (`DebeSerNever<Exclude<ClaveTexto, …>>`) y test de "exactamente un bloque". `SeccionTextos` pinta índice de anclas + un `<details>` por bloque (sin JS de cliente) y marca "sección apagada".

### Alternativas valoradas

**Tabla `config_reto` aparte.** Descartada: relación 1:1 con `retos`, que ya se lee en cada request (`obtenerRetoPorSlug`, `select *`); columnas evitan otra consulta.
**Guardar la configuración en `textos`.** Descartada: son strings sin tipo ni default de BD, y la RLS no podría usarlos con limpieza.
**Solo comprobar en la API (sin RLS).** Descartada para comentarios: la anon key permite insertar por PostgREST sin pasar por la API.
**Bucket nuevo para la foto.** Descartada: exige configuración manual en Supabase; mismo bucket con carpeta por reto (patrón DT-024).

### Notas de cierre (implementación)

- **`guardarConfiguracion(slug, config: unknown)`:** el parámetro es `unknown` a propósito — una Server Action es un endpoint público y el esquema zod (`satisfies z.ZodType<ConfigReto>`) es quien da el tipo. Permite además testear valores inválidos sin `as`.
- **Rollback de la foto:** si falla el update de `retos` tras subir, se borra la foto recién subida; la anterior no se toca.
- **Bloque "Instagram" propio:** la URL de Instagram vive en un bloque de una sola clave para poder marcarlo como "sección apagada"; en total 11 bloques.
- **Interruptor "Respuestas de visitantes"** se atenúa con un aviso cuando los comentarios están apagados (no tiene efecto), pero conserva su valor.
- **Sin cambios en la RLS de SELECT:** con una sección apagada, comentarios públicos y entradas del minuto a minuto siguen siendo legibles por PostgREST directo (registrado en `DEBT.md`); la decisión aprobada es ocultarlos en la web y en la API.

### Nota posterior (2026-09-30) — la web abierta reacciona al apagado

El 403 de las APIs de sección es ahora también una señal para la web ya abierta: `esRespuestaDeSeccionApagada(estadoHttp)` (`lib/retos/config.ts`) y el hook cliente `components/publico/useRefrescoSiSeccionApagada.ts`, que devuelve si hay que parar y hace `router.refresh()` la primera vez. Lo usan los polls del minuto a minuto y del muro. `/[slug]` es dinámica y `guardarConfiguracion` revalida `/<slug>`, así que el refresco ya llega sin la sección.

---

## DT-033 — Idempotencia de `crearMinutoAMinuto` con clave de envío del cliente

**Fecha:** 2026-09-30 · **Tarea:** Endurecimiento pre-reto

### Contexto

El composer del minuto a minuto reintenta automáticamente la Server Action ante un corte de red (DT-017, `ejecutarConReintentos`). Si el servidor completaba la subida y el `INSERT` y lo que se perdía era la respuesta (túnel, cambio de celda), el reintento publicaba la entrada dos veces, con dos fotos en Storage. Deuda registrada desde la revisión de DT-017.

### Decisión

1. **Migración `0014_mam_clave_envio.sql`:** columna `minuto_a_minuto.clave_envio uuid` (nullable) + índice único parcial `minuto_a_minuto_clave_envio_idx (clave_envio) where clave_envio is not null`.
2. **Cliente (`ComposerMinutoAMinuto.tsx`):** `crypto.randomUUID()` por entrada, guardado en un ref y enviado en el `FormData` como `clave_envio`. Se conserva entre los reintentos automáticos y también si se vuelve a pulsar "Publicar" tras un error sin tocar nada; se descarta al publicar con éxito o al cambiar el texto o la foto (ya es otra entrada).
3. **Servidor (`crearMinutoAMinuto`):** `clave_envio` validada con zod como UUID opcional (vacía ⇒ sin clave; no UUID ⇒ error sin subir nada). Tras resolver el intento activo del reto (DT-028) y **antes de subir la foto**, si ya existe una fila con esa clave en ese intento ⇒ `{ ok: true }` sin subir ni insertar. Al insertar, un error `23505` con clave ⇒ `{ ok: true }` (dos envíos cruzados: el índice rechaza el segundo). La sesión sigue verificándose con `resolverRetoConSesion` como primera operación (DT-029).
4. **Foto sin fila:** si el `INSERT` falla (23505 o fallo real) se borra la foto recién subida con `borrarObjeto`, localizada con `rutaObjetoMinutoAMinuto(url)` (pura, solo reconoce el nombre generado en la raíz del bucket).

### Alternativas valoradas

**No reintentar automáticamente cuando ya se envió el cuerpo.** Descartada: el navegador no puede saberlo, y quitar el reintento contradice DT-017.
**Pedir confirmación antes de reintentar.** Descartada: el reintento debe ser invisible para quien camina.
**Deduplicar por contenido (texto + ventana de tiempo).** Descartada: frágil y puede fusionar dos entradas legítimas iguales ("¡Descanso!").
**`upsert` con `onConflict: clave_envio`.** Descartada: PostgREST no admite `on conflict` sobre un índice parcial sin repetir su predicado, y además no evita la segunda subida de la foto; la comprobación previa + 23505 sí.

### Notas de cierre (implementación)

- **Orden cambiado:** el intento activo se resuelve ahora antes de subir la foto (antes se subía primero). Sin intento activo ya no queda una foto huérfana.
- **Borrado también en fallo real del insert:** lo aprobado pedía borrar la foto solo en el 23505; se borra en cualquier fallo del `INSERT` porque ninguna fila la referencia y el reintento sube la suya.
- **Límite conocido:** si tras un error se edita el texto y se reenvía, la clave es nueva; si el primer envío sí había llegado, quedan dos entradas (con textos distintos). Es la semántica buscada: la clave identifica una entrada concreta, no "lo último que se intentó publicar".
- **La clave no es secreta:** la policy SELECT de `anon` (0007) la deja leer por PostgREST como el resto de la fila; conocerla no permite escribir (solo el service role inserta). La API pública no la selecciona.
- **Mismo lote:** `cargarImagen` (`lib/imagen/preparar-foto.ts`) rechaza a los 10 s (`LIMITE_DECODIFICACION_MS`) y la degradación al original lo absorbe; el composer, el modal "Finalizar" y la foto de quién camina muestran "Sigue subiendo, no cierres la página." pasados 15 s de envío, sin abortar (`lib/envio/aviso-envio-lento.ts`: las Server Actions no aceptan `AbortSignal` y abortar agravaría los duplicados).

### Nota posterior (2026-09-30) — UUID sin contexto seguro

`crypto.randomUUID()` (punto 2) solo existe en contextos seguros: con el panel abierto por HTTP en la LAN (`pnpm dev` desde el móvil) el envío lanzaba. El composer usa `generarUuidV4()` (`lib/envio/uuid.ts`): `randomUUID` si existe; si no, un v4 construido con `crypto.getRandomValues` (bits de versión y variante fijados; test de formato y de que pasa el `z.uuid()` del servidor).

---

## DT-034 — Vista previa de la web en el admin, peregrino opcional, Instagram en Configuración y URL del GPS con token

**Fecha:** 2026-09-30 · **Tarea:** Vista previa y feedback del usuario

### Contexto

Cuatro peticiones del usuario: (A) poder ver desde el admin cómo se vería ahora la web en cada fase con la configuración actual; (B) apagar el peregrino animado; (C) editar el perfil de Instagram desde Configuración; (D) ver en el superadmin la URL completa del GPS con el token ("no veo el api track token").

### Decisión

**A. Vista previa.**
1. **Una sola composición:** la de `app/[slug]/page.tsx` se mueve a `components/publico/WebReto.tsx` (Server Component, con los `*Conectado` y sus cargadores). Props: `reto, config, textos, trazaCoords, fase, fuente, vistaPrevia`; `fuente` es `{ tipo: "real"; intento } | { tipo: "ejemplo"; datos: DatosEjemplo }`. La página pública queda mínima y la vista previa usa exactamente el mismo componente.
2. **Página `app/[slug]/admin/vista-previa/page.tsx`:** `force-dynamic`, `robots: noindex, nofollow`, sesión verificada con `resolverRetoConSesion` (sin ella, `/admin/login?returnTo=/<slug>/admin`), `?fase=` validado con `esFaseWeb` (inválido ⇒ "antes"). Vive bajo `/:slug/admin/*`: el proxy ya la protege y no registra visitas por la página (sus lecturas GET a `/<slug>/api/*` sí se registran por un problema previo del `matcher` de `proxy.ts`, ver `DEBT.md`).
3. **Datos:** reales si la fase elegida es la del intento activo (`debeUsarDatosReales`, `lib/vista-previa/fuente.ts`); si no, `datosEjemplo(fase, modo, trazaCoords, ahora)` (`lib/vista-previa/datos-ejemplo.ts`, puro): guiado ~42 % con km de la traza de PINTADO (solo para la maqueta; nunca se lee `traza.geojson`), libre sobre una traza sintética fija, tiempos relativos a `ahora`, 3 entradas del minuto a minuto con ids negativos y sin foto. Modo: el del intento, libre si el reto no tiene ruta (`modoDeVistaPrevia`).
4. **Sin escrituras ni polling:** contexto cliente `VistaPreviaProvider`/`useVistaPrevia` (`components/publico/VistaPrevia.tsx`). `IntencionForm`, `ComentarioForm` y `RespuestaForm` usan `envioPermitido` (`lib/vista-previa/envio.ts`) para el `disabled` y para salir antes del `fetch`, con el aviso "Vista previa: no se envía". `ModoDurante`, `ModoDuranteLibre` y `MinutoAMinuto` no crean el `setInterval`. `RefrescoAlCambiarFase` no se monta (la fase previsualizada no coincide con `/api/fase` y recargaría el iframe sin parar). Las lecturas (primera página del minuto a minuto real, muro) siguen siendo GET normales.
5. **Pestaña "Vista previa"** (`SeccionVistaPrevia.tsx`): selector de fase como estado local (el `?fase=` del panel ya es de Tráfico), iframe 390×780 con marco de móvil y botón "Recargar" (cambia la `key`).

**B. Peregrino.** Columna `retos.peregrino_animado boolean not null default false` (`0015`), `true` en `santi-ago`. Entra en `CAMPOS_CONFIG_RETO`; `configDelReto` usa `?? true` para que desplegar antes de la migración no cambie la web. Interruptor en Configuración; zod de `guardarConfiguracion` lo exige. `WebReto` solo monta `PeregrinoLibre` si está encendido.

**C. Instagram.** `normalizarPerfilInstagram` (`lib/retos/instagram.ts`, puro) acepta `@usuario`, `usuario`, `instagram.com/usuario` o `http(s)://(www.)instagram.com/usuario[/][?…]` y devuelve `https://instagram.com/usuario` (vacío = sin enlace); rechaza otros dominios, esquemas (`javascript:`), rutas con más segmentos y rutas reservadas (`p`, `reel`, `explore`…). Se guarda en la fila de siempre (`textos.cierre_antes_instagram_url`) con una acción nueva `guardarInstagram(slug, valor)`. La clave sale de la pestaña Textos (`CLAVES_TEXTO_GESTIONADAS_EN_CONFIGURACION` en `lib/textos/bloques.ts`, incluida en la comprobación de exhaustividad) y `guardarTexto` la rechaza. La web solo la pinta si pasa `esUrlPerfilInstagram` (en `urlInstagramVisible` y en `EnlaceInstagram`).

**D. URL del GPS.** El superadmin muestra `<origen>/api/track?reto=<slug>&t=<TRACK_TOKEN>` (`lib/superadmin/url-tracker.ts`) en `UrlTrackerConToken.tsx`: oculta por defecto, "Mostrar" y "Copiar" (portapapeles; si falla, la deja seleccionada). Sin `TRACK_TOKEN`, aviso. El token se lee en el servidor y solo se envía a esta página, que verifica la sesión del superadmin por sí misma antes de leerlo.

### Alternativas valoradas

**Vista previa como ruta pública con `?preview=`**: descartada, cualquiera podría ver datos de ejemplo mezclados con la web real y habría que autenticar una ruta pública. **Duplicar la composición en la página de vista previa**: descartada, las dos acabarían divergiendo. **Bloquear escrituras solo en el servidor** (detectar que vienen del iframe): descartada, las APIs públicas no distinguen al admin y el visitante vería errores; el bloqueo en el cliente es suficiente porque la vista previa no tiene más privilegios que un visitante. **Guardar Instagram dentro de `guardarConfiguracion`**: descartada, mezcla un `update` de `retos` con un upsert en `textos` y rompe el esquema estricto de interruptores; una acción propia es más clara y el formulario solo la llama si el perfil cambió.

### Notas de cierre (implementación)

- **`guardarInstagram` en vez de ampliar `guardarConfiguracion`** (el plan dejaba elegir). Un solo botón "Guardar configuración": valida el perfil en el cliente antes de enviar nada (con un perfil mal escrito no se guardan tampoco los interruptores) y luego llama a cada acción solo si su parte cambió. Si la segunda falla, la primera ya quedó guardada y se muestra el error.
- **`esUrlPerfilInstagram` exige esquema pero admite `www.`, barra final, query y `http`**: así los valores guardados antes de la normalización (p. ej. `https://www.instagram.com/usuario/`) se siguen pintando y solo desaparecen los que no son un perfil.
- **Llegada de ejemplo al 100 %** (0 km restantes; el plan hablaba de ~42 %, que es el valor de "durante").
- **`EntradaMinutoAMinutoPublica` pasa a `lib/types.ts`** (derivado de `MinutoAMinuto`) para que `lib/vista-previa/` no importe tipos de un componente; `MinutoAMinuto.tsx` lo reexporta.
- **El superadmin verifica la sesión en la página**, además del layout y el proxy: según la guía de autenticación de Next 16, un layout no impide que la página se renderice ni que su contenido viaje en el payload RSC, y esta página lleva el token.

### Nota posterior (2026-09-30) — Instagram: dominio a secas, rutas reservadas y web móvil

`instagram.com` o `www.instagram.com` sin usuario cumplían el patrón de usuario (letras y puntos) y se guardaban como `https://instagram.com/instagram.com`. Ahora `esUsuarioValido` rechaza el propio dominio (`(www.|m.)instagram.com`), las rutas reservadas siguen siendo `p`, `reel`, `reels`, `explore`, `stories`, `accounts`, `direct` y `tv` (en URL, con `@` o a secas), y se acepta la web móvil `m.instagram.com/usuario` (normaliza a `https://instagram.com/usuario`; `esUrlPerfilInstagram` también la admite). Siguen sin aplicarse las reglas finas de Instagram sobre puntos (inicial/final o `..`), ver `DEBT.md`.

### Nota posterior (2026-10-01) — la URL del GPS pasa a DT-035

La parte D (URL del GPS con el `TRACK_TOKEN` global, `UrlTrackerConToken.tsx`) queda sustituida por DT-035: token propio por reto, visible también en el admin del reto, con QR de OwnTracks y regeneración. `lib/superadmin/url-tracker.ts` se movió a `lib/gps/url-tracker.ts`.

### Nota posterior (2026-10-01) — el peregrino pasa a DT-036

La parte B (interruptor `peregrino_animado`, `PeregrinoLibre`) queda sustituida por DT-036: cada reto elige su monigote entre 22 (o ninguno), con grito y sonido configurables. `peregrino_animado` sale de `CAMPOS_CONFIG_RETO`/`ConfigReto`, queda obsoleta en BD (`0017`) y se elimina en `0018`; `PeregrinoLibre.tsx` se borra (el monigote "atleti" es el mismo peregrino rojiblanco).

---

## DT-035 — Token de GPS por reto (el QR de OwnTracks se retiró)

**Fecha:** 2026-10-01 · **Tarea:** Token de GPS por reto + QR de OwnTracks

### Contexto

`/api/track` comparaba contra una única env var (`TRACK_TOKEN`) para todos los retos (DT-028 dejó el token global y el reto en `?reto=`). Problemas: el móvil de un reto podía escribir posiciones en cualquier otro; rotar el token obligaba a cambiar Vercel, redesplegar y reconfigurar todos los móviles; solo el superadmin podía ver la URL (DT-034), y configurar OwnTracks exigía pegar la URL a mano en el móvil. El usuario pide: token propio por reto, visible, copiable y regenerable por el admin del reto y por el superadmin, y un QR que configure OwnTracks solo.

### Decisión

1. **Tabla `retos_gps`** (`0016`): `reto_id` PK/FK con cascada, `track_token text not null unique check (length >= 32)`, `updated_at`. RLS activada sin políticas y `revoke all` a anon/authenticated: solo service role. La migración siembra un token por reto existente con `pgcrypto` (24 bytes en base64url). **Token en claro**, no hasheado: el panel tiene que poder volver a mostrar la URL y el QR sin rotarlo; es un secreto aleatorio de 192 bits, no una contraseña humana, así que lo que se protege es el acceso a la tabla.
2. **`lib/supabase/credenciales-gps.ts`**: `generarTokenGps()` (`randomBytes(24).toString("base64url")`), `obtenerTokenGps`, `listarCredencialesGps` (superadmin, una consulta), `obtenerTokenGpsPorSlug` (una consulta: `retos_gps` con `retos!inner(id, ruta_id)` filtrado por `retos.slug`, validada con zod), `guardarTokenGps` (upsert por `reto_id` con `updated_at`) y `asignarTokenGpsNuevo` (genera + guarda, reintento único ante 23505). Las lecturas nunca lanzan y fallan cerrado.
3. **`/api/track`**: rate limit por IP (120/min) → formato del slug (zod) → `obtenerTokenGpsPorSlug` → SHA-256 + `timingSafeEqual` contra el token del reto o contra un valor ficticio aleatorio si no hay reto/token → rate limit por reto (40/min) → payload, intento activo, filtro geográfico (sin cambios). **Slug mal formado, sin `reto`, reto inexistente, reto sin token y token incorrecto ⇒ el mismo `401 {"error":"unauthorized"}`**. Cambia DT-028, que daba `200 []` al reto inexistente: con token por reto ese caso ya es un fallo de autenticación y unificarlo evita distinguir desde fuera qué retos existen con token. Desde el payload en adelante, los descartes siguen siendo `200 []`.
4. **Acciones**: `regenerarTokenGps(slug)` (admin, `resolverRetoConSesion`) y `regenerarTokenGpsReto(retoId)` (superadmin, sesión + id validado). Upsert + `revalidatePath`; **nunca devuelven el token**. `crearReto` genera el token del reto nuevo; si falla, el reto se crea igual y la tarjeta ofrece "Generar" (misma acción).
5. **El token solo se lee en páginas que verifican la sesión ellas mismas** (regla de DT-034): la página del superadmin y la pestaña GPS del admin (`SeccionGps`, que vuelve a llamar a `resolverRetoConSesion` aunque la página ya lo hizo).
6. **OwnTracks** (`lib/gps/owntracks.ts`, puro): `construirConfigOwnTracks` con las claves verificadas en https://owntracks.org/booklet/tech/json/ — `_type: "configuration"`, `mode: 3` (HTTP), `url`, `tid` (2 caracteres del slug), `deviceId` (slug), `auth: false` (el token va en la query), `extendedData: true`, `monitoring: 1` (significant), `locatorInterval: 180`, `locatorDisplacement: 100`, `ignoreInaccurateLocations: 100`. `enlaceOwnTracks` = `owntracks:///config?inline=` + base64 (UTF-8) codificado para URL.
7. **Origen de la URL**: `https://${VERCEL_PROJECT_PRODUCTION_URL}` si existe; si no, el de las cabeceras de la petición, con aviso en la UI (una preview o localhost dejaría al móvil sin destino).
8. **UI** (`components/gps/ConfigGps.tsx`, cliente, compartido): recibe del servidor `DatosConfigGps` (URL con y sin token, enlace, QR SVG en data URL generado con `qrcode`, fecha, origen provisional) o `null`. URL y QR ocultos por defecto; Mostrar, Copiar (portapapeles o selección), "Abrir en OwnTracks", Regenerar con confirmación; instrucciones de 4 pasos. Admin: pestaña nueva "GPS". Superadmin: en cada tarjeta, en lugar de `UrlTrackerConToken`. La CSP actual solo fija `frame-ancestors`, así que no bloquea `img` con `data:`.

### Alternativas valoradas

**Hashear el token en BD** (como la contraseña de admin): descartada, obligaría a regenerar cada vez que haya que volver a enseñar el QR. **Columna en `retos`**: descartada, `retos` tiene SELECT para anon. **Mantener `TRACK_TOKEN` como fallback**: descartada, dejaría viva la credencial global que la tarea quiere eliminar. **Devolver el token desde la acción de regenerar**: descartada, las Server Actions son endpoints públicos; la página lo vuelve a leer tras verificar sesión. **QR en PNG**: descartada, SVG escala sin perder nitidez y no necesita codificador de imágenes.

### Notas de cierre (implementación)

- **`obtenerTokenGpsPorSlug` devuelve también `rutaId`** (el plan decía `{ retoId, token }`): el filtro geográfico necesita la ruta y así `/api/track` sigue haciendo una sola consulta para autenticar. `retos_gps` declara su `Relationships` hacia `retos` en `BaseDeDatos` para tipar el embed.
- **Pestaña propia "GPS"** en el admin (el plan dejaba elegir): configurar un dispositivo es una tarea distinta de los interruptores de la web, y así el token no viaja al navegador cada vez que se abre Configuración.
- **`ConfigGps` recibe `datos | null`** en vez de props sueltas; añade `urlSinToken` (enmascarar) y `origenProvisional` (aviso). "Abrir en OwnTracks" y el QR solo se pintan tras "Mostrar".
- **Rate limit con claves prefijadas** (`track:ip:`, `track:reto:`) porque el `Map` de `lib/rate-limit.ts` es compartido con las rutas que usan la IP a secas.
- **Slug mal formado ⇒ 401 sin consultar BD** (el formato del slug no es secreto; la comparación ficticia se reserva para los casos que sí consultan).
- **Despliegue:** aplicar `0016` → desplegar → reconfigurar cada móvil con el QR → borrar `TRACK_TOKEN` de Vercel.


---

## DT-036 — Monigote elegible por reto (22 del catálogo)

**Fecha:** 2026-10-01 · **Tarea:** Monigote elegible por reto

### Contexto

DT-034 hizo opcional el peregrino animado (`PeregrinoLibre`, rojiblanco, con «¡AUPA ATLETI!»), pero es un guiño personal del reto original. El usuario aprobó un catálogo de 22 monigotes temáticos del Camino (`design-sandbox/public/monigotes-tematicos.html`: HTML + CSS + JS vanilla + SVG inline + Web Audio) y pide que cada reto elija el suyo (o ninguno), con su grito personalizable y la opción de que suene al pincharlo. Port fiel: mismo aspecto y comportamiento que el catálogo.

### Decisión

1. **Catálogo puro en `lib/monigotes/`** (servidor + cliente): `catalogo.ts` (`IDS_MONIGOTE` as const, `DefMonigote`, `MONIGOTES`, `esIdMonigote`), `piezas.ts` (piezas SVG comunes), `figuras.ts` (`FIGURAS: Record<IdMonigote, (uid) => string>`, `svgFigura`, `uidSvgSeguro`), `marcas.ts` (`MARCAS`, `particulaSvg`) y `grito.ts` (`normalizarGritoMonigote`, `gritoEfectivo`, `partirGrito`, km del mojón). Figuras, marcas, partículas y CSS se extrajeron del HTML con un script (no a mano) para no perder fidelidad.
2. **Motor de navegador en `components/monigotes/`**: `motor.ts` (DOM imperativo: `crearSuelto`, `lanzarGrito`, `montarTarjeta`; contador de km a nivel de módulo; limpieza completa de rAF, temporizadores de pose/arrebato/hipo, marcas y grito), `sonidos.ts` (Web Audio sintetizado, versión mejorada para iPhone: `navigator.audioSession.type = "playback"`, buffer mudo de desbloqueo y reproducción tras `ctx.resume()`), `monigotes.css` y `MonigoteSuelto.tsx` (crea las tres capas con refs y llama al motor en un efecto; StrictMode-safe). DOM imperativo a propósito: el monigote se mueve en cada frame y deja decenas de marcas animadas; con estado de React serían renders por frame.
3. **CSS aislado**: todo el CSS del catálogo bajo la clase raíz `.mng` y keyframes con prefijo `mng-` (las clases del catálogo son genéricas: `.pa`, `.pose`, `.bob`, `.giro`…). El grito usa `var(--font-fraunces)` (next/font del layout raíz). Un test comprueba que ninguna regla queda fuera de `.mng` y que toda animación usada tiene su `@keyframes`.
4. **SVG como string**: `innerHTML`/`dangerouslySetInnerHTML` solo con strings de `FIGURAS`/`MARCAS`/`particulaSvg` (números y colores del catálogo) y un `uid` derivado de `useId()` saneado a `[a-z0-9-]` (va en `url(#ra-…)`). El grito y el bocadillo **nunca** por innerHTML: `textContent`.
5. **BD** (`0017`): `retos.monigote text null` con check de formato `^[a-z]{2,24}$` (solo formato: el catálogo vive en el código y puede crecer sin migración), `monigote_grito text null` con `char_length between 1 and 48`, `monigote_sonido boolean not null default true`; `monigote = 'atleti'` donde `peregrino_animado`; `peregrino_animado` comentada como obsoleta (se elimina en `0018`).
6. **Lectura** con `monigoteDelReto(reto)` (`lib/retos/config.ts`): columna `monigote` ausente ⇒ red de compatibilidad con `peregrino_animado ?? true` (encendido ⇒ "atleti"); id desconocido ⇒ ninguno; grito normalizado; `sonido ?? true`. `peregrino_animado` sale de `CAMPOS_CONFIG_RETO`/`ConfigReto`.
7. **Escritura**: `guardarConfiguracion` amplía su zod `.strict()` con `monigote: z.enum(IDS_MONIGOTE).nullable()`, `monigote_grito` (1–48 caracteres contados por code point, como `char_length`) o null y `monigote_sonido`; normaliza el grito en el servidor (sin monigote ⇒ null); un solo `update` tras `resolverRetoConSesion` (DT-029) que además escribe `peregrino_animado = monigote !== null` mientras exista la columna. Revalida `/<slug>` y `/<slug>/admin`. El obsoleto `peregrino_animado` ya no se acepta en la entrada.
8. **Huella pública** (`lib/retos/huella-publica.ts`): incluye `[id, grito, sonido]` en orden fijo; `WebReto` y `/api/fase` la calculan igual, así que cambiar de monigote refresca la web abierta.
9. **Web**: `WebReto` (Server Component) monta `MonigoteWeb` solo si `monigote.id`; `MonigoteWeb` (cliente) carga `MonigoteSuelto` con `next/dynamic` + `ssr: false` (no se admite en Server Components). La vista previa lo hereda. Sin aviso "Activar sonido": con el sonido apagado, no suena.
10. **Admin**: en Configuración, el interruptor "Peregrino animado" se sustituye por `SelectorMonigote` (cargado con `next/dynamic` + esqueleto): `role="radiogroup"` con "Ninguno" + 22 tarjetas (figura de 64 px andando en su sitio sin rastro, nombre y "Probar" = pose 3 s + bocadillo + grito a pantalla completa + sonido si está marcado), roving tabindex con flechas/Inicio/Fin, tarjetas fuera de pantalla pausadas con IntersectionObserver. Debajo, el panel del elegido: grito (máx. 48, placeholder = grito por defecto, contador) y "Que suene al pincharlo". Cambiar de monigote vacía el grito personalizado. Interruptores y monigote se guardan con la misma acción.

### Alternativas valoradas

**Figuras como componentes JSX**: descartada, 22 figuras reescritas a mano perderían fidelidad y el motor necesitaría React por frame. **Imágenes/sprites estáticos**: descartada, se pierden las animaciones por partes (piernas, brazos, pose) del catálogo. **Enum en BD con los 22 ids**: descartada, cada monigote nuevo exigiría migración; basta el check de formato y que el código trate un id desconocido como "ninguno". **CSS Modules**: descartada, el motor genera marcado con las clases literales del catálogo; el aislamiento por prefijo `.mng` es equivalente y mantiene el CSS idéntico. **Aviso "Activar sonido" en la web pública**: descartado por el usuario.

### Notas de cierre (implementación)

- **`normalizarGritoMonigote(valor, gritoPorDefecto)`** recibe el grito por defecto (el plan lo nombraba con un solo argumento): hace falta para "igual al de defecto ⇒ null". Quita controles C0/C1 y además las marcas bidi de incrustación/aislamiento (U+202A–E, U+2066–9), que también son invisibles y reordenan el texto; respeta el ZWJ de los emoji compuestos.
- **`gritoVivo` es un booleano** en `DefMonigote` (en el catálogo era una función que leía la variable global `KM`): `gritoEfectivo(def, grito, km)` produce «¡Quedan N!». Escribir el grito por defecto del mojón («¡Quedan 100!») cuenta como no personalizado y sigue cantando los km.
- **`MonigoteWeb` recibe `id`, `grito` y `sonido` como props primitivas** (el plan decía `config={monigote}`): son las dependencias del efecto de `MonigoteSuelto` y así no se recrea el monigote por una referencia nueva.
- **Margen superior de 64 px** para los destinos del suelto (el catálogo usaba el borde de su propia barra, que la web no tiene): el mismo que usaba `PeregrinoLibre`.
- **Las tarjetas del selector conservan el hipo del borrachillo y el arrebato del pimiento** (solo con la tarjeta visible), como en el catálogo; nunca suenan.
- **"Probar" en color eucalipto** en vez del acento de cada monigote: varios acentos (guiri, flecha) no tienen contraste suficiente sobre blanco.
- **Movimiento reducido**: además de lo del catálogo (todo quieto, grito sin entrada, sin partículas), las poses estáticas del peregrino y el abuelo que el catálogo solo aplicaba con su simulador `.rm` se aplican también con la media query real. Si la preferencia cambia con la página abierta, el suelto se vuelve a crear.
- **Verificación visual** con Chrome headless (tiempo real vía DevTools) sobre una página temporal ya borrada: las 22 figuras, el grito del mojón con la placa bajando, el grito del atleti suelto, huellas, hipo, arrebato y movimiento reducido. No hay Supabase local: la web real y el panel con datos quedan para la preview.
- **Despliegue:** aplicar `0017` antes de desplegar (si no, guardar la configuración falla hasta aplicarla; la lectura tiene red). `0018` (borrar `peregrino_animado`) cuando el código desplegado ya no la escriba.

> **Nota posterior (2026-10-01): se retira el QR.** En las pruebas con un móvil real el QR no llegó a configurar OwnTracks (al servidor no llegó ninguna petición) y el usuario prefirió no seguir con él. Se elimina el enlace `owntracks:///config?inline=`, su QR (`lib/gps/owntracks.ts`, dependencia `qrcode`) y el botón "Abrir en OwnTracks". El panel muestra un tutorial para configurar OwnTracks a mano (HTTP, URL copiada, modo **Move** y **Locator interval** 60 s) y conserva la URL con token, Copiar y Regenerar. El token por reto y `/api/track` no cambian.
