# Arquitectura

## Visión general

Next.js 16 con App Router. Todo el dominio de negocio vive en `lib/`. La UI
en `app/` y `components/`. Las capas de infraestructura (BD, auth, endpoints)
en sus propios módulos bajo `lib/` y `app/api/`.

## Estructura de carpetas

```
camino-santi-ago/
├── app/
│   ├── page.tsx              # web pública (F3: antes/durante/llegada)
│   ├── layout.tsx
│   ├── globals.css
│   ├── admin/
│   │   ├── login/page.tsx    # F4
│   │   ├── page.tsx          # F4: panel admin
│   │   └── actions.ts        # F4: server actions de admin (incluye minuto a minuto, DT-013)
│   └── api/
│       ├── track/route.ts    # F2: ingesta OwnTracks; filtro geográfico DT-006 solo en
│       │                     # modo guiado, se salta en modo libre (DT-016)
│       ├── progreso/route.ts     # F3: GET, caché TTL en memoria (DT-007); el cálculo en sí
│       │                         # (bifurcación por modo DT-016, histórico paginado DT-018,
│       │                         # compatibilidad migración 0003) vive en
│       │                         # lib/traza/progreso-actual.ts (calcularProgresoActual,
│       │                         # extraída por DT-019); este fichero solo añade caché+rate limit
│       ├── comentarios/route.ts  # F3: GET paginado + POST; FP3a/DT-030: GET pagina raíces + respuestas
│       │                         # por hilo; POST raíz o respuesta (parent_id), reglas también en BD (0011);
│       │                         # FP3c/DT-032: 403 con la sección o las respuestas de visitantes apagadas (también RLS, 0012)
│       ├── intenciones/route.ts  # F3: POST (cliente admin); FP3c/DT-032: 403 con la sección apagada
│       ├── admin/login/route.ts  # F4
│       ├── fase/route.ts         # auto-refresco de fase: GET mínimo, sin caché (DT-012)
│       └── minuto-a-minuto/route.ts  # DT-013: GET paginado (offset/limit) + poll incremental (despuesDeId);
│                                     # FP3c/DT-032: 403 con la sección apagada
├── components/
│   ├── mapa/Mapa.tsx         # F3: overlay SVG (patrón de la POC); prop puntoResaltado (DT-013);
│   │                         # prop variante "ruta"|"libre" (DT-016, modo libre sin traza de fondo)
│   ├── publico/              # F3: hero, stats, formularios, hilo
│   │   ├── WebReto.tsx        # DT-034: composición de la web (Server Component, con los *Conectado y sus
│   │   │                      # cargadores), compartida por app/[slug]/page.tsx y la vista previa del admin;
│   │   │                      # `fuente` real/ejemplo; con `vistaPrevia` no monta RefrescoAlCambiarFase;
│   │   │                      # PeregrinoLibre solo si config.peregrino_animado
│   │   ├── VistaPrevia.tsx    # DT-034: VistaPreviaProvider + useVistaPrevia (formularios sin envío, sin polling)
│   │   ├── MuroComentarios.tsx / HiloComentario.tsx / RespuestaForm.tsx / InsigniaCaminante.tsx
│   │   │                      # FP3a/DT-030: muro en hilos de un nivel, plegado si > 2 respuestas;
│   │   │                      # FP3c/DT-032: prop permitirRespuestas (sin "Responder" si el reto las apaga)
│   │   ├── ComentariosConMuro.tsx  # ComentarioForm + MuroComentarios en durante/llegada: al enviar un
│   │   │                           # comentario público pide al muro (ref, useImperativeHandle) recargar la página 0
│   │   ├── ModoAntes.tsx / ModoDurante*.tsx / ModoLlegada*.tsx
│   │   │                      # FP3c/DT-032: reciben `config` del reto y no montan las secciones apagadas;
│   │   │                      # ModoAntes pinta la foto de "quién camina" del reto (o silueta)
│   │   ├── RefrescoAlCambiarFase.tsx  # auto-refresco: polling 30 s a /api/fase, reload si cambia (DT-012)
│   │   ├── MinutoAMinuto.tsx  # DT-013: feed en directo, paginado + poll opcional, clic → mapa;
│   │   │                      # FP3b/DT-031: sección plegable (plegadoInicial en "llegada") con aviso de nuevas
│   │   ├── RecuadroLlegada.tsx  # DT-024: kicker+título+mensaje de la pantalla "llegada", extraído de
│   │   │                        # ModoLlegada.tsx para compartirlo con la preview de ModalFinalizar.tsx
│   │   ├── FotoLlegada.tsx      # DT-024: tarjeta de la foto opcional de llegada, mismo motivo
│   │   ├── DistanciaRestante.tsx  # DT-016: cifra de distancia restante (modo libre), hermano de Mojon.tsx
│   │   ├── ModoDuranteLibre.tsx   # DT-016: "durante" del modo libre (sin condicionales en ModoDurante.tsx);
│   │   │                         # CURRENT.md/DT-020 añade Stats.tsx (tiempo en marcha/km/ritmo,
│   │   │                         # con ultimaPosicion?.ts como referencia final, nunca "ahora")
│   │   └── ModoLlegadaLibre.tsx   # DT-016: "llegada" del modo libre (sin condicionales en ModoLlegada.tsx);
│   │                              # CURRENT.md/DT-020 añade Stats.tsx (tiempo en marcha/km/ritmo,
│   │                              # con ended_at como referencia final)
│   └── admin/               # F4: secciones del panel
│       ├── SeccionConfiguracion.tsx   # FP3c/DT-032: pestaña "Configuración" (Server Component)
│       ├── FormConfiguracion.tsx      # FP3c/DT-032: interruptores (role="switch"), guardado conjunto;
│       │                              # DT-034: "Peregrino animado" y campo "Perfil de Instagram" (guardarInstagram)
│       ├── SeccionVistaPrevia.tsx     # DT-034: pestaña "Vista previa" — selector de fase (estado local),
│       │                              # iframe 390×780 a /<slug>/admin/vista-previa?fase=…, "Recargar"
│       ├── FotoQuienCaminaForm.tsx    # FP3c/DT-032: subir/cambiar/quitar la foto de "quién camina"
│       │                              # (prepararFotoParaSubida + ejecutarConReintentos, como ModalFinalizar)
│       ├── SeccionTextos.tsx          # FP3c/DT-032: textos agrupados por bloques (<details> + índice de anclas)
│       ├── SeccionComentarios.tsx     # FP3a/DT-030: comentarios agrupados por hilo (agruparHilosAdmin)
│       ├── FormRespuestaAdmin.tsx     # FP3a/DT-030: respuesta del caminante (responderComentario, es_autor)
│       ├── ComposerMinutoAMinuto.tsx  # DT-013: texto + foto opcional; DT-017: envía con
│       │                              # onSubmit propio (no <form action={fn}>: React 19
│       │                              # resetearía el input de fichero al fallar), comprime
│       │                              # la foto antes de enviar, reintenta y muestra el
│       │                              # error sin perder texto ni foto; DT-033: clave_envio
│       │                              # (UUID estable entre reintentos) para no duplicar
│       ├── EntradaMinutoAMinuto.tsx   # DT-013: fila con editar inline (solo texto) + eliminar
│       ├── SeccionMinutoAMinuto.tsx   # DT-013: lista del intento activo (Server Component)
│       ├── ActividadAcciones.tsx      # DT-016: selector de modo (guiado/libre) + destino antes de Iniciar;
│       │                              # DT-024: "Finalizar" abre ModalFinalizar.tsx en vez de window.confirm()
│       ├── ModalFinalizar.tsx         # DT-024: mensaje + foto opcional + preview real (RecuadroLlegada.tsx +
│       │                              # FotoLlegada.tsx) antes de finalizar el reto
│       ├── SeccionTrafico.tsx         # DT-022: pestaña "Tráfico" (Server Component, sin polling);
│       │                              # rango desde intentos.started_at hasta ahora, granularidad vía ?gran=
│       └── GraficoTraficoScroll.tsx   # DT-022: único fragmento "use client" de la pestaña —
│                                      # scroll automático al extremo derecho del SVG al montar
├── lib/
│   ├── types.ts              # tipos de dominio (contrato para todas las capas); ProgresoPublico
│   │                          # es unión discriminada por `modo` desde DT-016 (ProgresoPublicoGuiado
│   │                          # | ProgresoPublicoLibre); ProgresoPublicoLibre gana odometroKm
│   │                          # (CURRENT.md/DT-020, antes solo lo tenía la rama guiada)
│   ├── ritmo.ts               # dominio puro: calcularRitmoMedioIntento() y
│   │                          # calcularTiempoEnMarchaIntento() (CURRENT.md/DT-020) — ambas
│   │                          # parametrizadas por un instante final explícito (nunca leen
│   │                          # Date.now()/new Date()); usadas por ModoDurante.tsx,
│   │                          # ModoDuranteLibre.tsx, ModoLlegadaLibre.tsx y app/page.tsx
│   │                          # (ModoLlegadaConectado)
│   ├── comentarios/hilos.ts   # FP3a/DT-030: dominio puro de hilos — motivoRechazoPadre, agruparHilos,
│   │                          # agruparHilosAdmin
│   ├── retos/config.ts        # FP3c/DT-032: dominio puro de la configuración del reto — configDelReto
│   │                          # (campo ausente ⇒ encendido, también peregrino_animado DT-034),
│   │                          # fotoQuienCaminaDelReto, urlInstagramVisible
│   ├── retos/instagram.ts     # DT-034: normalizarPerfilInstagram / esUrlPerfilInstagram (puro)
│   ├── vista-previa/          # DT-034: datos-ejemplo.ts (puro, `ahora` como parámetro, km de la traza de
│   │                          # PINTADO solo para la maqueta), fuente.ts (real vs ejemplo, modo) y
│   │                          # envio.ts (envioPermitido + aviso "Vista previa: no se envía")
│   ├── superadmin/url-tracker.ts  # FP2.5/DT-034: URL de OwnTracks del reto, con y sin token (puro)
│   ├── minuto-a-minuto/       # FP3b/DT-031: contar-nuevas.ts (aviso "N nuevas" con la sección plegada)
│   │                          # y polling.ts (URL del poll, también con feed vacío; fusión sin duplicar ids)
│   ├── cielo.ts               # F3: bandaHoraria() — tinte del mapa por hora real
│   ├── rate-limit.ts          # F5: rate limiting en memoria de proceso (DT-011), usado por todos los endpoints públicos
│   ├── progreso-cache.ts      # DT-014: caché compartida de ProgresoPublico (antes vivía
│   │                          # solo en app/api/progreso/route.ts, DT-007); GET /api/progreso
│   │                          # siempre la lee/escribe; crearMinutoAMinuto la lee, y si está
│   │                          # vacía recalcula con calcularProgresoActual y también la
│   │                          # escribe (DT-019, cierra el caso de caché fría observado al
│   │                          # 100% en la prueba real del 2026-08-07)
│   ├── imagen/                # DT-017: preparación de la foto en el navegador
│   │   ├── limites-subida.ts     # tamaño máximo y formatos aceptados; los comparten
│   │   │                         # cliente y servidor (por debajo del corte de ~4,5 MB
│   │   │                         # que aplica el edge de Vercel)
│   │   ├── escalera-compresion.ts # dominio puro: peldaños calidad→dimensiones, elección
│   │   │                          # del primero que cabe (la codificación entra como parámetro)
│   │   └── preparar-foto.ts      # solo cliente: decodifica con <img> (orientación EXIF),
│   │                             # recodifica a JPEG en canvas, degrada al original si falla
│   │                             # o si la decodificación pasa de 10 s (DT-033)
│   ├── envio/                 # DT-017: envío de formularios del panel a sus Server Actions
│   │   ├── errores-de-envio.ts   # dominio puro: qué fallo se reintenta y qué se enseña
│   │   ├── reintentar.ts         # dominio puro: reintento con espera creciente (espera inyectada)
│   │   └── aviso-envio-lento.ts  # avisarSiTarda: aviso "sigue subiendo" a los 15 s, sin abortar (DT-033)
│   ├── rutas/                    # FP0/DT-025: assets por ruta. Añadir ruta = añadir carpeta.
│   │   └── portuguesa-110/
│   │       ├── traza.geojson     # traza de CÁLCULO (7.951 puntos, sin simplificar, DT-015)
│   │       └── traza-mapa.geojson  # traza de PINTADO (Douglas-Peucker 3 m, ~2.101 pts)
│   ├── traza/
│   │   ├── proyeccion.ts         # dominio puro: prepararTraza + calcularProgreso (modo guiado, cerrado);
│   │   │                         # calcularProgreso proyecta con ventana deslizante (±30 segmentos
│   │   │                         # alrededor del último índice, DT-018) con fallback a escaneo completo
│   │   ├── proyeccion.test.ts    # tests unitarios con fixtures sintéticas
│   │   ├── proyeccion.ventana.test.ts  # DT-018: equivalencia numérica con/sin ventana a escala de
│   │   │                         # miles de puntos, desvío que se sale de la ventana, hueco largo,
│   │   │                         # rendimiento con histórico de un día completo (~7.200 puntos)
│   │   ├── progreso-publico.ts   # F3: aProgresoPublico() — proyección segura al cliente (rama guiado)
│   │   ├── progreso-libre.ts     # DT-016: calcularProgresoLibre() — dominio puro del modo libre
│   │   │                         # (distancia haversine al destino, sin corredor ni validación);
│   │   │                         # CURRENT.md/DT-020 añade odometroKm (haversine acumulado entre
│   │   │                         # posiciones consecutivas del historico recibido, en el orden
│   │   │                         # recibido, sin filtro de velocidad ni precisión — ver DEBT.md,
│   │   │                         # "GET /api/progreso no puede reflejar odometroKm real en modo
│   │   │                         # libre durante el polling": progreso-actual.ts todavía solo le
│   │   │                         # pasa la última posición en la ruta de polling, no el histórico)
│   │   ├── progreso-actual.ts    # DT-019: calcularProgresoActual() — orquesta intento activo +
│   │   │                         # histórico + calcularProgreso/calcularProgresoLibre; extraída
│   │   │                         # de app/api/progreso/route.ts para que GET /api/progreso y
│   │   │                         # crearMinutoAMinuto (app/admin/actions.ts) compartan la misma
│   │   │                         # lógica sin duplicarla. Sin caché propia (I/O con cada llamada)
│   │   ├── cargar-traza.ts       # carga lib/rutas/<rutaId>/traza.geojson (cálculo) server-side
│   │   │                         # FP0/DT-025: parametrizado por rutaId; cachea por ruta
│   │   ├── cargar-traza-mapa.ts  # F3: carga lib/rutas/<rutaId>/traza-mapa.geojson (pintado) server-side
│   │   │                         # FP0/DT-025: parametrizado por rutaId; cachea por ruta
│   │   └── umbrales.ts           # constantes del dominio (EN_RUTA_MAX_M, etc.; VENTANA_PROYECCION_SEGMENTOS
│   │                             # y VENTANA_PROYECCION_FALLBACK_MAX_M de la ventana deslizante, DT-018)
│   ├── supabase/             # F2
│   │   ├── admin.ts          # cliente service role (solo servidor)
│   │   ├── credenciales-admin.ts # DT-029: hash de la contraseña de admin por reto (`retos_admin`)
│   │   ├── public.ts         # cliente anon (peticiones públicas)
│   │   ├── paginacion.ts     # DT-018: obtenerTodasLasFilas() — fetch paginado genérico con .range()
│   │   │                     # en bucle (PostgREST corta a 1000 filas sin Range explícito), tope de
│   │   │                     # seguridad + log; usado por progreso/route.ts (rama guiado) y page.tsx
│   │   └── storage.ts        # DT-013: subida de fotos a Storage (validación MIME/tamaño
│   │                         # con los límites de lib/imagen/limites-subida.ts, DT-017);
│   │                         # DT-024: subirFotoLlegada() sube al mismo bucket con prefijo "llegada-";
│   │                         # FP3c/DT-032: subirFotoQuienCamina() a "<retoId>/quien-camina-…",
│   │                         # rutaObjetoDelReto() (guarda pura de qué se puede borrar) y borrarObjeto()
│   ├── textos/               # F3
│   │   ├── defaults.ts       # textos por defecto (override desde BD)
│   │   ├── bloques.ts        # FP3c/DT-032: BLOQUES_TEXTOS para la pestaña Textos (exhaustividad en tipos);
│   │   │                     # DT-034: CLAVES_TEXTO_GESTIONADAS_EN_CONFIGURACION (fuera de Textos, guardarTexto las rechaza)
│   │   └── obtener-textos.ts # server: fusiona defaults con la tabla `textos`
│   ├── auth/                 # F4
│   │   ├── admin-session.ts  # firma/verificación cookie HMAC ligada a reto {r,s,v,exp} (DT-029)
│   │   ├── password.ts       # DT-029: hash scrypt de la contraseña de admin por reto + huella
│   │   └── sesion-admin-servidor.ts # DT-029: resolverRetoConSesion(slug) — verificación completa
│   │                             # (reto + huella contra BD) en la página del panel y Server Actions
│   ├── admin/                 # F4
│   │   └── navegacion.ts     # estado de navegación (?tab=, ?filtroComentarios=,
│   │                          # ?gran= DT-022) y sus validadores — fuera de
│   │                          # components/admin/ porque esos ficheros son
│   │                          # "use client" (ver comentario en el propio fichero)
│   └── trafico/                # DT-022: dominio puro de la pestaña "Tráfico"
│       ├── bucketing.ts        # agruparVisitasEnTramos() — sin I/O, sin Date.now() implícito
│       └── desglose.ts         # agruparPorRuta()/agruparPorOrigen()
├── proxy.ts                  # protege /admin/* (Next 16: "middleware" se
│                             # renombró a "proxy", ver DT-010) y captura
│                             # visitas a `/` para `visitas_web` (DT-022)
├── docs/
│   ├── traza-camino-portugues.geojson  # fuente original (CC BY-SA 4.0 Xunta)
│   ├── producto/
│   ├── tecnico/
│   ├── tareas/
│   └── bugs/
├── scripts/
│   └── simplificar-traza.ts  # genera traza.geojson y traza-mapa.geojson
├── CHANGELOG.md
├── DEBT.md
├── CLAUDE.md
└── AGENTS.md
```

