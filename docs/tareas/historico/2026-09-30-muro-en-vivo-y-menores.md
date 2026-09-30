# Tarea en curso — Lote de pendientes pre-reto: muro en vivo, sección apagada en caliente y ajustes del panel

> El contenido anterior (vista previa, peregrino, Instagram en Configuración y URL del GPS)
> se archivó en `docs/tareas/historico/2026-09-30-vista-previa-y-config.md`.

## Prompt clarificado (aprobado por el orquestador)

1. **Muro en vivo:** poll de la página 0 de `GET /[slug]/api/comentarios` cada 60 s solo con la pestaña visible (pausa en oculto, reanuda al volver); fusión por id (raíces nuevas arriba, respuestas nuevas en su hilo) sin perder páginas siguientes ni respuestas locales; el formulario de respuesta abierto no se desmonta. Sin poll en vista previa ni con la sección apagada. Fusión en función pura con tests.
2. **Sección apagada en caliente:** 403 en el poll del minuto a minuto ⇒ parar el intervalo + `router.refresh()` una vez. Igual en el muro.
3. **`iniciarReto` guiado sin ruta:** rechazo en servidor con mensaje claro y la opción oculta en la UI si `ruta_id` es null. Tests.
4. **`ocultarComentario`/`mostrarComentario`:** filtrar `visibilidad='publico'`; sin filas ⇒ "No se puede ocultar un mensaje privado". Tests.
5. **UUID sin contexto seguro:** fallback con `crypto.getRandomValues` (función pura en `lib/`, test de formato).
6. **Instagram:** rechazar el dominio sin usuario y rutas reservadas (p, reel, reels, explore, stories, accounts, direct, tv); aceptar `m.instagram.com/usuario`. Tests.
7. **`RespuestaForm`:** "Respondiendo a …" con `aria-describedby` del textarea; al cambiar de destinatario, foco al nombre si está vacío o al texto si no.

Entradas de `DEBT.md` relacionadas. Sin migraciones (no ha hecho falta ninguna).

## Decisión técnica

Notas posteriores (2026-09-30) en DT-016, DT-030, DT-031, DT-032, DT-033 y DT-034 (`docs/tecnico/decisiones-tecnicas.md`).

## Archivos creados/modificados (Implementador)

| Archivo | Cambio |
|---|---|
| `lib/comentarios/muro-en-vivo.ts` (+ test) | Creado: `EstadoMuro`, `fusionarHilos`, `aplicarPaginaCero`, `aplicarPaginaSiguiente`, `aplicarRespuestaPropia` |
| `components/publico/MuroComentarios.tsx` | Poll 60 s con `visibilitychange`, estado `EstadoMuro`, `catch` en cargas, recarga por fusión, 403 ⇒ parar + refresh |
| `components/publico/HiloComentario.tsx` | Respuestas desde props; `onRespuestaPublicada`; pasa `destinatarioId` |
| `components/publico/RespuestaForm.tsx` (+ `formularios-vista-previa.test.ts`) | `aria-describedby` + `aria-live`; foco al cambiar de destinatario (`destinatarioId`) |
| `components/publico/useRefrescoSiSeccionApagada.ts` | Creado: hook 403 ⇒ `router.refresh()` una vez |
| `components/publico/MinutoAMinuto.tsx` | 403 en el poll ⇒ `clearInterval` + refresh |
| `lib/retos/config.ts` (+ test) | `esRespuestaDeSeccionApagada` |
| `lib/retos/modo-inicio.ts` (+ test) | Creado: `modosDeInicioPermitidos`, `MENSAJE_GUIADO_SIN_RUTA` |
| `app/[slug]/admin/actions.ts` (+ test) | `iniciarReto` rechaza guiado sin ruta; `cambiarOcultoDeComentarioPublico` (filtro `visibilidad`, `.select("id")`) |
| `components/admin/ActividadAcciones.tsx`, `SeccionActividad.tsx` | Prop `modosDeInicio`; sin "Guiado" si no hay ruta |
| `lib/envio/uuid.ts` (+ test) | Creado: `generarUuidV4`, `uuidV4DesdeBytes` |
| `components/admin/ComposerMinutoAMinuto.tsx` | Usa `generarUuidV4()` |
| `lib/retos/instagram.ts` (+ test) | Rechaza el dominio como usuario; admite `m.` |
| `docs/tecnico/{decisiones-tecnicas,arquitectura}.md`, `CHANGELOG.md`, `DEBT.md` | Actualizados (3 entradas RESUELTAS, 3 parciales, 2 nuevas) |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 762 tests en verde (59 ficheros)
- `pnpm build`: OK

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **Orden por `created_at desc, id desc` al fusionar** (no "nuevas delante + resto"): coincide con la API y deja bien colocadas también las raíces del hueco si entran más de 20 en un minuto.
2. **Paginación como unión `sin-cargar | mas | fin`**: el poll no reabre "Cargar más" con todo cargado, salvo que la página 0 llegue llena sin ninguna raíz conocida (hueco).
3. **El poll solo añade**: una raíz ocultada o borrada sigue en el muro abierto hasta recargar (no se quita nada bajo el dedo del visitante).
4. **La recarga tras publicar usa la misma fusión**: ya no descarta las páginas extra cargadas.
5. **Al volver a la pestaña se sondea en el acto** y luego se reanuda el intervalo.
6. **Poll también en "llegada"**: el muro se monta ahí (felicitaciones) y no había motivo para excluirlo.
7. **Mensajes de ocultar/mostrar/iniciar se lanzan** (contrato `void` de esas actions): en producción Next los redacta, pero la interfaz ya no permite llegar a esos casos. Mensaje de mostrar: "No se puede mostrar un mensaje privado."
8. **`destinatarioId`** en `RespuestaForm` para detectar el cambio de destinatario aunque dos personas se llamen igual; `aria-live="polite"` en "Respondiendo a …" para anunciar el cambio.
9. **Instagram:** sin reglas de puntos (fuera del alcance pedido; queda en DEBT).

## Historial de revisión

### Reviewer — ciclo 1 (2026-09-30): APROBADO, pasa a Seguridad

- Sin bloqueantes. Revisados: fusión (idempotente, sin duplicados local/poll, conserva páginas y respuestas locales, misma referencia si no cambia), estado de respuestas en `MuroComentarios` + `HiloComentario` por props (plegado, `respondiendoA` por id, `key` estable), limpieza de intervalo y listener de `visibilitychange`, `router.refresh()` una sola vez por ref (sin bucle), vista previa sin poll, `iniciarReto`, ocultar/mostrar, UUID, Instagram y `RespuestaForm`.
- Arreglo de docs del Reviewer: comentario obsoleto en `app/[slug]/api/minuto-a-minuto/route.ts` ("no hay polling que cortar").
- Recomendaciones registradas en `DEBT.md`: 403 en carga inicial/recarga del muro no atendido (nueva). Ya existían: tests de interacción del cableado de polls y poll del minuto a minuto con pestaña oculta.

## Verificación en navegador

- **No hecha:** no hay `.env` local con Supabase ni navegador en este entorno.
- **Pendiente en preview:** muro con dos pestañas (comentario/respuesta en una aparece en la otra en ≤ 60 s; con la pestaña oculta no hay peticiones en Network; al volver, petición inmediata); respuesta a medio escribir que sobrevive a un poll; apagar comentarios / minuto a minuto desde el admin con la web abierta ⇒ la sección desaparece sola; reto sin ruta sin botón "Guiado"; panel por `http://<ip-lan>:3000` publicando en el minuto a minuto.
