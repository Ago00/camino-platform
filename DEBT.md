# Deuda técnica

---

## ~~Recordatorio: aplicar `supabase/migrations/0017_monigote.sql` contra producción ANTES de desplegar DT-036~~ — RESUELTO

Aplicada por el orquestador el 2026-10-01 (`santi-ago` y `prueba` a `atleti`, `saco-walkers` a `null`).

**Fecha:** 2026-10-01
**Contexto:** Monigote elegible por reto (DT-036). La migración está escrita; la aplica el orquestador.
**Problema:** Sin las columnas `monigote`, `monigote_grito` y `monigote_sonido`, la web sigue funcionando (`monigoteDelReto` cae a `peregrino_animado`: encendido ⇒ "atleti"), pero "Guardar configuración" falla en todos los retos porque el `update` envía las columnas nuevas.
**Impacto:** Medio mientras no se aplique: ningún admin puede guardar la configuración de su web.
**Solución propuesta:** Aplicar `0017` y verificar: `select slug, peregrino_animado, monigote, monigote_grito, monigote_sonido from retos;` ⇒ `monigote = 'atleti'` exactamente donde `peregrino_animado` es `true`, `monigote_sonido = true` en todos; y que `update retos set monigote = 'X1' where false;` falla por el check de formato.
**Prioridad:** Alta

---

## ~~Grito de los monigotes: Fraunces cursiva sintetizada (no la cursiva real del catálogo)~~ — RESUELTO antes del commit de DT-036

**Fecha:** 2026-10-01
**Contexto:** Revisión de DT-036. El catálogo cargaba Fraunces con `ital` 0 y 1; `app/layout.tsx` carga `Fraunces({ subsets: ["latin"], variable })` sin `style`, es decir, solo la redonda.
**Problema:** Los gritos con `italica: true` (atleti, peregrino, pulpo, meiga, gaiteiro, gallego, caracol, tarta, tortilla…) salen en oblicua falsa del navegador, no con los glifos de la cursiva de Fraunces que aprobó el usuario.
**Impacto:** Bajo-medio: diferencia visible respecto al catálogo en el elemento más llamativo (el grito a pantalla completa).
**Solución propuesta:** `Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces" })` y comprobar el peso añadido (un fichero de fuente más; valorar `preload` solo de la redonda). Alternativa: aceptar la oblicua tras compararlas a ojo con el usuario.
**Prioridad:** Media

---

## ~~`normalizarGritoMonigote` no quita los caracteres de anchura cero~~ — RESUELTO antes del commit de DT-036

**Fecha:** 2026-10-01
**Contexto:** Revisión de DT-036 (`lib/monigotes/grito.ts`). Se quitan controles C0/C1 y marcas bidi de incrustación/aislamiento.
**Problema:** U+200B (ZWSP), U+2060 (WJ) y U+200E/U+200F (LRM/RLM) sobreviven (no son `\s` en JS): un grito hecho solo de ellos se guarda como "personalizado" y el grito sale invisible.
**Impacto:** Bajo: solo lo puede provocar el propio admin.
**Solución propuesta:** Añadir `​‎‏⁠` a `CARACTERES_INVISIBLES` (respetando el ZWJ U+200D) con su caso en `grito.test.ts`.
**Prioridad:** Baja

---

## ~~Selector de monigote: con el formulario guardando, las flechas mueven el foco sin elegir~~ — RESUELTO antes del commit de DT-036

**Fecha:** 2026-10-01
**Contexto:** Revisión de DT-036 (`components/admin/SelectorMonigote.tsx`, `alPulsarTecla`).
**Problema:** Con `deshabilitado`, `elegir` no hace nada pero el foco sí salta a otra opción (con `tabIndex=-1`); el roving tabindex queda desincronizado durante el guardado.
**Impacto:** Muy bajo (ventana de un guardado).
**Solución propuesta:** `if (deshabilitado) return;` al principio de `alPulsarTecla`.
**Prioridad:** Baja

---

## Migración 0018: eliminar la columna obsoleta `retos.peregrino_animado`

**Fecha:** 2026-10-01
**Contexto:** DT-036 sustituye `peregrino_animado` por `monigote`. Se dejó la columna para que el código desplegado antes de `0017` siguiera funcionando, y `guardarConfiguracion` la mantiene sincronizada (`monigote !== null`).
**Problema:** Columna muerta en `retos`; `Reto.peregrino_animado`, la red de `monigoteDelReto` y la escritura en `guardarConfiguracion` existen solo por compatibilidad.
**Impacto:** Bajo: confusión y una escritura de más por guardado.
**Solución propuesta:** Cuando `0017` esté aplicada y el código de DT-036 desplegado: `0018` con `alter table public.retos drop column peregrino_animado;` y, en el mismo cambio, quitar `peregrino_animado` de `lib/types.ts`, `lib/supabase/admin.ts`, del `update` de `guardarConfiguracion`, de la red de `monigoteDelReto` (columna `monigote` ausente ⇒ ninguno) y de los fixtures de tests.
**Prioridad:** Baja

---

## El motor de los monigotes no tiene tests de DOM

**Fecha:** 2026-10-01
**Contexto:** DT-036. El proyecto no tiene entorno DOM en Vitest (`environment: "node"`); el motor (`components/monigotes/motor.ts`) es DOM imperativo (rAF, Web Animations, matchMedia, IntersectionObserver en el selector).
**Problema:** Lo cubierto por tests es el catálogo, las reglas del grito, la lectura/escritura y el montaje condicional en `WebReto`. La limpieza de `destruir()` (rAF, temporizadores de pose/arrebato/hipo, marcas, grito, listeners de `visibilitychange` y de la media query), el movimiento reducido y el contador de km se verificaron solo a mano en Chrome headless.
**Impacto:** Bajo-medio: una regresión en la limpieza (p. ej. un temporizador que sobrevive al desmontar) no la detecta ninguna gate; en una web abierta 30 h acumularía nodos o timers.
**Solución propuesta:** Añadir `happy-dom` (o `jsdom`) solo para `components/monigotes/*.test.ts` (`// @vitest-environment happy-dom`) con tests de `crearSuelto` → `destruir()` que comprueben capas vacías y que no quedan temporizadores (`vi.useFakeTimers` + `vi.getTimerCount()`), y de `montarTarjeta` → `probar()`/`destruir()`.
**Prioridad:** Baja

---

## Recordatorio: aplicar `supabase/migrations/0016_retos_gps.sql` contra producción ANTES de desplegar DT-035

**Fecha:** 2026-10-01
**Contexto:** Token de GPS por reto (DT-035). La migración está escrita; la aplica el orquestador.
**Problema:** El código de DT-035 ya no lee `TRACK_TOKEN`: `/api/track` busca el token en `retos_gps`. Si se despliega sin la tabla, todos los envíos del GPS reciben 401 y el panel muestra "Sin token GPS" (y "Generar" falla).
**Impacto:** Alto mientras no se aplique: pérdida total de posiciones GPS.
**Estado 2026-10-01:** paso (1) HECHO — `0016` aplicada y verificada en producción (todos los retos con token de 32 caracteres base64url, anon sin SELECT, RLS activada). Quedan (2)–(4).
**Solución propuesta:** Orden obligatorio: (1) aplicar `0016` y verificar `select reto_id, length(track_token), updated_at from retos_gps;` (una fila por reto, longitud 32); (2) desplegar; (3) reconfigurar el móvil de cada reto con el QR (ver "Reconfigurar OwnTracks…"); (4) borrar `TRACK_TOKEN` de Vercel.
**Prioridad:** Alta.

---

## ~~`ConfigGps`: el aviso tras regenerar remite a un QR que está oculto~~ — RESUELTO (tras regenerar el QR nuevo queda visible)

**Fecha:** 2026-10-01
**Contexto:** DT-035, revisión. `components/gps/ConfigGps.tsx` vuelve a ocultar URL y QR tras regenerar (`setVisible(false)`, l. 57).
**Problema:** El aviso dice "Vuelve a configurar el móvil con el QR de abajo" (l. 71), pero debajo solo aparece "Pulsa «Mostrar» para ver el QR".
**Impacto:** Muy bajo: confusión momentánea.
**Solución propuesta:** Cambiar el texto a "…con el nuevo QR (pulsa «Mostrar»)." o mantener `visible` tras regenerar.
**Prioridad:** Baja.

---

## `ConfigGps` sin test de interacción

**Fecha:** 2026-10-01
**Contexto:** DT-035. El proyecto no tiene entorno DOM en los tests.
**Problema:** Están probados la preparación de datos (URL, enlace, QR), las acciones y que sin sesión no se lee el token, pero nada comprueba en un DOM que `ConfigGps` oculte URL/QR/enlace hasta "Mostrar", que "Regenerar" pida confirmación y vuelva a ocultar, ni el fallback de "Copiar" sin portapapeles.
**Impacto:** Bajo: una regresión solo se vería en el navegador.
**Solución propuesta:** Con jsdom + Testing Library (ya recomendado en otras entradas). Mientras tanto, verificación manual en la preview (incluido escanear el QR con OwnTracks).
**Prioridad:** Baja.

---

## Muro en vivo y parada por 403: el cableado de los polls no tiene test de interacción

**Fecha:** 2026-09-30
**Contexto:** Lote de pendientes pre-reto (muro en vivo, sección apagada en caliente). El proyecto no tiene entorno DOM en los tests.
**Problema:** La fusión (`lib/comentarios/muro-en-vivo.ts`) y la regla del 403 (`esRespuestaDeSeccionApagada`) están probadas como funciones puras, pero nada comprueba que `MuroComentarios` pare el intervalo con la pestaña oculta y lo reanude al volver, que no sondee en la vista previa, que el formulario de respuesta abierto sobreviva a un poll, ni que el 403 pare el poll del muro o del minuto a minuto y llame a `router.refresh()` una sola vez. Tampoco el movimiento de foco de `RespuestaForm` al cambiar de destinatario.
**Impacto:** Bajo-medio: una regresión en el cableado (p. ej. dependencias del efecto) solo se vería en el navegador.
**Solución propuesta:** Con jsdom + Testing Library (ya recomendado en otras entradas), tests con temporizadores falsos que simulen `visibilitychange`, respuestas 200/403 de `fetch` y un `useRouter` doble. Mientras tanto, verificación manual en la preview.
**Prioridad:** Baja.

---

## ~~Muro: el 403 solo se atiende en el poll, no en la carga inicial ni en la recarga tras publicar~~ — RESUELTO (refrescarPaginaCero atiende el 403)

**Fecha:** 2026-09-30
**Contexto:** Revisión del lote pre-reto (muro en vivo). `MuroComentarios` usa `refrescarPaginaCero` en tres sitios (carga inicial, `recargar()` tras publicar y el poll) pero solo `sondear()` pasa el estado a `useRefrescoSiSeccionApagada`.
**Problema:** Si el admin apaga los comentarios entre el render del servidor y la hidratación, o justo antes de que el visitante publique, la carga inicial / recarga recibe 403 y se ignora: el muro queda vacío (o sin cambios) hasta el siguiente tick del poll (hasta 60 s) o indefinidamente si la pestaña está oculta.
**Impacto:** Muy bajo: ventana de carrera pequeña, sin datos erróneos, solo una sección vacía un rato.
**Solución propuesta:** Pasar el `status` de la carga inicial y de `recargar()` por `pararSiSeccionApagada` (p. ej. mover la llamada dentro de `refrescarPaginaCero`, que ya es el camino común) y marcar el poll como parado.
**Prioridad:** Baja.

---

## ~~El poll del minuto a minuto sigue corriendo con la pestaña oculta~~ — RESUELTO (el tick no consulta con la pestaña oculta)

**Fecha:** 2026-09-30
**Contexto:** Al añadir el poll del muro (60 s, pausado con la pestaña oculta) se mantuvo sin cambios el del minuto a minuto (30 s, siempre activo), que quedaba fuera del alcance.
**Problema:** Una pestaña en segundo plano sigue pidiendo `/<slug>/api/minuto-a-minuto` cada 30 s (y `RefrescoAlCambiarFase` y el progreso también sondean). Los dos polls de la web siguen criterios distintos.
**Impacto:** Bajo: peticiones baratas, pero consumen cupo de rate limit por IP y batería en móvil.
**Solución propuesta:** Extraer el patrón de visibilidad del muro a un hook (`useIntervaloConPestanaVisible`) y usarlo en el minuto a minuto (y valorar en progreso y fase).
**Prioridad:** Baja.

---

## ~~Las llamadas de la web a `/<slug>/api/*` se registran como visitas en "Tráfico"~~ — RESUELTO (proxy.ts ignora /:slug/api/*, con tests)

**Fecha:** 2026-09-30
**Contexto:** Detectado en la revisión de DT-034 (vista previa) al comprobar que la vista previa no registra visitas. Es previo a esa tarea.
**Problema:** El `matcher` de `proxy.ts` (`/((?!api|_next/static|…).*)`) solo excluye rutas que *empiezan* por `/api`. `/<slug>/api/progreso`, `/<slug>/api/fase`, `/<slug>/api/minuto-a-minuto`, `/<slug>/api/comentarios`… empiezan por el slug, pasan por `proxyPublico` y cada una inserta una fila en `visitas_web`. Con la web abierta en "durante", cada visitante suma varias "visitas" cada 30 s (polling de progreso, fase y minuto a minuto). La vista previa del admin también genera filas por sus lecturas GET (muro, primera página del minuto a minuto), aunque su propia página (`/<slug>/admin/vista-previa`) no cuente.
**Impacto:** Alto para la pestaña "Tráfico" durante el reto: visitas totales y desglose "Por página" inflados por el polling; además, un insert en BD por cada petición de API.
**Solución propuesta:** En `proxy.ts`, pasar de largo (sin `registrarVisita`) cuando el segundo segmento sea `api` (`/^\/[^/]+\/api(\/|$)/`), con test en `proxy.test.ts`. Valorar limpiar las filas existentes con `ruta like '/%/api/%'`.
**Prioridad:** Alta.

---

## ~~Recordatorio: aplicar `supabase/migrations/0015_peregrino_animado.sql` contra producción~~ — RESUELTO

Aplicada por el orquestador el 2026-09-30 (`santi-ago` a `true`, el resto a `false`).

**Fecha:** 2026-09-30
**Contexto:** Vista previa, peregrino, Instagram y URL del GPS (DT-034). La migración está escrita; la aplica el orquestador.
**Problema:** Hasta aplicarla, `retos.peregrino_animado` no existe: `configDelReto` lo trata como encendido (el peregrino sigue en todas las webs, como antes) y guardar la configuración desde el panel falla (el `update` envía la columna).
**Impacto:** Medio mientras no se aplique: el admin no puede guardar la pestaña Configuración.
**Solución propuesta:** Aplicar `0015` y verificar: `select slug, peregrino_animado from retos;` ⇒ `santi-ago` a `true`, el resto a `false`; `column_default` de la columna `false`, `is_nullable` `NO`.
**Prioridad:** Alta.