## Capas y sus responsabilidades

| Capa | Ubicación | Regla |
|---|---|---|
| Dominio puro | `lib/traza/proyeccion.ts` | Sin I/O, sin efectos laterales. Tests con fixtures sintéticas. |
| Tipos | `lib/types.ts` | Solo tipos. Sin lógica, sin cliente de BD. |
| Constantes de dominio | `lib/traza/umbrales.ts` | Cada umbral con su porqué. |
| Infraestructura BD | `lib/supabase/` | Solo clientes. Sin lógica de negocio. |
| Endpoints | `app/api/` | Validación Zod en la frontera. Sin lógica de negocio. |
| Server Actions | `app/admin/actions.ts` | Mutaciones del panel. Autenticadas con la cookie del reto del slug (`resolverRetoConSesion`, DT-029) como primera operación de cada acción. Los fallos esperados de `crearMinutoAMinuto`, `finalizarReto` (DT-024), `responderComentario` (DT-030), `guardarConfiguracion` y `guardarFotoQuienCamina` (DT-032) y `guardarInstagram` (DT-034) se devuelven (`ResultadoPublicacion`), no se lanzan: Next redacta en producción el mensaje de todo error lanzado en el servidor (DT-017). `crearMinutoAMinuto` recalcula el progreso con `lib/traza/progreso-actual.ts` cuando la caché compartida está vacía, en vez de guardar la posición a `null` (DT-019). |
| UI | `app/` + `components/` | Sin lógica de negocio. Consume `lib/`. |

