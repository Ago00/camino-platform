# Tarea en curso — FP3b: "Minuto a minuto" plegable en la web pública

> El contenido anterior (FP3a, respuestas en hilo) se archivó en
> `docs/tareas/historico/2026-09-30-fp3a-respuestas-comentarios.md`.

## Prompt clarificado (producto cerrado)

Se pliega la sección entera del "minuto a minuto" (pulsar una entrada sigue marcando su punto en el mapa). Abierta en fase "durante", plegada en "llegada". Sin persistir la elección. Plegada, si llegan entradas nuevas por polling, aviso en la cabecera ("1 nueva" / "{n} nuevas"); al desplegar vuelve a 0. El punto marcado en el mapa se mantiene al plegar.

Incluye fix aprobado: con el feed vacío el polling no preguntaba nunca, así que en "durante" la primera entrada no aparecía hasta recargar.

## Decisión técnica

**DT-031** (`docs/tecnico/decisiones-tecnicas.md`). Estado `plegado` + `ultimoVistoId` en `MinutoAMinuto.tsx`, `contarNuevas` puro, región siempre montada con `aria-controls`, aviso `aria-live`, animación altura 0↔auto con `MotionConfig reducedMotion="user"`, polling sin cambios de cadencia. Fix: `despuesDeId=0` con el feed vacío.

## Archivos creados/modificados (Implementador)

| Archivo | Estado |
|---|---|
| `lib/minuto-a-minuto/contar-nuevas.ts` (+ `.test.ts`) | Creado: `contarNuevas(entradas, ultimoVistoId)` |
| `lib/minuto-a-minuto/polling.ts` (+ `.test.ts`) | Creado: `construirUrlPolling(slug, masRecienteId)`, `fusionarSinDuplicados(primero, despues)` |
| `components/publico/MinutoAMinuto.tsx` | Prop `plegadoInicial`; cabecera con botón Mostrar/Ocultar y aviso; región plegable; poll con feed vacío; fila extraída a `FilaEntrada` |
| `components/publico/ModoLlegada.tsx`, `ModoLlegadaLibre.tsx` | Pasan `plegadoInicial` |
| `lib/textos/defaults.ts` | 4 claves: `minuto_a_minuto_boton_mostrar`, `_boton_ocultar`, `_aviso_nueva`, `_aviso_nuevas` |
| `components/admin/SeccionTextos.tsx` | Comentario desfasado ("las 6 claves") corregido |
| `docs/tecnico/decisiones-tecnicas.md` | DT-031 |
| `docs/tecnico/arquitectura.md` | `lib/minuto-a-minuto/` y nota en `MinutoAMinuto.tsx` |
| `CHANGELOG.md`, `DEBT.md` | Actualizados |

`app/[slug]/api/minuto-a-minuto/route.ts` sin cambios: `despuesDeId` ya admite 0 (`min(0)`) y los ids empiezan en 1.

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 453 tests en verde (41 ficheros)
- `pnpm build`: OK
- **Verificación visual pendiente** (LESSONS: UI y componentes cliente): no la ha hecho el Implementador. Comprobar en navegador: "durante" abierto y "llegada" plegado; toggle animado (y sin animación con reduced motion); aviso "1 nueva"/"N nuevas" con la sección plegada tras publicar desde el admin, y a 0 al desplegar; punto del mapa conservado al plegar; primera entrada de un feed vacío apareciendo sin recargar (≤ 30 s).

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **Fix del feed vacío con `despuesDeId=0`** en vez de otro parámetro u `offset=0`: reutiliza el camino del poll y no toca la API ni el estado de paginación.
2. **`ultimoVistoId` = 0 (no null) al plegar con el feed vacío**, para que la primera entrada sí genere el aviso. `ultimoVistoId` también se fija al cargar la página 0, así la carga inicial nunca cuenta como nueva.
3. **Fix relacionado: "Cargar más" deduplica por id** (`fusionarSinDuplicados`). La paginación es por offset: tras entradas añadidas por el poll, la página siguiente repetía filas (claves duplicadas). El poll también fusiona sin duplicar.
4. **Fila extraída a `FilaEntrada`** (mismo fichero) para mantener legible el JSX anidado en la región.

## Pendiente operativo tras el merge

- Verificación visual en preview.
- Invocar al Agente de Producto para `docs/producto/` (registrado en DEBT).

## Historial de revisión

### Reviewer — 2026-09-30 — APROBADO (pasa a Seguridad)

Sin bloqueantes. Comprobado:
- Estado `ultimoVistoId`/`nuevas`: correcto en plegar antes de la carga inicial (0 y luego la página 0 lo fija), en páginas antiguas de "Cargar más" (no cuentan) y en tandas acumuladas de poll.
- Carreras: poll vs página 0 se autocorrige (el siguiente poll recupera lo que la sustitución de la página 0 pudiera tirar); poll solapado consigo mismo y "Cargar más" desplazado deduplican por id; el offset desplazado no salta filas (solo repite, y se deduplica). Intervalo limpiado en el cleanup (`[polling, slug]`).
- Fix feed vacío: 1 petición cada 30 s por visitante mientras el feed está vacío (antes 0), igual cadencia que con feed lleno; no hay recargas duplicadas. Solo en "durante" (en "llegada" `polling=false`).
- Reduced motion: en motion-dom 12.43 `height` está en `positionalKeys`, así que con `reducedMotion="user"` la altura cambia al instante; solo se mantiene el fundido de opacidad (aceptable).
- Docs (CHANGELOG, DEBT, DT-031, arquitectura) coherentes.

Recomendaciones registradas en `DEBT.md`: contexto a11y del botón y del aviso; `cargarPagina` sin `catch` y respuestas sin Zod (previo).
Sigue pendiente la verificación visual en navegador antes del cierre.