---

## La web ignora el texto editable `mensaje_llegada_default`

**Fecha:** 2026-09-30
**Contexto:** Detectado al mover la composición de la web a `components/publico/WebReto.tsx` (DT-034). No se tocó para no cambiar comportamiento en esa tarea.
**Problema:** Si el intento no tiene `mensaje_llegada`, `WebReto.tsx` (y `SeccionActividad.tsx` para el valor inicial del modal "Finalizar") usan `TEXTOS_POR_DEFECTO.mensaje_llegada_default`, no el valor editado en la pestaña Textos. La clave aparece en Textos pero editarla no cambia nada.
**Impacto:** Bajo: en la práctica el modal "Finalizar" siempre guarda un mensaje, así que el default casi nunca se ve. Confunde al admin que lo edita.
**Solución propuesta:** Pasar `textos.mensaje_llegada_default` en vez de la constante (en WebReto y en SeccionActividad), o quitar la clave de la pestaña Textos si no se quiere editable.
**Prioridad:** Baja.

---

## Vista previa: el bloqueo de los formularios no tiene test de interacción

**Fecha:** 2026-09-30
**Contexto:** DT-034. El proyecto no tiene entorno DOM en los tests (solo `node`).
**Problema:** Que un formulario en la vista previa no haga `fetch` se garantiza con la regla pura `envioPermitido` (probada) y se comprueba con `renderToString` que cada formulario lee el contexto (aviso visible). No hay ningún test que pulse el botón con el formulario relleno y verifique que no hay petición.
**Impacto:** Bajo: el cableado es de una línea por formulario y usa la misma función que el `disabled`.
**Solución propuesta:** Si se añade jsdom + Testing Library (ya recomendado en otras entradas), un test por formulario que rellene, pulse y compruebe que `fetch` no se llama.
**Prioridad:** Baja.

---

## Recomendaciones de la revisión de DT-034 (vista previa, peregrino, Instagram, URL del GPS)

**Fecha:** 2026-09-30
**Contexto:** Revisión del lote DT-034.
**Problema:**
(1) Ningún test protege que `WebReto` no monte `RefrescoAlCambiarFase` con `vistaPrevia` (si se monta, el iframe se recarga en bucle al previsualizar una fase distinta de la real) ni que `PeregrinoLibre` dependa de `config.peregrino_animado`. Tampoco que `FaseConDatosEjemplo` pase `SIN_ENTRADAS` con el minuto a minuto apagado.
(2) `lib/retos/instagram.ts`: `instagram.com` o `www.instagram.com` a secas (sin usuario) pasan como usuario (el patrón admite puntos) y se guardan como `https://instagram.com/instagram.com`. Tampoco se aplican las reglas reales de Instagram (sin punto inicial/final ni dos puntos seguidos) ni se acepta `m.instagram.com`.
(3) `esUrlPerfilInstagram` exige esquema: si el valor guardado de `santi-ago` en `textos.cierre_antes_instagram_url` no lo lleva (o no es un perfil), el enlace desaparece de su web tras desplegar.
(4) Los km de los datos de ejemplo del modo guiado salen de la traza de PINTADO (acortada por DP), así que el mojón de ejemplo no cuadra con la longitud real de la ruta.
**Impacto:** Bajo, salvo (3), que cambia la web de `santi-ago` si el valor no es válido.
**Actualización 2026-10-01 (DT-036):** de (1) ya hay test (`components/publico/WebReto.test.ts`, recorriendo el árbol de elementos con dobles): la vista previa no monta `RefrescoAlCambiarFase` y `MonigoteWeb` (que sustituye a `PeregrinoLibre`) solo se monta con monigote. Falta el caso de `FaseConDatosEjemplo` con el minuto a minuto apagado.
**Actualización 2026-09-30:** de (2) ya se rechaza el dominio a secas (`instagram.com`, `www.`/`m.`) y se acepta `m.instagram.com/usuario`; siguen sin aplicarse las reglas de puntos (inicial/final, `..`).
**Solución propuesta:** (1) Test con `renderToString` de `WebReto` en "antes" con `RefrescoAlCambiarFase`/`PeregrinoLibre` sustituidos por dobles. (2) Rechazar usuarios con punto inicial/final, `..` o que terminen en un dominio (`.com`), y admitir `m.`. (3) Antes de desplegar: `select valor from textos where clave = 'cierre_antes_instagram_url';` y, si no pasa, volver a guardarlo desde Configuración. (4) Si molesta, escalar con la longitud del catálogo de rutas.
**Prioridad:** Media para (3) (comprobar antes de desplegar); Baja el resto.

---

## `vitest` 3.x con avisos moderados (GHSA-82fw-gwwq-j7x9)

**Fecha:** 2026-09-30
**Contexto:** `pnpm audit` reporta `vitest` y `@vitest/mocker` < 4.1.11 (moderado). Los avisos altos de `brace-expansion` 4.x/5.x (vía `minimatch` en eslint y coverage) se cerraron con un override acotado en `pnpm-workspace.yaml` (`"brace-expansion@>=4.0.0 <5.0.12": "^5.0.12"`).
**Problema:** El arreglo de vitest exige subir de major (3 → 4).
**Impacto:** Solo herramientas de desarrollo; nada llega a producción.
**Solución propuesta:** Subir `vitest` y `@vitest/coverage-v8` a ≥ 4.1.11 revisando la guía de migración y ejecutando la suite completa.
**Prioridad:** Baja.

---

## Recomendaciones de la revisión del lote pre-reto (superadmin, comentarios admin, respuestas y acordeón)

**Fecha:** 2026-09-30
**Contexto:** Revisión conjunta de: endurecimiento pre-reto (DT-033), superadmin con `useActionState`, sub-pestañas de comentarios del admin y "Responder" bajo cada respuesta + acordeón del minuto a minuto.
**Problema:**
(1) `components/publico/RespuestaForm.tsx`: (el `autoFocus` ya va al campo "nombre"; queda lo siguiente) al cambiar de destinatario con el formulario ya abierto, el foco no se mueve y el cambio de "Respondiendo a …" no se anuncia. El `<p>` "Respondiendo a …" tampoco está asociado al campo.
(2) `components/publico/HiloComentario.tsx:62`: con las respuestas desplegadas, la raíz no tiene "Responder". Para contestar al autor del comentario principal hay que pulsar bajo una respuesta, y el formulario dice "Respondiendo a <autor de la respuesta>". Además, la respuesta publicada no guarda a quién se contestaba: el "Respondiendo a" solo existe en la interfaz.
(3) `components/publico/MinutoAMinuto.tsx`: (el texto `sr-only` Mostrar/Ocultar ya se quitó; queda esto) la cabecera del acordeón no está dentro de un encabezado (patrón acordeón de la APG).
(4) `app/[slug]/admin/page.tsx:55` y `components/admin/SeccionComentarios.tsx:35`: el filtro se normaliza dos veces (inocuo, pero el prop podría tiparse ya como `FiltroComentario`).
(5) `components/admin/ComposerMinutoAMinuto.tsx:112`: `crypto.randomUUID()` solo existe en contextos seguros; si se abre el panel por HTTP en la LAN (pruebas desde el móvil con `pnpm dev`), el envío lanza.
(6) Las Server Actions `ocultarComentario`/`mostrarComentario` siguen aceptando comentarios privados (la interfaz ya no lo ofrece). Es inocuo, pero no coincide con la regla "privados: solo eliminar".
(7) Sin tests de componente para los formularios del superadmin, `HiloComentario` ni el acordeón. La lógica está en funciones puras testeadas; el cableado depende de la verificación manual.
**Impacto:** Bajo: UX/a11y menores y coherencia.
**Solución propuesta:** (1) Mover el foco al formulario en cada cambio de destinatario y enlazar el `<p>` con `aria-describedby`. (2) Confirmar con Producto. Si se quiere contestar a la raíz con respuestas visibles, mostrar también su botón. (3) Envolver el botón en un `<h3>`. (4) Tipar el prop. (5) Si se necesita, usar un fallback con `crypto.getRandomValues`. (6) Rechazar en la action si `visibilidad = 'privado'`. (7) Valorar tests con Testing Library si se añade jsdom.
**Resuelto el 2026-09-30:** (1) `aria-describedby` + `aria-live` en "Respondiendo a …" y foco al nombre (vacío) o al texto al cambiar de destinatario; (5) `generarUuidV4` en `lib/envio/uuid.ts`; (6) `ocultarComentario`/`mostrarComentario` filtran `visibilidad = 'publico'` y fallan con "No se puede ocultar/mostrar un mensaje privado." Quedan (2), (3), (4) y (7).
**Prioridad:** Baja.

---

## ~~El muro no se actualiza con comentarios de otros visitantes~~ — RESUELTO

Resuelto el 2026-09-30: poll de la página 0 cada 60 s solo con la pestaña visible, fusión pura por id en `lib/comentarios/muro-en-vivo.ts` (con tests), sin poll en la vista previa y parada + `router.refresh()` ante 403 (nota de DT-030).

**Fecha:** 2026-09-30
**Contexto:** Endurecimiento pre-reto. Se resolvió que quien publica vea su comentario (recarga de la página 0 al enviar) sin añadir polling, por decisión del orquestador.
**Problema:** Los comentarios y respuestas de otros visitantes no aparecen en `MuroComentarios` hasta recargar la página.
**Impacto:** Bajo-medio durante el reto: el muro parece menos vivo que el minuto a minuto.
**Solución propuesta:** Un poll ligero de la página 0 (patrón de `MinutoAMinuto.tsx`, solo con la pestaña visible), fusionando por `id` sin perder las páginas ya cargadas.
**Prioridad:** Baja.

---

## ~~Visitante con la web abierta sigue haciendo polling del minuto a minuto tras apagarlo (FP3c)~~ — RESUELTO

Resuelto el 2026-09-30: el poll del minuto a minuto (y el nuevo del muro) para al recibir 403 y hace `router.refresh()` una vez (`useRefrescoSiSeccionApagada`, notas de DT-031/DT-032). Enviar un comentario con la sección recién apagada sigue mostrando el error genérico hasta ese refresco.

**Fecha:** 2026-09-30
**Contexto:** Recomendación del Reviewer en FP3c (DT-032). `components/publico/MinutoAMinuto.tsx` (líneas ~83 y ~113) ignora cualquier respuesta no `ok`; `RefrescoAlCambiarFase` solo refresca al cambiar de fase.
**Problema:** Si el admin apaga el minuto a minuto (o los comentarios) durante el reto, quien ya tenía la página abierta sigue viendo la sección y el componente sigue pidiendo `/api/minuto-a-minuto` cada intervalo, recibiendo 403 en silencio hasta que recarga. Enviar un comentario/respuesta en ese estado muestra el error genérico.
**Impacto:** Bajo: peticiones 403 baratas (sin consulta a BD más allá del reto) y una sección "fantasma" hasta recargar.
**Solución propuesta:** En `MinutoAMinuto`, parar el intervalo al recibir 403; opcionalmente hacer `router.refresh()` para que la página deje de pintar la sección apagada.
**Prioridad:** Baja.

---

## Secciones apagadas siguen siendo legibles por PostgREST directo (FP3c)

**Fecha:** 2026-09-30
**Contexto:** FP3c (DT-032) apaga secciones en la web y en la API, y en la RLS de INSERT de `comentarios`, pero no toca las políticas SELECT de `anon`.
**Problema:** Con `seccion_comentarios` o `seccion_minuto_a_minuto` apagadas, los comentarios públicos y las entradas del intento activo siguen siendo legibles con la anon key llamando directamente a PostgREST.
**Impacto:** Bajo: es contenido que ya era público; "apagar" se entendió como dejar de mostrarlo, no como hacerlo privado. Si en el futuro "apagar" debe significar "ocultar de verdad", no basta.
**Solución propuesta:** Añadir a las políticas SELECT de `comentarios` y `minuto_a_minuto` una función security definer análoga a `comentarios_insert_permitido` que compruebe el interruptor del reto.
**Prioridad:** Baja.

---

## ~~"Minuto a minuto" plegable: botón y aviso sin contexto para lector de pantalla (FP3b)~~ — RESUELTO

**Fecha:** 2026-09-30 → Resuelto 2026-09-30 (cabecera en acordeón)
Toda la cabecera es el botón (`aria-expanded`/`aria-controls`): su nombre accesible incluye el kicker "Minuto a minuto" y el aviso `aria-live` va prefijado con él.

---

## `MinutoAMinuto.tsx`: respuestas de la API sin validar (el `catch` de `cargarPagina` ya está)

**Fecha:** 2026-09-30
**Contexto:** Detectado por el Reviewer en FP3b (código previo, no introducido en la tarea).
**Problema:** `cargarPagina` tiene `try/finally` sin `catch`: un fallo de red en la carga inicial (`void cargarPagina(0)`) o en "Cargar más" produce un unhandled rejection. Además, las respuestas de `fetch` se tipan con anotación (`const data: RespuestaFeed = await response.json()`) sin validar con Zod.
**Impacto:** Ruido en consola/monitorización ante fallos de red; si la forma de la API cambia, el error aparece lejos del origen.
**Solución propuesta:** Añadir `catch` silencioso como en el poll, y un esquema Zod compartido para `RespuestaFeed` usado en carga y poll.
**Prioridad:** Baja.

---

## `intenciones` probablemente permite fijar `created_at` vía PostgREST

**Fecha:** 2026-09-30
**Contexto:** En FP3a, Seguridad detectó que la anon key permitía insertar `comentarios` con `created_at` arbitrario (anclar arriba del muro); se cerró en 0011 con GRANT de INSERT por columnas. `intenciones` sigue el mismo patrón de 0007 y no se revisó.
**Problema:** Un POST directo a PostgREST podría fijar `created_at` de una intención y alterar su orden.
**Impacto:** Bajo (orden de la lista).
**Solución propuesta:** Mismo patrón: `revoke insert on intenciones from anon, authenticated; grant insert (<columnas que envía la API>) on intenciones to anon;` y verificar como anon.
**Prioridad:** Baja.

---

## ~~El muro no muestra un comentario raíz nuevo hasta recargar~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-30 (endurecimiento pre-reto)
`ComentariosConMuro.tsx` cablea `onEnviado` de `ComentarioForm`: tras enviar un comentario público, el muro recarga su página 0 (handle imperativo, sin efecto ni polling). Los de otros visitantes siguen apareciendo al recargar; el poll ligero queda como entrada aparte ("El muro no se actualiza con comentarios de otros visitantes").

---

## `GET /[slug]/api/comentarios` no acota las respuestas por hilo