## La regla no negociable de las dos trazas

**Hay exactamente dos representaciones de la traza y tienen responsabilidades
distintas. Mezclarlas es el bug más caro posible.**

| | `lib/traza/traza.geojson` | `lib/traza/traza-mapa.geojson` |
|---|---|---|
| Propósito | CÁLCULO de progreso | PINTADO en el mapa (cliente) |
| Puntos | 7.951 (sin simplificar, DT-015) | ~2.101 (Douglas-Peucker 3 m) |
| Longitud | ~110,43 km (real, corredor extendido DT-005 + DT-015) | ~110,13 km (acortada por DP) |
| Dónde se usa | `proyeccion.ts`, solo servidor | Se envía al navegador en F3 |
| Puede usarse para calcular % | SÍ | **NO — su longitud no es válida** |

Douglas-Peucker corta esquinas y acorta la línea ~298 m. Si el cálculo usara
la traza simplificada, Santi llegaría al Obradoiro y la web le diría que le
faltan 298 m — el peor fallo posible en el peor momento.

`proyeccion.ts` se ejecuta en servidor. Al cliente solo viajan los números del
`Progreso`, nunca la traza de cálculo.

## Dominio puro

`lib/traza/proyeccion.ts` expone exactamente dos funciones:

```ts
prepararTraza(geojson): TrazaPreparada      // km acumulados por vértice, una vez
calcularProgreso(historico, traza): Progreso
```