**Fecha:** 2026-09-29
**Contexto:** FP3a (DT-030): "sin límite de respuestas por hilo". La consulta de respuestas trae todas las de las (hasta 20) raíces de la página en una sola petición.
**Problema:** PostgREST corta a 1000 filas por petición sin avisar: una página con más de 1000 respuestas en total perdería las más recientes en silencio.
**Impacto:** Nulo con el volumen esperado (decenas de respuestas); relevante solo si un hilo se hace viral.
**Solución propuesta:** Si llega a pasar, paginar respuestas por hilo (p. ej. las últimas N con un "ver anteriores") o detectar la página llena y avisar.
**Prioridad:** Baja.

---

## Recomendaciones de la revisión de FP3a (respuestas en hilo)

**Fecha:** 2026-09-29
**Contexto:** Revisión de FP3a (DT-030).
**Problema:** (1) `components/publico/MuroComentarios.tsx:27-38`: si el GET falla (`!response.ok`) o la red lanza, el muro no muestra ningún estado de error, y el rechazo del `void cargarPagina(0)` queda sin manejar (anterior a FP3a, más visible ahora que el GET depende de `es_autor`). (2) Offset sobre raíces: si entra una raíz nueva entre dos páginas, la siguiente repite el último hilo y aparece una `key` duplicada en `hilos.map` (anterior a FP3a). (3) `components/publico/HiloComentario.tsx:56,66`: con el hilo plegado, `aria-controls` apunta a un id que no está en el DOM (la `<ul>` no se renderiza). (4) `RespuestaForm.tsx:93` y `MuroComentarios.tsx:68`: "Enviando…"/"Cargando…" en código y no en `textos` (patrón heredado). (5) `lib/comentarios/hilos.ts` `agruparHilosAdmin`: con filtro "Públicos", las respuestas visibles de una raíz oculta aparecen como públicas aunque en la web estén ocultas con su hilo (la raíz sí sale como contexto "oculto (con todo su hilo)"). (6) `FiltroComentarios` recibe `slug` por prop mientras `TabsAdmin`/`EnlacePaginacion` usan `usePathname`: dos patrones para lo mismo.
**Impacto:** Bajo: UX ante fallos, un caso raro de duplicado, a11y menor, coherencia.
**Solución propuesta:** (1) Estado `error` en el muro con `mensaje_error_generico` y `catch` en `cargarPagina` (el `catch` ya está desde el muro en vivo, 2026-09-30: sin rechazos sin manejar; falta el estado de error visible). (2) y (3) resueltos antes del commit de FP3a (deduplicación por `id` al concatenar páginas; `<ul hidden>`). (4) Claves de texto al tocar esos componentes. (5) Resuelto el 2026-09-30: con las sub-pestañas Públicos/Privados/Ocultos, un hilo con la raíz oculta ya no aparece en "Públicos" (va entero a "Ocultos"). (6) Unificar en `usePathname`.
**Prioridad:** Baja.

---

## Recomendaciones de la revisión de FP2.6 (contraseña de admin por reto)

**Fecha:** 2026-09-29
**Contexto:** Revisión de FP2.6 (DT-029).
**Problema:** (1) `app/[slug]/admin/actions.ts:47-57`: el JSDoc de `requerirSesion` quedó separado de su función (encima del JSDoc de `MENSAJE_SESION_CADUCADA`), dos bloques `/** */` seguidos. (2) `finalizarReto` no tiene test propio del camino "sesión de otro reto / contraseña cambiada → mensaje de sesión caducada sin subir foto ni escribir" (solo lo tiene `crearMinutoAMinuto`); comparten helper, pero es la acción que sube foto antes de escribir.
**Impacto:** Bajo: legibilidad y cobertura de un camino ya protegido por el mismo helper.
**Solución propuesta:** (1) Mover el JSDoc de `requerirSesion` justo encima de la función. (2) Añadir a `actions.test.ts` un caso de `finalizarReto(RETO_B.slug, formData con foto)` que compruebe `{ok:false}` y que no se llama a `subirFotoLlegada` ni hay escrituras.
**Prioridad:** Baja.

---

## Contraseñas de admin de los retos existentes por fijar

**Fecha:** 2026-09-29
**Contexto:** FP2.6 (DT-029). El login de admin lee el hash de `retos_admin`; `ADMIN_PASSWORD` ya no se usa. La migración `0010` está aplicada y verificada (RLS activa, sin políticas, anon/authenticated sin SELECT).
**Problema:** Hasta fijar la contraseña de cada reto existente, su panel `/<slug>/admin` responde 401 al login.
**Impacto:** Falla cerrado (sin riesgo de seguridad), pero bloquea el panel del reto.
**Solución propuesta:** En `/superadmin` editar cada reto existente y fijar su contraseña; verificar "Contraseña admin: configurada" y entrar en `/<slug>/admin`. Después, borrar `ADMIN_PASSWORD` de Vercel.
**Prioridad:** Alta — operativa, obligatoria en el despliegue de FP2.6.

---

## ~~Mensajes de error de la contraseña de admin en el superadmin llegan redactados~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-30 (superadmin con `useActionState`)
Las acciones devuelven `ResultadoAccionSuperadmin`/`ResultadoCrearReto` (`app/superadmin/(panel)/resultado-accion.ts`) con el motivo, incluido "el reto se creó, pero no se pudo guardar la contraseña".

---

## `pnpm test` registra de forma intermitente "Timeout calling onTaskUpdate"

**Fecha:** 2026-09-29
**Contexto:** FP2.6. En una de dos ejecuciones completas, vitest informó 400/400 tests en verde pero 1 "Unhandled Error: [vitest-worker]: Timeout calling onTaskUpdate", y salió con código de error. La repetición salió limpia.
**Problema:** El RPC entre el worker y el proceso principal de vitest se bloquea cuando los tests intensivos en CPU (`proyeccion.ventana.test.ts`, benchmarks adversariales de ~6 s, y ahora los hashes scrypt de los tests de login) coinciden en el tiempo.
**Impacto:** Ejecuciones de la suite en rojo sin fallo real; puede confundir a CI o al Implementador.
**Solución propuesta:** Aislar los tests de benchmark en un proyecto de vitest aparte (o `poolOptions.threads.singleThread` para ellos), o subir `teardownTimeout`/limitar `maxWorkers`.
**Prioridad:** Baja.

---

## ~~Migración `0008_cascade_delete.sql` pendiente de aplicar en Supabase de producción~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto (verificado en BD por el orquestador el 2026-09-30)
Las FK dependientes tienen `ON DELETE CASCADE`; `eliminarReto` funciona con retos con datos.

---

## `listarTodosLosRetos` usa el cliente admin en vez del público (decisión técnica FP2)

**Fecha:** 2026-09-29
**Contexto:** FP2 — La spec de CURRENT.md indicaba "ambas usan cliente público" para `listarRetosActivos` y `listarTodosLosRetos`. Sin embargo, la política RLS de la tabla `retos` solo permite a anon ver retos con `activo = true`. `listarTodosLosRetos` necesita ver también los inactivos (para el panel superadmin). Se resolvió como bloqueo menor: usar el cliente admin para esta función.
**Problema:** No es un bug — es una decisión técnica necesaria. El riesgo es que si en el futuro se llama a `listarTodosLosRetos` desde un contexto público (sin auth previa del superadmin), expondría retos inactivos.
**Impacto:** Bajo en la práctica: `listarTodosLosRetos` solo se llama desde el Server Component del panel superadmin, que ya está protegido por el layout y el proxy.
**Solución propuesta:** Documentar explícitamente en el JSDoc de la función que es solo para uso autenticado. No hay cambio funcional pendiente.
**Prioridad:** Baja.

---

## ~~Panel superadmin: mensajes de error de server actions no llegan al usuario~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-30
`crearReto`/`editarReto`/`eliminarReto` devuelven un resultado con mensaje (sesión caducada incluida) y los formularios cliente (`FormularioCrearReto`, `FormularioEditarReto`, `BotonEliminarReto`) lo muestran con `useActionState`; editar y eliminar redirigen al panel con el aviso en la query (`?guardado=`/`?eliminado=`, validada en `leerAvisoPanel`).

---

## Reconfigurar OwnTracks con el QR del reto (token por reto, DT-035)

**Fecha:** 2026-09-29 (actualizada 2026-10-01)
**Contexto:** FP2.5 (DT-028) exigió el reto en la URL; DT-035 sustituye el `TRACK_TOKEN` global por un token propio de cada reto (`retos_gps`).
**Problema:** Un OwnTracks configurado con la URL antigua (`?t=<TRACK_TOKEN>`, con o sin `reto`) recibe 401 en cuanto se despliegue DT-035 y deja de guardar posiciones.
**Impacto:** Pérdida total de posiciones GPS del reto hasta reconfigurar el móvil.
**Solución propuesta:** Tras aplicar `0016` y desplegar: en OwnTracks, Ajustes → Remote Control → activar "Allow external configuration"; abrir la pestaña GPS del admin del reto (o su tarjeta en el superadmin), pulsar "Mostrar" y escanear el QR con la cámara (o "Abrir en OwnTracks" desde el propio móvil); mandar un punto y comprobarlo en la pestaña Posición. Después, borrar `TRACK_TOKEN` de Vercel.
**Prioridad:** Alta — operativa, obligatoria antes del próximo uso del GPS.

---

## `lib/rate-limit.ts` comparte el mismo `Map` de contadores entre retos

**Fecha:** 2026-09-29
**Contexto:** FP2.5 (DT-028). Las claves de rate limiting son la IP del cliente (APIs públicas) o el token (`/api/track`), sin componente de reto.
**Problema:** Un mismo visitante navegando dos retos consume un único cupo por minuto; y como `TRACK_TOKEN` es global, dos trackers de retos distintos comparten los 40 req/min de `/api/track`.
**Impacto:** Bajo y aceptado: los cupos (60 req/min por IP, 40 req/min por token) sobran para el uso real; solo afectaría con varios trackers de alta frecuencia a la vez.
**Solución propuesta:** Si llega a notarse, incluir el slug en la clave de `/api/track` (`${token}:${slug}`) o pasar a tokens por reto.
**Actualización 2026-10-01 (DT-035):** resuelta la parte de `/api/track`: token por reto y cupo propio por reto (`track:reto:<id>`, 40/min) más uno por IP (`track:ip:<ip>`, 120/min), con claves prefijadas. Sigue pendiente la de las APIs públicas: la clave es la IP a secas, compartida entre retos y entre rutas (un mismo visitante gasta el mismo cupo en `/<slug>/api/*` de cualquier reto y en el login del admin).
**Prioridad:** Baja.

---

## ~~`iniciarReto` permite modo "guiado" en un reto sin ruta~~ — RESUELTO

Resuelto el 2026-09-30: `modosDeInicioPermitidos` (`lib/retos/modo-inicio.ts`); `iniciarReto` rechaza "guiado" sin ruta y `ActividadAcciones` no lo ofrece (nota de DT-016, tests en `actions.test.ts`).

**Fecha:** 2026-09-29
**Contexto:** FP2.5 (DT-028). Un reto de ruta libre (`ruta_id` null) puede iniciarse en modo "guiado" desde el panel (es el default). FP2.5 lo trata en lectura como libre (progreso, web pública, mapa admin, filtro geográfico del tracker), pero no lo impide en la escritura.
**Problema:** El intento queda guardado como "guiado" y sin destino, así que la vista libre no muestra distancia restante.
**Impacto:** Bajo: solo cosmético en retos libres mal iniciados; no hay error ni mezcla de datos.
**Solución propuesta:** En `iniciarReto` (y en la UI de `ActividadAcciones`), exigir modo libre con destino cuando `reto.ruta_id` es null.
**Prioridad:** Baja.

---

## `app/[slug]/admin/actions.test.ts` no cubre todas las acciones aisladas por reto

**Fecha:** 2026-09-29
**Contexto:** Revisión de FP2.5 (DT-028). Los 8 tests cubren comentarios, intenciones, descartar posición, eliminar minuto a minuto y tráfico.
**Problema:** Sin test: `mostrarComentario`, `editarMinutoAMinuto`, `guardarTexto` (upsert con `reto_id`), las transiciones `iniciar/finalizar/retomar/reiniciarReto` (filtro por reto del intento activo) y que `descartarPosicion`/`reiniciarReto` limpien solo la caché del reto propio (y no la de otro reto).
**Impacto:** Bajo: el código es correcto hoy; el riesgo es una regresión futura sin red.
**Solución propuesta:** Añadir casos con el mismo builder falso; para cachés, sembrar entradas de dos retos y comprobar que solo desaparece la del slug.
**Prioridad:** Baja.

---

## ~~Comentario obsoleto en `lib/supabase/admin.ts:75-76`~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-30 (endurecimiento pre-reto)
Los comentarios de `intenciones.Insert` y `visitas_web.Insert` dicen ahora "reto_id requerido (NOT NULL); lo aporta el reto resuelto desde el slug".

---

## ~~`GET /[slug]/api/comentarios` no filtra por `reto_id`~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-29 (FP2.5, DT-028)
El GET ya resolvía el reto y filtraba por `reto_id` al revisar FP2.5; `GET /[slug]/api/minuto-a-minuto` deja además de depender de la RLS y filtra por el intento activo del reto.

---

## ~~`calcularProgresoActual()` y `datos-mapa-admin.ts` hardcodean `"portuguesa-110"`~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-29 (FP2.5, DT-028)
Ambas reciben el reto y usan `reto.ruta_id`; si es null, progreso/mapa en modo libre. También se eliminó el fallback `"portuguesa-110"` de `app/[slug]/page.tsx` y de `/api/track`.

---

## ~~Caché de progreso e histórico sin keying por reto~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-29 (FP2.5, DT-028)
`lib/progreso-cache.ts` y `lib/historico-cache.ts` son `Map<retoId, Entrada>`.

---

## ~~`resetearContadorTrafico` usa `.eq("id", 1)` hardcodeado~~ — RESUELTO

**Fecha:** 2026-09-29 → Resuelto 2026-09-29 (FP2.5, DT-028)
Upsert por `reto_id` (`onConflict: "reto_id"`); `SeccionTrafico` lee `config_trafico` por `reto_id`.

---

## `scripts/generar-perfil-elevacion.ts` lee de la ruta antigua del GeoJSON de pintado