La traza entra como parámetro — nunca se lee desde dentro. Esto permite tests
con trazas sintéticas de 3 puntos y evita recalcular distancias acumuladas
en cada petición.

## Invariantes de sesión

- Solo puede haber un `Intento` con `cerrado = false` a la vez **por reto** (índice
  único `intentos_abierto_por_reto`, migración 0009). Toda búsqueda del intento
  activo pasa por `soloIntentoActivoDelReto` (`lib/supabase/intentos.ts`), que
  filtra por `reto_id`; nunca `.eq("cerrado", false)` a secas (FP2.5, DT-028).
- Toda lectura/escritura del panel admin, la web pública y sus APIs queda acotada
  al reto del slug: tablas con `reto_id` se filtran por él; `posiciones` y
  `minuto_a_minuto` por el intento activo del reto. Las cachés en memoria
  (`lib/progreso-cache.ts`, `lib/historico-cache.ts`) van por `reto_id`.
- `/api/track` recibe el reto en la URL (`?reto=<slug>`); sin reto válido no guarda nada.
- La sesión de admin (`admin_session`) está ligada a UN reto: firma `{r: retoId, s: slug,
  v: huella de su password_hash, exp}` (DT-029). `proxy.ts` solo comprueba firma, caducidad
  y slug (sin BD); la página del panel y CADA Server Action verifican además `r` y `v` contra
  BD con `resolverRetoConSesion` (`lib/auth/sesion-admin-servidor.ts`). Cambiar la contraseña
  de un reto invalida sus sesiones abiertas. La contraseña se guarda solo como hash scrypt en
  `retos_admin` (tabla sin políticas RLS: solo service role).
- Las posiciones con `descartado = true` no participan en ningún cálculo.
- La `Fase` del intento activo determina qué muestra la web pública.
- Las intenciones son siempre privadas: ninguna política RLS de anon las alcanza.
- La configuración de la web de cada reto (secciones y respuestas de visitantes, FP3c/DT-032)
  se lee siempre con `configDelReto` (`lib/retos/config.ts`). Una sección apagada no se
  renderiza en ninguna fase ni modo y su API pública responde 403; los comentarios lo
  imponen también en la RLS de INSERT (0012).
- La web pública y la vista previa del admin (`/<slug>/admin/vista-previa`, DT-034) se componen
  siempre con `components/publico/WebReto.tsx`; no se compone la web en ningún otro sitio. En la
  vista previa (`vistaPrevia`) ningún formulario envía, no hay polling hacia `/api/*` y no se monta
  `RefrescoAlCambiarFase`.
- El `TRACK_TOKEN` solo sale del servidor hacia el panel superadmin, que verifica la sesión en la
  propia página antes de leerlo (DT-034). Nunca en el admin de un reto.
- El `modo` de un intento (`'guiado' | 'libre'`, DT-016) se fija en `iniciarReto()`
  (transición `antes` → `durante`) y es inmutable durante toda su vida — cambiarlo
  exige "Reiniciar" (que abre un intento nuevo). `destino_lat`/`destino_lon` solo
  se rellenan en modo libre; en modo guiado quedan siempre `null`.

## Variables de entorno requeridas (F2+)

Ver `docs/tecnico/plan-ejecucion-v1.md` para la lista completa:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `TRACK_TOKEN`, `ADMIN_SESSION_SECRET`,
`SUPERADMIN_PASSWORD`, `NEXT_PUBLIC_MAPTILER_KEY`.

**`ADMIN_PASSWORD` está obsoleta desde FP2.6 (DT-029):** ningún código la lee. Cada reto
tiene su propia contraseña de admin, que fija el superadmin (hash scrypt en `retos_admin`).
Se puede borrar de Vercel una vez desplegado FP2.6 y fijadas las contraseñas de los retos.