**Fecha:** 2026-09-28
**Contexto:** FP0 — Reorganización de assets a `lib/rutas/<ruta_id>/`. El script `generar-perfil-elevacion.ts` (ejecutado una vez, output `lib/traza/perfil-elevacion.json` ya committeado) lee desde `lib/traza/traza-mapa.geojson` (línea 68), que ya no existe. Si alguien necesita regenerar el perfil de elevación tras una actualización de traza, el script fallará.
**Problema:** `lib/traza/traza-mapa.geojson` fue eliminado en FP0; el script no se actualizó porque no es una operación rutinaria.
**Impacto:** Bajo mientras el perfil committeado no necesite regenerarse. Si se actualiza la traza, el script fallará al ejecutarse.
**Solución propuesta:** Cambiar la línea 68 de `scripts/generar-perfil-elevacion.ts` para leer de `lib/rutas/portuguesa-110/traza-mapa.geojson`. En FP1, parametrizar el script por `ruta_id`.
**Prioridad:** Baja — solo bloquea regeneración futura del perfil.

---

## `docs/tecnico/arquitectura.md` — tabla "dos trazas" aún referencia rutas antiguas

**Fecha:** 2026-09-28
**Contexto:** FP0 — Reorganización de assets a `lib/rutas/<ruta_id>/`. La tabla de la sección "La regla no negociable de las dos trazas" en `arquitectura.md` (línea ~184) todavía muestra `lib/traza/traza.geojson` y `lib/traza/traza-mapa.geojson`.
**Problema:** Documentación desincronizada con el código real.
**Impacto:** Puramente documental. Un agente que lea arquitectura.md buscará los ficheros en el lugar incorrecto.
**Solución propuesta:** Actualizar la tabla para usar el patrón `lib/rutas/<ruta_id>/traza.geojson` / `traza-mapa.geojson` con nota de que el `ruta_id` activo es `portuguesa-110`.
**Prioridad:** Baja.

---

## ~~`intentos.Insert` y `config_trafico.Insert` en `BaseDeDatos` no exigen `reto_id`~~ — RESUELTO

**Fecha:** 2026-09-28 → Resuelto antes del 2026-09-30 (comprobado en el endurecimiento pre-reto)
Ambos `Insert` de `lib/supabase/admin.ts` son `Pick<…, "reto_id"> & Partial<…>`: `reto_id` es obligatorio en compilación.

---

## ~~Aplicar `supabase/migrations/0007_schema_plataforma.sql` contra el proyecto Supabase de producción~~ — RESUELTO

**Fecha:** 2026-09-28 → Resuelto (verificado en BD por el orquestador el 2026-09-30)
El schema de la plataforma está aplicado. El bucket de Storage que 0007 no creaba lo añade `0013_bucket_fotos.sql` (aplicada).

---

## ~~Endpoints de API todavía no filtran por `reto_id`~~ — RESUELTO en FP1

**Fecha:** 2026-09-28 → Resuelto 2026-09-29 (FP1, DT-026)
Todos los endpoints y server actions bajo `app/[slug]/` resuelven `reto_id` dinámicamente a partir del slug de la URL. Hardcoding de `reto_id: 1` eliminado.

---

## ~~Recordatorio: aplicar `supabase/migrations/0006_foto_llegada.sql` contra producción~~ — RESUELTO

**Fecha:** 2026-08-12 → Resuelto (verificado en BD por el orquestador el 2026-09-30)
La columna `intentos.foto_llegada_url` existe en el proyecto de la plataforma.

---

## Objeto huérfano en Storage al reemplazar la foto de llegada (DT-024)

**Fecha:** 2026-08-12
**Contexto:** Tarea "Modal Finalizar con preview real y foto de llegada opcional" (DT-024). Cuando se adjunta una foto nueva en una finalización posterior a otra que ya tenía foto, `finalizarReto` sube la nueva y sobrescribe `foto_llegada_url` — el objeto anterior en el bucket `minuto-a-minuto` no se borra.
**Problema:** El objeto viejo queda en Storage sin ninguna fila que lo referencie.
**Impacto:** Bajo — mismo criterio ya aceptado explícitamente en DT-013 para `eliminarMinutoAMinuto` (el feed "minuto a minuto" tiene el mismo comportamiento desde el principio). Solo consume espacio de Storage, sin efecto visible para ningún usuario.
**Solución propuesta:** Si algún día se resuelve para el feed "minuto a minuto" (ver la entrada de DT-013 en este mismo fichero, si existe, o la nota de la propia migración), aplicar la misma solución aquí (borrar el objeto anterior antes o después de subir el nuevo, con el nombre guardado en la fila previa a sobrescribirla).
**Prioridad:** Baja.

---

## ~~Recordatorio: aplicar `supabase/migrations/0005_config_trafico.sql` contra producción~~ — RESUELTO

**Fecha:** 2026-08-12 → Resuelto (verificado en BD por el orquestador el 2026-09-30)
La tabla `config_trafico` existe en el proyecto de la plataforma.

---

## ~~Recordatorio: aplicar `supabase/migrations/0004_visitas_web.sql` contra producción~~ — RESUELTO

**Fecha:** 2026-08-12 → Resuelto (verificado en BD por el orquestador el 2026-09-30)
La tabla `visitas_web` existe en el proyecto de la plataforma.

---

## Cookie `visitante_id` sin `httpOnly` (DT-022, pestaña "Tráfico")

**Fecha:** 2026-08-12
**Contexto:** Revisión de la tarea "Pestaña Tráfico en el panel admin" (DT-022). `proxy.ts` fija la cookie funcional `visitante_id` (`NOMBRE_COOKIE_VISITANTE`) con `secure: true, sameSite: "lax", path: "/", maxAge: ...` pero sin `httpOnly: true` — a diferencia de la cookie de sesión de admin (`NOMBRE_COOKIE_SESION`), que sí la lleva. Ningún código cliente de la web pública necesita leer o escribir `visitante_id`: solo la lee `proxy.ts` en servidor.
**Problema:** Sin `httpOnly`, la cookie es legible y modificable desde JavaScript en el navegador (`document.cookie`). No expone datos personales (es un UUID aleatorio sin fingerprinting), pero permite que un script malicioso (vía un XSS futuro en la web pública) lea o fije un `visitante_id` arbitrario, ensuciando el conteo de "visitantes únicos" de la pestaña "Tráfico".
**Impacto:** Bajo — no hay datos sensibles en juego, solo integridad de una métrica de analítica interna. No hay XSS conocido en el proyecto hoy.
**Solución propuesta:** Añadir `httpOnly: true` a las opciones de `response.cookies.set(NOMBRE_COOKIE_VISITANTE, ...)` en `proxy.ts` — cambio de una línea, sin efecto en el comportamiento actual (nada la lee desde el cliente).
**Prioridad:** Baja.

---

## Tipo `GranularidadTrafico` duplicado en `lib/trafico/bucketing.ts` y `lib/admin/navegacion.ts`

**Fecha:** 2026-08-12
**Contexto:** Revisión de la tarea "Pestaña Tráfico en el panel admin" (DT-022). `GranularidadTrafico` (`"5m" | "30m" | "1h"`) se define de forma independiente en dos ficheros: `lib/trafico/bucketing.ts` (dominio puro, usado por `agruparVisitasEnTramos`) y `lib/admin/navegacion.ts` (usado por `esGranularidadValida` y `app/admin/page.tsx`). Funciona hoy porque TypeScript compara ambos por estructura (misma unión de literales), pero son dos fuentes de verdad separadas para el mismo concepto de dominio.
**Problema:** Si algún día se añade o quita una granularidad, hay que recordar tocar los dos ficheros; nada del compilador avisa si se desincronizan salvo un error de tipos indirecto en el punto de uso.
**Impacto:** Bajo hoy (cero riesgo funcional real), pero es deuda de mantenibilidad — exactamente el tipo de duplicación que el framework pide evitar ("los tipos se definen donde tiene sentido semántico").
**Solución propuesta:** `lib/admin/navegacion.ts` importa `type GranularidadTrafico` desde `lib/trafico/bucketing.ts` en vez de redefinirlo (es una importación de solo tipo, sin coste en runtime, y `bucketing.ts` no tiene la directiva `"use client"` que motivó sacar `navegacion.ts` de `components/admin/`).
**Prioridad:** Baja.

---

## `GET /api/progreso` no podía reflejar `odometroKm` real en modo libre durante el polling en directo

**Fecha:** 2026-08-09 · **Resuelta:** 2026-08-09, misma tarea (decisión del Orquestador)
**Contexto:** Detectado por el Implementador durante la tarea "Modo libre:
añadir tiempo en marcha, ritmo medio y km caminados" (ver
`docs/tareas/CURRENT.md`, DT-020 en `docs/tecnico/decisiones-tecnicas.md`).
`calcularProgresoLibre` (`lib/traza/progreso-libre.ts`) calcula `odometroKm`
sumando `haversineKm` entre cada par consecutivo de posiciones del
`historico` que recibe. `calcularProgresoActual` (`lib/traza/progreso-actual.ts`),
usada tanto por `GET /api/progreso` (polling cada 30 s desde
`ModoDuranteLibre.tsx`) como por el camino de respaldo de `crearMinutoAMinuto`,
pedía para modo libre **solo la última posición no descartada**
(`.order(ts desc).limit(1)`) — optimización deliberada de DT-018, correcta en
su momento porque entonces `calcularProgresoLibre` solo necesitaba el último
punto para calcular `distanciaRestanteKm`.
**Problema:** Con `odometroKm` añadido, pasar un histórico de un solo
elemento a `calcularProgresoLibre` hacía que el bucle de suma de tramos
(arranca en `i = 1`) nunca se ejecutara — `odometroKm` salía siempre en 0
desde este endpoint. `ModoDuranteLibre.tsx` sustituye su estado `progreso`
completo con cada respuesta de polling (`setProgreso(data)`), así que la
cifra "Caminados" que se ve en pantalla —correcta en la carga inicial de
página, que sí usa el histórico completo (`calcularProgresoLibreDelIntento`,
`app/page.tsx`)— caía a 0 km en el primer poll (~30 s después de cargar) y
se quedaba ahí el resto de la fase "durante": el propio stat que esta tarea
añade quedaba roto en el escenario de uso real (seguimiento en directo
durante el reto).
**Impacto (antes del fix):** Alto para el objetivo de la tarea, acotado a un
stat de un solo modo. En modo libre "durante": "Caminados" y, por depender de
`odometroKm`, "Ritmo medio" mostraban 0/valores incorrectos tras el primer
poll. "Tiempo en marcha" no se veía afectado (usa `ultimaPosicion?.ts`, que
sí llega correcto con una sola posición). "Llegada" (`ModoLlegadaLibre.tsx`)
no se veía afectada — carga server-side única con el histórico completo, sin
polling. Modo guiado no se veía afectado en absoluto.
**Resolución:** El Implementador señaló este bloqueo mayor al Orquestador en
vez de decidirlo en solitario (tocaba un fichero, `lib/traza/progreso-actual.ts`,
y un comportamiento explícitamente probado, DT-018, fuera del "Incluye"
aprobado para la tarea). El Orquestador analizó el hallazgo contra el
histórico de Seguridad de DT-018 (S1/S2) y confirmó que revertir el atajo no
reabre ese vector: S1/S2 son específicos del mecanismo de ventana deslizante
de `calcularProgreso()` (modo guiado); `calcularProgresoLibre` es una suma
`O(n)` trivial sin proyección sobre traza, sin relación con ese vector. Se
aplicó la solución ya propuesta: `lib/traza/progreso-actual.ts` vuelve a
pedir el histórico completo también en modo libre, con el mismo
`obtenerTodasLasFilas` (`lib/supabase/paginacion.ts`, con su propio tope de
seguridad de 50.000 filas) que ya usaba modo guiado, extraído a un helper
compartido `obtenerHistoricoCompleto`. El coste adicional de lectura queda
acotado por la misma caché compartida con TTL de 20 s que ya usa
`GET /api/progreso` (`lib/progreso-cache.ts`, DT-007) — mismo orden de
magnitud que el coste que el modo guiado ya paga en cada recálculo, no un
caso nuevo de riesgo de escala. Ver la nota de cierre de DT-018 en
`docs/tecnico/decisiones-tecnicas.md` para el análisis completo. Tests
actualizados con guardarraíles explícitos (`lib/traza/progreso-actual.test.ts`,
`app/api/progreso/route.test.ts`: `expect(limitMock).not.toHaveBeenCalled()`,
`expect(rangeMock).toHaveBeenCalledWith(0, 999)`, `odometroKm` > 0 con dos
posiciones) para que una regresión futura a este atajo no pase desapercibida.
**Prioridad:** Cerrada.

---

## `calcularProgresoLibreDelIntento` (modo libre, `app/page.tsx`) sigue sin caché tras el endurecimiento S1/S2 de DT-018

**Fecha:** 2026-08-09 · **Resuelta:** 2026-08-12, tarea DT-021 (fix de Seguridad,
ver `docs/tecnico/decisiones-tecnicas.md`)
**Contexto:** Detectado por el Reviewer en la Ronda 2 de revisión de DT-018
(endurecimiento post-Seguridad, S1 + S2). Seguridad encontró que
`app/page.tsx` invocaba el cálculo de progreso en cada visita sin caché ni
rate limiting (issue 2 de su informe), nombrando explícitamente
`calcularProgresoDelIntento` y `calcularProgresoLibreDelIntento` como las
dos funciones a proteger. El fix aplicado (S2) solo extendió la caché
compartida (`lib/progreso-cache.ts`) a `calcularProgresoDelIntento` (modo
guiado) — el Implementador dejó fuera `calcularProgresoLibreDelIntento`
(modo libre) razonando que el vector de coste que motivó el hallazgo (S1: el
fallback O(m) de `calcularProgreso`/`proyectarPunto` sobre la traza) no
existe en `calcularProgresoLibre` (una única `haversineKm`, sin ventana ni
Turf sobre la traza).
**Problema:** El razonamiento es correcto para el vector de cómputo
cuadrático, pero `calcularProgresoLibreDelIntento` sigue pagando en cada
visita sin caché el coste de `obtenerHistoricoPosiciones` — un fetch
paginado que puede llegar hasta el tope de seguridad de 50.000 filas
(`lib/supabase/paginacion.ts`) — más un `.map()` O(n) para construir
`puntosGps`. Sin caché ni rate limiting en la ruta `/` (a diferencia de
`GET /api/progreso`, protegido con 60 req/min y TTL de caché), un histórico
adversarial grande sigue costando lectura de BD y trabajo O(n) repetido en
cada carga de página, aunque de una clase de coste bastante más barata que
la que motivó el bloqueante original (lineal, no cuadrático). El texto
literal del "fix requerido" de Seguridad nombraba ambas funciones.
**Impacto:** Bajo-medio. Seguridad ya evaluó por separado la parte de
volumen/memoria de `obtenerTodasLasFilas` como "resuelta correctamente"
(tope de 50.000 filas, sin acumulación sin cota), así que el peor caso está
acotado, no es un vector de denegación de servicio sin límite. El riesgo
residual es de lectura de BD y transferencia repetidas (una carga de página
por visitante, sin límite de frecuencia), no de cómputo descontrolado.
**Solución propuesta:** Extender el mismo patrón ya implementado y testeado
para `calcularProgresoDelIntento` (caché compartida `lib/progreso-cache.ts`,
condición `cache.valor.modo === "libre"` simétrica a la ya existente para
"guiado") a `calcularProgresoLibreDelIntento`. Barato de implementar (mismo
código, ~10 líneas) y cierra la ambigüedad del texto literal del issue 2 de
Seguridad sin depender de una interpretación de alcance.
**Prioridad:** Cerrada. Seguridad, al revisar DT-021 ("Mapa público en modo
NO libre pinta solo la traza real; panel admin ve ambas trazas +
referencia"), marcó como bloqueante el mismo hueco para modo guiado — DT-021
había introducido una segunda consulta sin caché (`obtenerHistoricoPosiciones`
para pintar el recorrido real en el mapa) en `ModoDuranteConectado`/
`ModoLlegadaConectado`, reabriendo para guiado el vector que S2 ya había
cerrado. El fix aplicado (`lib/historico-cache.ts`, mismo TTL de 20 s que
`lib/progreso-cache.ts`, reutilizado entre `calcularProgresoDelIntento`,
`ModoDuranteConectado`, `ModoLlegadaConectado` y `calcularProgresoLibreDelIntento`)
cierra el vector para ambos modos con el mismo código — se aprovechó para
cerrar también esta entrada, ya que era el mismo fix, no solo lo exigido por
Seguridad para guiado. Tests en `lib/historico-cache.test.ts` y
`app/page.test.ts`.

---

## `obtenerTodasLasFilas` pierde en silencio el resto del histórico si una página intermedia falla

**Fecha:** 2026-08-09
**Contexto:** Detectado por el Reviewer en la revisión de DT-018 (paginación
completa del histórico de posiciones + ventana deslizante en
`calcularProgreso`). `lib/supabase/paginacion.ts` (`obtenerTodasLasFilas`)
pagina con `.range()` en bucle, ordenado por `ts` ascendente. Si una página
intermedia devuelve error (timeout de red, problema puntual de Supabase), la
función registra un `console.warn` y devuelve las filas ya acumuladas hasta
ese punto — sin ninguna señal para quien llama de que el histórico está
incompleto.
**Problema:** Como la paginación va de más antiguo a más reciente, un fallo
en una página tardía trunca justo las posiciones más recientes — la misma
forma de fallo (datos incompletos servidos como si fueran completos, sin
aviso visible) que motivó esta tarea, aunque aquí el disparador es un error
transitorio de red/BD en vez del límite duro de 1000 filas de PostgREST.
`calcularProgreso`/`calcularProgresoLibreDelIntento` no tienen forma de saber
que el histórico que recibieron no es el completo.
**Impacto:** Bajo en la práctica: a diferencia del bug original (congelado el
resto del reto), aquí el siguiente poll (TTL de caché 15-20 s, DT-007, más el
polling de 30 s del cliente) vuelve a pedir el histórico completo desde cero,
así que un fallo transitorio se autocorrige en cuestión de segundos, no de
horas. El riesgo residual es un fallo persistente (no transitorio) en una
página intermedia, que degradaría el progreso mostrado de forma sostenida sin
ningún indicio en la web pública — solo visible en los logs de Vercel.
**Solución propuesta:** Propagar si el resultado es parcial (por ejemplo
`{ filas: T[], completo: boolean }` en vez de `T[]` a secas) para que quien
llama pueda decidir (no cachear un resultado parcial, o registrar con más
severidad); o reintentar una vez la página fallida antes de rendirse. Mínimo
viable: subir el nivel de log de `console.warn` a `console.error` para que
destaque más en Vercel si se repite.
**Prioridad:** Baja — mitigado por la ventana de recálculo corta (15-30 s) y
consistente con el patrón de "rechazo silencioso con log" ya usado en el
resto del proyecto (`/api/track`).

---

## Ningún guardarraíl protege el invariante `VENTANA_PROYECCION_FALLBACK_MAX_M > DESVIO_MENOR_MAX_M`

**Fecha:** 2026-08-09
**Contexto:** Detectado por el Reviewer en la revisión de DT-018. El umbral
de fallback de la ventana deslizante (`VENTANA_PROYECCION_FALLBACK_MAX_M`,
300 m) debe quedar por encima de `DESVIO_MENOR_MAX_M` (250 m) para que
cualquier punto en ruta o con desvío menor siempre se resuelva por ventana —
así lo documenta un comentario extenso en `lib/traza/umbrales.ts`, y así lo
exigía DT-018 explícitamente. No existe `lib/traza/umbrales.test.ts` ni
ninguna aserción en tiempo de módulo que compruebe la relación entre ambas
constantes.
**Problema:** Si en el futuro (posiblemente el mismo día del reto, dado que
`umbrales.ts` está pensado para ajustarse en caliente) alguien sube
`DESVIO_MENOR_MAX_M` sin subir también `VENTANA_PROYECCION_FALLBACK_MAX_M`,
el fallback de escaneo completo dejaría de dispararse en desvíos reales que
hoy sí lo activan — degradación silenciosa de precisión, sin ningún error
visible ni test que lo detecte.
**Impacto:** Nulo hoy (los valores actuales, 300 > 250, cumplen el
invariante). El riesgo es puramente de mantenimiento futuro.
**Solución propuesta:** Un test de una línea en un `lib/traza/umbrales.test.ts`
nuevo: `expect(VENTANA_PROYECCION_FALLBACK_MAX_M).toBeGreaterThan(DESVIO_MENOR_MAX_M)`.
Alternativa equivalente: una aserción `if (...) throw` a nivel de módulo en
`umbrales.ts`.
**Prioridad:** Baja — barato de arreglar, sin urgencia mientras nadie toque
esos dos valores por separado.

---

## `proyeccion.ventana.test.ts` añade ~45 s a `pnpm test` por diseño (comparación contra una réplica O(n×m) del algoritmo anterior)

**Fecha:** 2026-08-09
**Contexto:** Generado al implementar DT-018 (paginación completa del
histórico de posiciones + ventana deslizante en `calcularProgreso`, ver
`docs/tecnico/decisiones-tecnicas.md`). El test obligatorio de "el mismo
resultado con y sin ventana a escala de miles de puntos" necesita ejecutar
una réplica fiel del algoritmo **sin** ventana (`calcularProgresoSinVentana`,
definida solo en el propio test) — deliberadamente O(n×m), la misma
complejidad que esta tarea corrige — para comparar sus resultados contra
`calcularProgreso()` real y demostrar equivalencia numérica, no solo
diseño. A 2000 puntos (la escala exacta validada en DT-018) esa réplica
tarda ~79 s de bloqueo síncrono, lo bastante para que el propio runner de
Vitest reportara un `[vitest-worker]: Timeout calling "onTaskUpdate"` como
"Unhandled Error" — un falso positivo de infraestructura (los 6 tests
seguían en verde), pero un aviso que ensucia la salida de `pnpm test` y
podría, en una máquina más lenta o con más contención, degenerar en un
fallo real. Se redujo a 1000 puntos (~22 s), que ya no reprodujo el aviso en
varias ejecuciones, a costa de no cubrir exactamente la misma escala que
midió DT-018 (2000 y 7200 puntos) en el test de equivalencia — el test de
**rendimiento** aparte sí cubre los 7200 puntos completos, pero solo con el
algoritmo con ventana (rápido), nunca con la réplica O(n×m).
**Problema:** El fichero por sí solo añade ~45 s a la ejecución completa de
`pnpm test` (que sin él tarda ~11 s), y ese tiempo depende de la máquina —
en una CI más lenta o más cargada podría volver a acercarse al umbral que
dispara el aviso de timeout del worker.
**Impacto:** Ninguno en corrección (los tests son deterministas y están en
verde). El coste es de tiempo de desarrollo (cada `pnpm test` completo tarda
notablemente más) y un riesgo residual de que el aviso de timeout reaparezca
en un entorno más lento, sin que eso signifique que el código esté roto.
**Solución propuesta:** Si el tiempo de test se vuelve un problema práctico,
mover el test de equivalencia a un fichero/suite aparte que no corra en
cada `pnpm test` local (por ejemplo un script manual o un job de CI
separado, mismo criterio que otros proyectos aplican a tests de
integración pesados), manteniendo el test de rendimiento (rápido, ~2 s) en
la suite estándar. Alternativa más simple: bajar aún más la escala del test
de equivalencia (por ejemplo 500 puntos) si en la práctica no aporta más
confianza que 1000.
**Prioridad:** Baja — no bloquea nada, es un tradeoff de rigor (comparación
numérica real, no solo diseño) contra velocidad de la suite, y ya está
documentado en el propio fichero de test.

**Actualización (2026-08-12, verificado durante las quality gates de DT-024):**
el "falso positivo de infraestructura" descrito arriba dejó de ser solo un
aviso que ensucia la salida: en esta máquina, ejecutando la suite completa
(`pnpm test`, ~35 ficheros), el mismo `[vitest-worker]: Timeout calling
"onTaskUpdate"` hace que el proceso termine con código de salida 1 —
`Test Files 35 passed (35)`, `Tests 386 passed (386)`, pero
`[ELIFECYCLE] Test failed`. Confirmado que no lo causan los cambios de
DT-024: reproducible en aislamiento ejecutando solo
`lib/traza/proyeccion.ventana.test.ts` (que DT-024 no toca), y el resto de
la suite (excluyendo ese fichero) pasa en verde con exit code 0. Sube la
prioridad práctica de la solución propuesta (mover el test de equivalencia
fuera de `pnpm test` estándar) porque ya no es solo cosmético: puede hacer
que una quality gate se reporte como roja estando todo el código correcto.
**Prioridad:** Media (era Baja) — no indica ningún bug de producto ni de
dominio, pero puede bloquear en falso el cierre de cualquier tarea futura si
alguien exige `pnpm test` con exit code 0 sin mirar el detalle.

---

## ~~El reintento automático de `crearMinutoAMinuto` no es idempotente: puede publicar la misma entrada dos veces~~ — RESUELTO

**Fecha:** 2026-08-09 → Resuelto 2026-09-30 (endurecimiento pre-reto, DT-033)
Clave de idempotencia `clave_envio` (UUID del composer, estable entre reintentos) con índice único parcial (`0014_mam_clave_envio.sql`). La acción devuelve éxito sin subir ni insertar si la clave ya existe en el intento activo, y trata el 23505 como éxito borrando la foto recién subida.

---

## ~~Nada acota en el tiempo la preparación de la foto ni el envío~~ — RESUELTO

**Fecha:** 2026-08-09 → Resuelto 2026-09-30 (endurecimiento pre-reto, DT-033)
(a) `cargarImagen` rechaza a los 10 s (`LIMITE_DECODIFICACION_MS`) y la degradación al original lo absorbe. (b) Sin abortar (las Server Actions no aceptan `AbortSignal`): pasados 15 s de envío, el composer, el modal "Finalizar" y la foto de quién camina muestran "Sigue subiendo, no cierres la página." (`lib/envio/aviso-envio-lento.ts`).

---

## El cliente no comprueba el formato de la foto cuando el navegador no ha podido recodificarla

**Fecha:** 2026-08-09
**Contexto:** Detectado por el Reviewer en la revisión de DT-017.
`prepararFotoParaSubida` (`lib/imagen/preparar-foto.ts`) degrada al fichero
original cuando la recodificación falla, y solo comprueba el tamaño
(`TAMANO_MAXIMO_FOTO_BYTES`) antes de dar la foto por "lista". No comprueba el
tipo MIME, pese a que el módulo ya importa `esMimePermitido` de
`lib/imagen/limites-subida.ts` para otra decisión.
**Problema:** Un original que el navegador no sabe decodificar (HEIC/HEIF de
iPhone en un navegador que no lo soporta es el caso realista) y que pesa menos
del tope se envía igualmente, gasta la subida completa por 4G y el servidor lo
rechaza con "Formato de imagen no permitido". Contradice el principio explícito
de DT-017 punto 3: no gastar una subida condenada a fallar.
**Impacto:** Bajo hoy — el `<input>` declara
`accept="image/jpeg,image/png,image/webp"` y iOS Safari transcodifica el HEIC a
JPEG al elegirlo desde la galería, así que el caso exige un navegador o un flujo
poco habitual. El coste de que ocurra el día del reto es una espera larga
seguida de un error evitable.
**Solución propuesta:** En `prepararFotoParaSubida`, antes de devolver
`{ estado: "lista" }`, comprobar también `esMimePermitido(aEnviar.type)` y
devolver un estado de error con el mismo criterio que "demasiado-grande"
(mensaje explícito, antes de subir nada). Es un `if` con el import ya presente.
**Prioridad:** Baja.

---

## `ErrorNoReintentable` no lo lanza ningún camino de producción

**Fecha:** 2026-08-09
**Contexto:** Detectado por el Reviewer en la revisión de DT-017. La clase
`ErrorNoReintentable` (`lib/envio/errores-de-envio.ts`) está exportada, tiene
ramas propias en `esErrorReintentable` y `describirFalloDeEnvio`, y aparece en
varios tests, pero ninguna ruta de código de producción la construye: los fallos
definitivos del cliente ("demasiado grande") los resuelve el composer antes de
llamar a la Server Action, y los del servidor viajan como `ResultadoPublicacion`,
no como excepción.
**Problema:** Abstracción sin ningún productor real — el framework (sección 7)
pide explícitamente no dejar abstracciones especulativas. Además hace que varios
de los tests nuevos verifiquen una rama inalcanzable, dando una sensación de
cobertura mayor de la real.
**Impacto:** Bajo — código muerto pequeño y bien documentado. El riesgo es de
mantenimiento: quien lea `errores-de-envio.ts` asumirá que existe un camino que
lanza ese error y buscará dónde.
**Solución propuesta:** O bien eliminarla (y simplificar `esErrorReintentable` y
`describirFalloDeEnvio`), o bien darle el productor natural: que
`prepararFotoParaSubida` lance `ErrorNoReintentable` en el caso
"demasiado-grande" en vez de devolver un estado, dejando que el composer tenga
un único camino de error. La segunda opción es la que justifica que la clase
exista.
**Prioridad:** Baja.

---

## La recodificación de la foto en el navegador (canvas) no tiene ninguna prueba automática

**Fecha:** 2026-08-09
**Contexto:** Generado al implementar DT-017 (compresión adaptativa de las
fotos del "minuto a minuto" en el cliente). La lógica de decisión se aisló en
módulos puros y sí está cubierta (`lib/imagen/escalera-compresion.test.ts`,
`lib/imagen/preparar-foto.test.ts` para `elegirFotoAEnviar`), pero el borde
con el navegador de `lib/imagen/preparar-foto.ts` —decodificar el fichero en
un `<img>`, dibujarlo en un `<canvas>` y `toBlob()`— no lo ejecuta ningún
test: el entorno de Vitest es `node` (`vitest.config.ts`) y ni jsdom
implementa `canvas.toBlob` sin la dependencia nativa `canvas`.
**Problema:** Un fallo en ese tramo (un `drawImage` con argumentos mal, un
`toBlob` que devuelve `null`, una orientación EXIF que no se aplica en un
navegador concreto) no lo detecta ninguna quality gate. Es el mismo patrón de
la lección "Ninguna quality gate detecta que Tailwind no esté generando CSS
real": código que compila, con tests en verde, y comportamiento roto.
**Impacto:** Acotado por diseño: si la recodificación lanza, el módulo degrada
al fichero original (y deja un `console.warn`), así que el peor caso es
volver al comportamiento previo a DT-017 —foto grande rechazada con mensaje
explícito— y no un formulario colgado. Lo que sí quedaría sin detectar es una
foto publicada tumbada (orientación EXIF mal aplicada), que solo se ve
mirándola.
**Solución propuesta:** Dos vías, por orden de coste: (a) una prueba E2E con
Playwright que suba una foto vertical real con EXIF `Orientation=6` al panel
admin y compruebe el tamaño y la relación de aspecto del objeto resultante en
Storage; (b) un proyecto de Vitest aparte con entorno `jsdom` + la dependencia
`canvas`, solo para este módulo. Mientras tanto, la comprobación es manual y
en dispositivo real: subir desde un iPhone una foto horizontal y una vertical
y mirar el resultado en el feed.
**Prioridad:** Media — el fix se despliega para un evento con fecha; la
verificación manual en la preview antes del reto cubre el riesgo inmediato,
pero no queda protegido para cambios futuros.

---

## `app/admin/page.test.ts` agota el timeout de 5 s en la primera ejecución de la suite completa

**Fecha:** 2026-08-09 · **Resuelta:** 2026-08-12, tarea DT-024 (Modal Finalizar con preview
real y foto de llegada opcional)
**Contexto:** Detectado al ejecutar las quality gates de DT-017. En la primera
ejecución tras añadir módulos nuevos (caché de transformación de Vitest
fría), el test "redirige a /admin/login sin cookie de sesión" falló con
`Test timed out in 5000ms`; en la siguiente ejecución, y ejecutando ese
fichero aislado (1,5 s), pasa sin problema. La causa es el coste del `await
import("@/app/admin/page")` dentro del propio test: arrastra todo el árbol de
componentes del panel, y compite con los otros 26 ficheros de test en
paralelo.
**Problema:** Es un test intermitente ("flaky") que depende de la carga de la
máquina y del estado de la caché de transformación, no del código bajo
prueba. Un fallo así en una quality gate hace dudar de un cambio correcto.
**Impacto:** Bajo — no indica ningún problema real de producción y se
reproduce solo con la caché fría. El coste es de confianza en la suite: obliga
a reejecutar para distinguir un fallo real de uno de tiempo.
**Resolución:** El Implementador de DT-024 (ModalFinalizar + RecuadroLlegada/
FotoLlegada + lib/envio/lib/imagen, sumados al árbol de `app/admin/page.tsx`)
encontró que el problema había dejado de ser intermitente: los tres tests del
fichero fallaban de forma consistente, incluso con caché caliente, al
ejecutar la suite completa junto a `proyeccion.ventana.test.ts` (~78 s,
ver la entrada de este fichero sobre ese test). Se aplicó la segunda solución
ya propuesta aquí: mover el `await import("@/app/admin/page")` (y el de
`@/lib/auth/admin-session`) a un `beforeAll` con su propio timeout holgado
(30 s) — Node cachea el módulo tras la primera importación, así que
repetirlo por test no aportaba nada salvo pagar su coste de transformación
contra el timeout de 5 s de cada `it()`. Verificado en verde de forma
repetida, tanto en aislamiento como dentro de `pnpm test` completo.
**Prioridad:** Cerrada.

---

## ~~Recordatorio: aplicar `supabase/migrations/0003_modo_intento.sql` contra producción~~ — RESUELTO

**Fecha:** 2026-08-07 → Resuelto (verificado en BD por el orquestador el 2026-09-30)
Las columnas `intentos.modo`, `destino_lat` y `destino_lon` existen en el proyecto de la plataforma.

---

## El fallback de compatibilidad (migración 0003 sin aplicar) no distingue el error "columna inexistente" de otros errores genuinos de Supabase

**Fecha:** 2026-08-07
**Contexto:** Detectado por el Reviewer en la Ronda 2 de revisión del fix de
compatibilidad (ver entrada anterior de este archivo y `docs/tareas/CURRENT.md`,
"Fix de compatibilidad post-revisión"). Los tres puntos de fallback
(`app/page.tsx` `obtenerIntentoActivo`, `app/api/track/route.ts`, `app/api/progreso/route.ts`
`calcularProgresoActual`/`obtenerIntentoActivoModoGuiado`) activan el reintento
con el select mínimo ante **cualquier** `error` que devuelva la consulta con
`modo`/`destino_lat`/`destino_lon` — nunca comprueban `error.code === "42703"`
(el código Postgres específico de "columna no existe") ni registran nada en
logs cuando el error es de otra naturaleza (red, RLS mal configurado, timeout).
**Problema:** Un fallo genuino y no relacionado con la migración pendiente
queda indistinguible del caso esperado "columna todavía no existe" — ambos
disparan el mismo camino de reintento silencioso, sin ningún rastro en logs
que permita diferenciar "esto es esperado, falta aplicar la migración" de
"esto es un problema real que investigar".
**Impacto:** Verificado que no hay regresión funcional: en el peor caso (el
select de fallback también falla), el resultado es exactamente el mismo
comportamiento que tenía el sistema antes de DT-016 (se trata como "sin
intento activo" / se descarta el punto GPS) — coherente con el patrón de
degradación silenciosa ya establecido en todo el proyecto (`respuestaVacia()`
en `/api/track` nunca da pistas sobre el motivo de un descarte). El único
coste real es de observabilidad: mientras la migración 0003 siga sin
aplicarse, no hay forma de detectar desde logs si el fallback se está
disparando por el motivo esperado o por otra causa.
**Solución propuesta:** Comprobar explícitamente `error.code === "42703"`
antes de decidir el reintento; si el código es distinto, registrar con
`console.error` (incluyendo el código/mensaje real de Supabase, sin datos de
usuario) para poder diferenciar ambos casos en los logs de Vercel. Aplica a
los tres puntos de fallback listados arriba.
**Prioridad:** Baja — no bloquea el cierre de la tarea (sin regresión de
comportamiento), pero conviene resolverlo junto con la limpieza del fallback
una vez la migración esté aplicada y confirmada.

---

## Patrón de fallback de compatibilidad (migración 0003) triplicado sin extraer a un helper compartido

**Fecha:** 2026-08-07
**Contexto:** Detectado por el Reviewer en la Ronda 2 de revisión del fix de
compatibilidad. El mismo patrón (intentar select completo → si falla,
reintentar con select mínimo → tratar como modo guiado) aparece implementado
de forma independiente en `app/page.tsx`, `app/api/track/route.ts` y
`app/api/progreso/route.ts`, con ligeras variaciones (columnas seleccionadas,
cliente Supabase admin vs. público, forma del valor de retorno).
**Problema:** Triplicación de lógica equivalente en tres ficheros. No se
extrajo a un helper común.
**Impacto:** Bajo — evaluado y aceptado en la revisión: es código
explícitamente temporal (destinado a quedar inactivo y candidato a
eliminarse una vez la migración esté aplicada, ver entrada de deuda
anterior), y los tres call sites difieren lo suficiente (columnas distintas,
dos clientes Supabase distintos, formas de retorno distintas) como para que
una abstracción compartida forzada añadiera complejidad sin beneficio real
para código de vida corta — coherente con el criterio del framework contra
abstracciones especulativas.
**Solución propuesta:** No actuar mientras el fallback siga siendo temporal.
Si en una revisión futura se confirma que la migración sigue sin aplicarse
mucho tiempo después (y por tanto este código deja de ser "temporal" en la
práctica), reconsiderar extraer un helper común en ese momento, no antes.
**Prioridad:** Baja.

---

## Desfase entre la pantalla y las piedras: calibración aplazada a F3

**Fecha:** 2026-07-30
**Contexto:** Generado en F1.1 al adoptar el diseño de "corredor" (DT-005). La traza mide de más respecto a las distancias grabadas en los mojones físicos del Camino, con un desfase creciente hacia el sur (medido: +1,61 km en Padrón, +2,11 km en Caldas, +2,29 km en Pontevedra, +2,49 km en Redondela, +3,72 km en O Porriño). No es un error de la traza — es la diferencia entre un track GPS detallado y las distancias de etapa redondeadas de las guías.
**Problema:** El día del reto, cuando Santi pase junto a un mojón que pone "98" (por ejemplo), la web mostrará un número diferente. El desfase esperado es ~1,5-3,7 km según la zona. Esto puede ser confuso para los espectadores que conozcan los mojones físicos.
**Impacto:** Cosmético durante el reto: la barra y el odómetro son coherentes entre sí, pero no coinciden con la escala grabada en piedra. Santi ya está informado y lo acepta. El mayor riesgo es que un espectador malinterprete el número como un error técnico.
**Solución propuesta:** En F3, añadir al panel de admin la posibilidad de registrar mojones reales (número grabado + timestamp de paso) durante el reto. Con 2-3 mojones anotados se puede calibrar una función de corrección lineal que alinee la pantalla con las piedras para el resto del recorrido.
**Actualización (2026-08-07, DT-015):** durante el fix de la extensión sur del corredor se investigaron dos mojones reales georreferenciados en OpenStreetMap (lat 42,1696 "97,602" y lat 42,1934 "94,512", ambos al norte de O Porriño). No fue posible calibrar de forma concluyente con solo dos puntos, y no formaba parte del alcance de esa tarea — queda como contexto útil para retomar cuando se aborde esta deuda, no como intento fallido a descartar.
**Prioridad:** Media — no bloquea F2-F4; debe valorarse antes del día del reto.

---

## Tramo final de la traza pendiente de validar sobre el terreno

**Fecha:** 2026-07-30
**Contexto:** Generado en F1 al extender la traza oficial hasta la Praza do
Obradoiro. La traza de la Xunta termina en Praza da Quintana, 93 m en línea
recta del Obradoiro (andando ~210 m, rodeando la catedral).
**Problema:** Los últimos ~210 m de la traza (`lib/traza/traza.geojson`) son
geometría dibujada a mano con 4 waypoints intermedios (Quintana norte →
Praza da Inmaculada → Arco do Pazo de Xelmírez → Obradoiro). No proceden de
datos GPS reales ni de cartografía oficial. La ruta asume que se pasa por
Praza da Inmaculada (Azabachería) — puede que el camino peregrina oficial o
el que use Santi difiera ligeramente.
**Impacto:** La barra de progreso puede mostrar un avance incorrecto en los
últimos ~200 m del reto, que es el tramo más visible del día. Error estimado:
≤ 50 m si la ruta real se desvía de lo dibujado.
**Solución propuesta:** El día del reto, Santi valida la ruta real a pie
(o con fotos de Google Street View) y se ajustan los waypoints. El script
`pnpm simplificar-traza` regenera ambos GeoJSON automáticamente. La propiedad
`tramo_final_manual: true` en el GeoJSON y el test de integridad en
`proyeccion.test.ts` actúan como guardarraíl: si se regenera la traza
incorrectamente, el test falla.
**Prioridad:** Media (no bloquea el desarrollo; debe resolverse antes del día del reto)

---

## `kmAcumulados` se calcula en `prepararTraza` pero no se usa en `calcularProgreso`

**Fecha:** 2026-07-30
**Contexto:** Detectado por el Reviewer en la revisión de F1. El campo `kmAcumulados` de `TrazaPreparada` se precalcula en `prepararTraza` (array de distancias acumuladas por vértice) con la intención de que `calcularProgreso` lo use para proyectar posiciones eficientemente. La implementación actual delega la proyección completamente a `@turf/nearest-point-on-line`, que recalcula internamente todos los segmentos de la LineString en cada llamada, sin aprovechar el precálculo.
**Problema:** El array `kmAcumulados` de 6.915 doubles (~55 KB en memoria) se genera y se almacena en `TrazaPreparada` pero no se usa. El rendimiento real de `calcularProgreso` con el histórico completo del día del reto (~3.600 posiciones) depende de cuántas veces Turf itera los 6.914 segmentos de la traza: en el peor caso, ~24,9 millones de operaciones de distancia por petición. La documentación del tipo y del módulo implica que el precálculo evita este trabajo, pero no es cierto en la implementación actual.
**Impacto:** Potencial lentitud en el endpoint de datos en F2 si se llama con el histórico completo sin paginar. Si `calcularProgreso` se ejecuta en cada petición con 3.600 posiciones, podría superar 100 ms en servidor. No hay impacto en correctitud — solo en rendimiento.
**Solución propuesta:** Dos opciones: (a) implementar la proyección usando `kmAcumulados` (búsqueda binaria + interpolación lineal) para O(log n) por punto en vez de O(n); o (b) eliminar `kmAcumulados` de `TrazaPreparada` y documentar que el rendimiento depende de Turf. La opción (a) es la que se anticipaba en el diseño. Evaluar en F2 cuando se defina cómo se llama `calcularProgreso`.
**Actualización (F3, 2026-07-31):** `calcularProgreso` se invoca ahora desde `GET /api/progreso` con polling del cliente cada 30 s. Ver DT-007: se mitiga con una caché en memoria de proceso (TTL 15-20 s) en el propio route handler, sin tocar `proyeccion.ts` ni el esquema. Si en producción (día del reto) la caché TTL no basta — por ejemplo con muchos más seguidores concurrentes de los previstos — el arreglo de fondo sigue siendo la opción (a) de arriba, o persistir el progreso incremental en `intentos` (Opción C descartada en DT-007 por alcance).
**Prioridad:** Media (mitigada en F3; el arreglo de fondo queda pendiente solo si el TTL resulta insuficiente en producción)

---

## `traza-mapa.geojson` es 4 KB más grande que el objetivo de DT-001

**Fecha:** 2026-07-30
**Contexto:** DT-001 estimó ~37 KB para la traza de pintado. El fichero
generado mide 41,9 KB (compact JSON). La diferencia se debe a que la traza
extendida tiene 4 puntos más y a ligeras variaciones en el algoritmo.
**Problema:** El fichero enviado al navegador en F3 pesa ~5 KB más de lo previsto.
Con gzip, la diferencia real será de ~1-2 KB.
**Impacto:** Despreciable en la práctica. En cobertura móvil rural (el escenario
del reto), la diferencia es imperceptible.
**Solución propuesta:** Revisar en F3 cuando se integre MapLibre. Si el peso
total de la página es un problema, se puede reducir la precisión de coordenadas
a 5 decimales (actualmente 6) o subir la tolerancia DP a 4-5 m.
**Prioridad:** Baja

---

## Ancla del porcentaje se recalcula si el admin descarta la primera posición

**Fecha:** 2026-07-30
**Contexto:** Detectado por el Reviewer en la revisión de F1.1. En `proyeccion.ts`, el ancla del porcentaje (DT-005) se calcula desde `validas[0]` — el primer punto sin `descartado=true` — en cada llamada a `calcularProgreso`. Si el admin descarta la primera posición del histórico (operación que existirá en el panel de F4), la siguiente llamada ancla en la segunda posición, que puede estar en un km distinto de la traza.
**Problema:** En el escenario donde la posición 0 estaba proyectada a km 4 de la traza, Santi avanzó hasta km 50 (porcentaje ≈ 45,5%), y el admin descarta la posición 0, la nueva ancla pasa a la posición 1 (km 5). El nuevo porcentaje es (50-5)/(105-5) × 100 = 45%. La barra baja visiblemente, aunque el comportamiento resultante es más correcto (el ancla refleja el inicio real del intento). El riesgo principal es que ocurra en directo con espectadores mirando.
**Impacto:** Leve en casi todos los casos reales (las primeras dos posiciones registradas suelen estar muy próximas). Potencialmente visible si el primer GPS registró una posición muy desviada al sur antes de corregir.
**Solución propuesta:** En F4, al implementar la acción de descartar posición, añadir una advertencia al admin si la posición a descartar es la que actualmente ancla el porcentaje. Alternativamente, persistir `kmAncla` en la tabla `intentos` de BD la primera vez que se calcula, para que no dependa del primer punto del histórico en cada petición.
**Prioridad:** Baja — el escenario es operacionalmente improbable; solo importa si se descarta el primer punto mientras el reto está en curso.

---

## `Progreso` expone campos internos de `Posicion` al serializar hacia el cliente en F3

**Fecha:** 2026-07-30 · **Resuelta:** 2026-07-31, tarea F3
**Contexto:** Detectado por el Agente de Seguridad en la revisión de F1. El tipo
`Progreso` incluye `ultimaPosicion: Posicion | null`, que es el tipo completo de
base de datos.
**Resolución:** F3 introduce `ProgresoPublico` (`lib/types.ts`) y la función pura
`aProgresoPublico()` (`lib/traza/progreso-publico.ts`), que proyecta `Progreso` a
solo `porcentaje`, `kmAvanzados`, `kmRestantes`, `odometroKm`, `estado`, y de
`ultimaPosicion` solo `lat`/`lon`/`ts` — nunca `batt`, `acc`, `intento_id`,
`fuente` ni `descartado`. La proyección se ejecuta siempre en servidor:
`GET /api/progreso/route.ts` y `app/page.tsx` (Server Component) son los únicos
puntos que llaman a `calcularProgreso()`, y ambos serializan a través de
`aProgresoPublico()` antes de que nada llegue al cliente. Cubierto con tests
(`lib/traza/progreso-publico.test.ts`) que verifican explícitamente que ninguno
de los campos internos aparece en el objeto resultante.
**Prioridad:** Cerrada.

---

## Envenenamiento del ancla de progreso desde el endpoint de ingesta (F2)

**Fecha:** 2026-07-30 · **Corregida (parcialmente):** 2026-07-30, tarea F2 · **Cerrada:** 2026-08-01, tarea F4
**Contexto:** Detectado por el Agente de Seguridad en la revisión de F1.1. El ancla del porcentaje se fija con el primer punto no descartado del histórico y determina el denominador de todo el cálculo del intento. En F2 el histórico se alimenta desde `/api/track`, un endpoint accesible desde internet. Ver **DT-006** en `docs/tecnico/decisiones-tecnicas.md` para el análisis completo y la decisión de defensa en dos capas.
**Problema (corrección de la premisa original):** Esta entrada decía "irreversible sin tocar la BD directamente". Es incorrecto: `calcularProgreso` recalcula el ancla en cada llamada como `validas[0]` (primer punto con `descartado: false`), así que marcar el punto envenenado como `descartado` desde el panel de admin lo repara sin tocar la BD a mano — **es reversible vía admin**. El problema real y más matizado: la especificación v1 solo preveía un botón de "descartar último punto", que no llegaba a un punto envenenado si quedaba enterrado bajo datos posteriores.
**Solución — estado final:**
- **Capa 1 (F2, implementada):** filtro de plausibilidad geográfica en `/api/track` — se rechaza (sin guardar, sin dar pistas) cualquier punto a más de 100 km de la traza de cálculo. Ver `app/api/track/route.ts`, `lib/traza/umbrales.ts` (`SEPARACION_TRAZA_MAX_KM`) y sus tests en `app/api/track/route.test.ts`.
- **Capa 2 (F4, implementada):** la Server Action `descartarPosicion(id)` (`app/admin/actions.ts`) y la sección Posición del panel (`components/admin/SeccionPosicion.tsx`) permiten descartar cualquier punto del histórico paginado, no solo el último — cierra el caso límite de un punto envenenado enterrado bajo datos posteriores.
**Prioridad:** Cerrada — ambas capas de defensa están implementadas.

---

## `/api/track` no valida el rango físico de `lat`/`lon`/`tst` en el schema Zod

**Fecha:** 2026-07-30 · **Resuelta:** 2026-07-30, ronda final de limpieza F2
**Contexto:** Detectado por el Reviewer en la revisión de F2. El schema `payloadOwnTracks` en `app/api/track/route.ts` validaba `lat`/`lon`/`tst` solo como `z.number()`, sin rango físico.
**Resolución:** `payloadOwnTracks` ahora exige `lat: z.number().min(-90).max(90)`, `lon: z.number().min(-180).max(180)` y `tst: z.number().positive()` (sin cota superior, para no mantener una fecha mágica). Sigue siendo el filtro geográfico de 100 km (DT-006) la defensa real contra el envenenamiento del ancla — esto es defensa adicional explícita por contrato, no un sustituto.
**Prioridad:** Cerrada.

---

## Sin rate limiting en `/api/track`

**Fecha:** 2026-07-30 · **Ampliada:** 2026-07-31, tarea F3 · **Cerrada:** 2026-08-01, tarea F5
**Contexto:** Detectado por el Agente de Seguridad en la revisión de F2 (auditoría OWASP Top 10, A04).
**Problema:** El endpoint de ingesta no tiene ningún límite de peticiones. No es bloqueante mientras el proyecto no esté desplegado (F0/Vercel pendiente), pero es condición explícita antes de exponer el endpoint a internet: un token filtrado sin límite permite spam de inserciones en `posiciones`, degradando el rendimiento y ensuciando el histórico (con impacto directo en el cálculo de progreso).
**Impacto:** No compromete la integridad del ancla (eso ya lo cubre DT-006), pero permite agotar cuota de BD y ensuciar el histórico visible en el panel de admin si el token se filtra (captura de la config de OwnTracks en el móvil, logs de Vercel, etc.).
**Solución propuesta:** Rate limiting a nivel de IP o de token en el propio route handler (o mediante la capa de Vercel/Edge si se dispone de ella), antes de F5 (cierre y deploy a producción).
**Ampliación (F3):** los tres endpoints nuevos de la web pública (`POST /api/comentarios`, `POST /api/intenciones`, `GET /api/progreso`/`GET /api/comentarios`) están en el mismo caso — explícitamente fuera de alcance de F3 según `docs/tareas/CURRENT.md`, la solución de fondo es la misma y debe cubrir los cuatro endpoints (`/api/track` incluido) antes de F5.
**Ampliación (F4):** `POST /api/admin/login` se añade a la misma lista — sin
rate limiting, un atacante puede probar contraseñas sin límite (fuerza
bruta). La comparación en tiempo constante (`timingSafeEqual`) evita fugar
información por timing, pero no sustituye a un límite de intentos. Explícitamente
fuera de alcance de F4 según `docs/tareas/CURRENT.md`, agrupado con los demás
endpoints pendientes de F5.
**Resolución (F5):** implementado rate limiting en memoria de proceso (DT-011,
`docs/tecnico/decisiones-tecnicas.md`) en los 6 endpoints listados: módulo
compartido `lib/rate-limit.ts` (función `consumir(clave, limite, ventanaMs)`
sobre un `Map` en scope de módulo, mismo patrón que la caché TTL de DT-007).
`POST /api/track` limita por token (40 req/min); `POST /api/comentarios`,
`POST /api/intenciones`, `GET /api/progreso`, `GET /api/comentarios` y
`POST /api/admin/login` limitan por IP (`x-forwarded-for`) con sus propios
límites (ver tabla en DT-011). Al exceder el límite se responde `429` sin
cuerpo, mismo criterio de rechazo silencioso que el resto del proyecto.
Cubierto con tests unitarios de `lib/rate-limit.ts` (ventana que expira,
contador que resetea, claves independientes, borde exacto del límite) y
tests de integración por ruta que verifican el `429` al superar el cupo.
**Limitación conocida, aceptada en DT-011:** el contador es por instancia de
función serverless — no se comparte entre regiones ni sobrevive a un cold
start. Suficiente para el tráfico esperado (evento de un día, audiencia
familiar/amigos); si no bastara, la solución de fondo es un contador
compartido (Upstash u otro).
**Prioridad:** Cerrada.

---

## Overlay del mapa (F3): el corte "andado / restante" usa distancia euclídea en grados, no la proyección real de Turf

**Fecha:** 2026-07-31 · **Contexto:** Generado en F3 al implementar `components/mapa/Mapa.tsx`.
**Problema:** Para pintar el tramo andado en naranja y el restante en discontinuo, el overlay SVG busca el vértice de `traza-mapa.geojson` más cercano a la posición actual con distancia euclídea simple en grados lon/lat (función `indiceMasCercano`), en vez de reutilizar `nearestPointOnLine` de Turf (la misma proyección que ya usa `calcularProgreso` en `proyeccion.ts`). Es una aproximación deliberada para no acoplar un componente puramente visual al dominio de cálculo de progreso (que trabaja sobre `traza.geojson`, no `traza-mapa.geojson`).
**Impacto:** Puramente cosmético — el `%`/km mostrados en el Mojón siempre vienen de `calcularProgreso` (correcto). El único efecto de esta aproximación es que, en tramos donde la traza serpentea mucho (curvas cerradas), el punto de corte entre el color naranja y el discontinuo puede desviarse visualmente unos pocos vértices del punto exacto. No afecta a ningún número mostrado al usuario.
**Solución propuesta:** Si en producción se nota un desajuste visible, sustituir `indiceMasCercano` por una proyección con Turf sobre `traza-mapa.geojson` (import de `@turf/nearest-point-on-line`, ya es dependencia del proyecto).
**Prioridad:** Baja — cosmético, sin impacto en los datos mostrados.

---

## `scripts/bundle-maplibre-worker.ts` no valida la existencia del fichero de entrada antes de invocar esbuild

**Fecha:** 2026-07-31
**Contexto:** Detectado por el Reviewer en la revisión de los fixes post-preview de F3 (DT-008, worker de MapLibre pre-empaquetado).
**Problema:** El script asume que `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` existe con ese nombre exacto y no comprueba su existencia con `existsSync` antes de llamar a `esbuild.build()`. Si una futura actualización de `maplibre-gl` renombra o reestructura los artefactos de `dist/`, el fallo se manifiesta como el error nativo de esbuild ("Could not resolve...") — ruidoso y capturado por el `.catch()` de `main()` (no rompe en silencio), pero el mensaje no menciona DT-008 ni orienta hacia la causa real.
**Impacto:** Bajo. El fallo es visible y detiene el hook `predev`/`prebuild` (no hay build fantasma con worker desactualizado), pero diagnosticar la causa exige que quien lo vea conozca DT-008 de antemano.
**Solución propuesta:** Añadir una comprobación `existsSync(ENTRADA)` al inicio de `main()` que lance un error propio, explícito, con referencia a DT-008 y `docs/LESSONS.md`, antes de invocar esbuild.
**Prioridad:** Baja.

---

## DT-008 no refleja la decisión final sobre si el artefacto del worker se commitea o se regenera

**Fecha:** 2026-07-31
**Contexto:** Detectado por el Reviewer en la revisión de los fixes post-preview de F3.
**Problema:** `docs/tecnico/decisiones-tecnicas.md` (DT-008) deja explícitamente "a criterio del Implementador" si `public/maplibre-gl-worker.bundled.js` se commitea o se regenera en cada build, remitiendo a `README.md`/`AGENTS.md` para el detalle. La implementación final decidió no commitearlo (está en `.gitignore`, se regenera siempre vía `predev`/`prebuild`) y lo documentó bien en `AGENTS.md`, pero el propio DT-008 nunca se actualizó para cerrar esa decisión abierta — un lector de `decisiones-tecnicas.md` no sabe, sin ir a `AGENTS.md`, cuál de las dos opciones se tomó.
**Impacto:** Puramente documental. No afecta al comportamiento del sistema.
**Solución propuesta:** Añadir una línea a DT-008 confirmando la decisión final ("no se commitea; se regenera siempre desde `node_modules` vía predev/prebuild") para que el documento de decisiones quede autocontenido.
**Prioridad:** Baja.

---

## `docs/tecnico/arquitectura.md` no refleja los ficheros nuevos del perfil de elevación

**Fecha:** 2026-07-31
**Contexto:** Detectado por el Reviewer en la revisión de la tarea "Foto en Quién camina + estadísticas y perfil de elevación". La tabla de estructura de carpetas de `arquitectura.md` (sección `lib/traza/` y `components/publico/`) no incluye `lib/traza/perfil-elevacion.ts`, `lib/traza/perfil-elevacion.json`, `components/publico/PerfilElevacion.tsx` ni `scripts/generar-perfil-elevacion.ts`, pese a que esa tabla es la fuente de verdad documentada de dónde vive cada tipo de código.
**Problema:** Un agente o desarrollador que consulte `arquitectura.md` para orientarse no verá estos cuatro ficheros nuevos, aunque sí están documentados en detalle en DT-009 (`decisiones-tecnicas.md`).
**Impacto:** Puramente documental. No afecta al comportamiento del sistema, pero reduce la fiabilidad de `arquitectura.md` como mapa completo del proyecto.
**Solución propuesta:** Añadir las 4 filas nuevas a la tabla de estructura de `arquitectura.md`, siguiendo el mismo formato que las entradas marcadas `# F3: ...`.
**Prioridad:** Baja.

---

## ~~Comentario desactualizado en `EnlacePaginacion.tsx`: dice "Link", implementa `<button>` + `router.push`~~ — RESUELTO

**Fecha:** 2026-08-01 → Resuelto 2026-09-30 (endurecimiento pre-reto)
El comentario de cabecera describe ahora el botón con `router.push()`.

---

## Comentarios de cabecera obsoletos: "no probado contra Supabase real" / "bloqueado por F0" en 3 ficheros de producción

**Fecha:** 2026-08-01
**Contexto:** Detectado por el Reviewer en la auditoría completa de F5 (F1-F5). `app/api/track/route.ts`, `lib/supabase/admin.ts` y `lib/supabase/public.ts` conservan comentarios de cabecera escritos en F2, cuando el proyecto Supabase todavía no existía (bloqueado por F0): afirman literalmente "NO SE HA PROBADO CONTRA UNA BASE DE DATOS REAL", "no existe proyecto Supabase todavía" y "bloqueado por F0". El proyecto lleva desplegado en producción con Supabase real desde F2 y ha pasado por F3 y F4 sin que nadie actualizara estos tres comentarios.
**Problema:** Documentación embebida en el código que contradice el estado real del sistema. Un agente o desarrollador que lea estos ficheros por primera vez (por ejemplo para depurar un incidente en producción) puede concluir erróneamente que el cliente Supabase nunca se ha verificado contra una BD real, cuando de hecho lleva en producción real varias fases.
**Impacto:** Puramente documental — cero efecto en comportamiento. Pero es el mismo patrón que ya causó una entrada de deuda en F4 (`EnlacePaginacion.tsx`) y ahora aparece de forma recurrente en 3 ficheros más — ver nueva entrada en `docs/LESSONS.md`.
**Solución propuesta:** Actualizar los tres comentarios de cabecera para reflejar el estado real (Supabase en producción, verificado en integración desde F2 según `docs/bugs/BUGS.md`), eliminando cualquier referencia a "bloqueado por F0" o "no probado".
**Actualización 2026-10-01 (DT-035):** `app/api/track/route.ts` ya está corregido (cabecera reescrita) y `lib/supabase/admin.ts` ya no lo decía. Queda `lib/supabase/public.ts`.
**Prioridad:** Baja — documental, pero recurrente; conviene resolver en la próxima tarea que toque cualquiera de estos tres ficheros.

---

## Nombre de test en `proyeccion.test.ts` puede quedar incompleto tras añadir assertion de `kmRestantes`

**Fecha:** 2026-08-02 · **Cerrada:** 2026-08-02, fix de Ronda 1 de la misma tarea
**Contexto:** Detectado por el Reviewer en la revisión de "Km restantes: solo plan restante desde el punto más cercano (sin sumar la vuelta)". El bloqueante de esa revisión pide añadir una assertion de `kmRestantes` al test de "desvío grande (~2 km)" (`lib/traza/proyeccion.test.ts`, línea ~304-319, `it("clasifica como desvio-mayor cuando la separación es ~2 km"...)`).
**Problema:** Si el Implementador amplía las assertions de ese test sin renombrarlo, el nombre deja de describir con precisión todo lo que el test verifica (framework, sección Tests: "los nombres de los tests describen el comportamiento que verifican").
**Resolución:** Al aplicar el fix del bloqueante de Ronda 1, el test se renombró a "clasifica como desvio-mayor y kmRestantes no suma la separación cuando la separación es ~2 km", reflejando ambas assertions.
**Prioridad:** Cerrada.

---

## `MinutoAMinuto.tsx` asume sin documentarlo que `entradas[0]` es siempre la entrada más reciente para el poll incremental

**Fecha:** 2026-08-02
**Contexto:** Detectado por el Reviewer en la revisión de "Minuto a minuto (feed en directo con fotos)". `components/publico/MinutoAMinuto.tsx` usa `entradas[0].id` como `despuesDeId` para el poll incremental (`masRecienteIdRef`), lo que asume que la primera entrada del array (ordenado por `created_at desc`) tiene también el `id` más alto — cierto hoy porque `id` es autoincremental y `created_at` se genera en el mismo insert, pero es una invariante implícita, no verificada por ningún test ni documentada en el propio componente.
**Problema:** Si en el futuro se permitiera editar `created_at`, hacer backfill de entradas antiguas, o cualquier operación que desacople el orden de `id` del orden de `created_at`, el poll incremental podría dejar de detectar entradas nuevas (o repetirlas) sin que ningún test lo capture.
**Impacto:** Bajo en el estado actual del sistema — no hay ninguna vía para insertar `minuto_a_minuto` con `created_at` fuera de orden respecto a `id` (todas las inserciones son vía `crearMinutoAMinuto`, que no permite fijar `created_at`). Solo se manifestaría si una tarea futura cambia esa garantía.
**Solución propuesta:** Añadir un comentario junto a `masRecienteIdRef` documentando explícitamente la invariante ("`id` creciente y `created_at desc` están siempre correlacionados porque ambos se generan en el mismo insert, sin vía de edición de `created_at`"), y opcionalmente un test que verifique el comportamiento del poll con una respuesta de varias entradas nuevas a la vez.
**Prioridad:** Baja.

---

## `calcularRitmoMedioIntento` (y sus equivalentes) no se defienden contra fechas inválidas

**Fecha:** 2026-08-01
**Contexto:** Detectado por el Reviewer en la revisión de "Estadísticas (tiempo, distancia, ritmo) en la pantalla de llegada". `lib/ritmo.ts` (`calcularRitmoMedioIntento`) recibe `iniciadoEn`/`finalizadoEn` como `string | null` (o `Date | string | null` en el caso del final) directamente desde columnas de Supabase (`started_at`/`ended_at`), sin validación de formato. Si el valor almacenado no fuera un ISO 8601 parseable, `new Date(valor)` produce `Invalid Date` (`getTime()` → `NaN`), y la resta `(final - inicio) / 3_600_000` da `NaN`, que pasa la comprobación `horasTranscurridas <= 0` como `false` (toda comparación con `NaN` es `false`) y termina formateándose como `"NaN,N"` en vez de caer al fallback `"—"`.
**Problema:** No es una regresión de esta tarea — el mismo patrón sin blindar ya existe en `calcularRitmoMedio` de `components/publico/ModoDurante.tsx` y en `formatearTiempoTotal` de `app/page.tsx`, ninguno con test para este caso. Pero al centralizar la fórmula de ritmo en `lib/ritmo.ts` con tests, es el punto natural para cerrarlo de una vez para los tres sitios.
**Impacto:** Bajo en la práctica — `started_at`/`ended_at` los escribe el propio backend (Server Actions del panel admin), nunca un formulario de usuario externo; la superficie de que lleguen corruptos es pequeña. Si ocurriera, el efecto visible sería mostrar `"NaN,N"` en vez de `"—"` en la pantalla pública, un fallo cosmético pero visible a espectadores.
**Solución propuesta:** Añadir una comprobación `Number.isNaN(inicio) || Number.isNaN(final)` (o validar con `Number.isFinite`) antes de calcular `horasTranscurridas` en `lib/ritmo.ts`, con su test de regresión; valorar si merece la pena replicar el mismo guard en `ModoDurante.tsx`/`page.tsx` o extraerlos también a `lib/ritmo.ts` en una tarea futura de consolidación.
**Prioridad:** Baja.

---

## `docs/tecnico/arquitectura.md` no incluye `lib/rate-limit.ts` en la tabla de estructura

**Fecha:** 2026-08-01 · **Cerrada:** 2026-08-01, tarea "Auto-refresco de fase en la web pública"
**Contexto:** Detectado por el Reviewer en la auditoría completa de F5. La tabla de estructura de carpetas de `arquitectura.md` no lista `lib/rate-limit.ts`, pese a ser un módulo de infraestructura compartida (DT-011) usado activamente por las 6 rutas públicas del proyecto.
**Problema:** Mismo patrón ya registrado para el perfil de elevación (ver entrada anterior en este archivo): la tabla de estructura no es fuente de verdad completa de dónde vive cada tipo de código.
**Impacto:** Puramente documental. La decisión sí está bien documentada en DT-011 (`decisiones-tecnicas.md`), solo falta el reflejo en la tabla de `arquitectura.md`.
**Resolución:** Añadida la fila `lib/rate-limit.ts` a la tabla de estructura de `arquitectura.md` al añadir también `app/api/fase/route.ts` y `components/publico/RefrescoAlCambiarFase.tsx` (DT-012).
**Prioridad:** Cerrada.

---

## `crearMinutoAMinuto` puede guardar `lat`/`lon` a `null` si la caché compartida de progreso está vacía en esa instancia serverless

**Fecha:** 2026-08-02 · **Cerrada:** 2026-08-09, tarea "Las entradas del minuto a minuto se guardan sin posición" (DT-019)
**Contexto:** Generado al implementar DT-014 (`docs/tecnico/decisiones-tecnicas.md`) — fix para que el snapshot de posición de "Minuto a minuto" coincida con lo que el mapa público está mostrando, leyendo de la caché compartida `lib/progreso-cache.ts` en vez de una lectura fresca de `posiciones`.
**Problema:** La caché vive en memoria de proceso, igual que DT-007/DT-011 — no se comparte entre instancias serverless de Vercel ni sobrevive a un cold start. Si `crearMinutoAMinuto` se ejecuta en una instancia que todavía no ha atendido ninguna petición `GET /api/progreso` (arranque en frío, poco tráfico reciente), la caché está vacía y la entrada se guarda con `lat: null, lon: null` aunque existan posiciones reales en BD — deliberado (sin fallback a `posiciones`, ver DT-014), pero significa que alguna entrada del feed puede quedar sin posición asociada aunque Santi sí tuviera GPS reciente.
**Impacto (confirmado, no solo teórico):** en la prueba real del 2026-08-07 la frecuencia observada fue **16 de 16 entradas (100 %)**, no el caso raro que preveía esta entrada ("`/api/progreso` recibe polling cada 30 s... la caché rara vez estará vacía") — la web pública tuvo poco tráfico real ese día. Cosmético igualmente (sin marcador al pinchar la entrada, sin efecto en el cálculo de progreso), pero visible al 100 % en vez de ocasional.
**Resolución (DT-019):** `crearMinutoAMinuto` ya no se rinde con `lat: null, lon: null` cuando la caché está vacía. Recalcula el progreso en el momento reutilizando `calcularProgresoActual` (`lib/traza/progreso-actual.ts`, extraída de `app/api/progreso/route.ts` para que ambos puntos de llamada compartan la misma lógica sin duplicarla — no una lectura en bruto de `posiciones`, que podría no coincidir con lo que el dominio considera la última posición válida), y deja el resultado en la caché compartida para el siguiente lector. Solo si ese recálculo también da `ultimaPosicion: null` (de verdad no hay ninguna posición registrada todavía) la entrada se guarda sin posición — caso límite legítimo, no el bug.
**Prioridad:** Cerrada.

---

## `nota_extension_sur` en `traza.geojson` mezcla dos medidas distintas bajo una misma cifra ("~10,2 km al sur de O Porriño")

**Fecha:** 2026-08-07
**Contexto:** Detectado por el Reviewer en la revisión de DT-015. La propiedad `nota_extension_sur` de `scripts/simplificar-traza.ts` (y por tanto de `traza.geojson`) dice "Los primeros ~10,2 km (al sur de O Porriño) proceden del KML original...". Los 10,2175 km son la distancia desde el inicio original de la traza (pre-DT-005, ~1,7 km al norte del centro de O Porriño) hasta el nuevo extremo sur — no son 10,2 km medidos desde O Porriño hacia el sur (esa cifra real es 8.508,2 m, ver DT-015).
**Problema:** La cifra en sí es correcta (coincide con "Extensión sur... 4,7549 km → 10,2175 km" documentado en el histórico de la tarea), pero el paréntesis "(al sur de O Porriño)" puede leerse como si los 10,2 km fueran íntegramente al sur del centro de O Porriño, cuando en realidad incluyen también el tramo ya existente entre el inicio original (al norte del centro) y el centro mismo.
**Impacto:** Puramente documental/cosmético — no afecta a ningún cálculo, solo a la claridad de un comentario de propiedades del GeoJSON que no llega al cliente (no es `traza-mapa.geojson`).
**Solución propuesta:** Reformular a algo como "Los primeros ~10,2 km del corredor (desde el inicio original de la traza, incluyendo el tramo que atraviesa O Porriño) proceden del KML..." para no sugerir que toda la cifra es sur del centro.
**Prioridad:** Baja.

---

## Modo libre (DT-016): el trazado en vivo del mapa solo capta 1 punto GPS por ventana de polling (30 s)

**Fecha:** 2026-08-07
**Contexto:** Generado al implementar el modo de intento "libre" (DT-016, `docs/tecnico/decisiones-tecnicas.md`). El contrato `ProgresoPublico` (rama libre) solo expone `ultimaPosicion` (la posición más reciente), no un histórico — decisión explícita de DT-016 para no ampliar el contrato público. Para pintar en el mapa "el trazado de puntos GPS recibidos, conectados según van llegando" en modo "durante" sin añadir un endpoint público nuevo ni exponer el histórico completo en `ProgresoPublico`, la solución adoptada carga el histórico completo una vez server-side (carga inicial de página) y luego, en cada poll de 30 s a `GET /api/progreso` (ya existente, DT-007), añade al trazado la `ultimaPosicion` si su `ts` cambió respecto al último punto conocido.
**Problema:** Si el tracker GPS envía más de un punto dentro de la misma ventana de 30 s entre dos polls, el cliente solo llega a ver y añadir al trazado visual el último de esos puntos — los intermedios quedan guardados en BD (no se pierde ningún dato real) pero no aparecen en la polilínea que ve el espectador hasta que la página se recargue (momento en el que la carga inicial sí trae el histórico completo).
**Impacto:** Cosmético — el trazado en vivo puede verse ligeramente menos denso/suave de lo que realmente caminó/condujo la persona en modo libre, solo durante el tramo entre la última recarga de página y el momento actual. No afecta a `distanciaRestanteKm` (siempre se calcula sobre la posición real más reciente en BD, no sobre el trazado del mapa) ni a ningún dato mostrado a terceros.
**Solución propuesta:** Si en uso real se nota el trazado demasiado disperso, añadir un endpoint público ligero (`GET /api/puntos-gps` o similar, con el mismo criterio de RLS/rate limiting que el resto de endpoints públicos) que devuelva los puntos nuevos desde un cursor (mismo patrón que `despuesDeId` de `GET /api/minuto-a-minuto`, DT-013), y que `ModoDuranteLibre.tsx` haga polling a ese endpoint en vez de derivar el trazado únicamente de `ultimaPosicion`.
**Prioridad:** Baja — cosmético, modo libre es una feature nueva sin uso real todavía que lo confirme como problema.

---
