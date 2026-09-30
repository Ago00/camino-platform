# Tarea en curso — Vista previa en el admin, peregrino opcional, Instagram en Configuración y URL del GPS con token

> El contenido anterior (endurecimiento pre-reto y lote de feedback) se archivó en
> `docs/tareas/historico/2026-09-30-endurecimiento-y-feedback.md`.

## Prompt clarificado (aprobado por el orquestador)

A) **Vista previa en el admin:** pestaña que enseña la web y deja elegir Antes/Durante/Llegada con la configuración actual.
B) **Interruptor del peregrino animado** (`retos.peregrino_animado`, migración `0015`).
C) **Instagram editable en Configuración** (normalizado; fuera de la pestaña Textos; `guardarTexto` rechaza la clave; la web solo pinta perfiles válidos).
D) **URL completa del GPS con token en el superadmin** (oculta, "Mostrar"/"Copiar", aviso sin `TRACK_TOKEN`).

## Decisión técnica

**DT-034** (`docs/tecnico/decisiones-tecnicas.md`), con notas de cierre de las desviaciones.

## Archivos creados/modificados (Implementador)

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0015_peregrino_animado.sql` | Creado (aplicado por el orquestador) |
| `components/publico/WebReto.tsx` | Creado: composición de la web movida desde `app/[slug]/page.tsx` (+ `FuenteDatosWeb`, `obtenerIntentoActivo`, datos de ejemplo) |
| `components/publico/VistaPrevia.tsx` | Creado: `VistaPreviaProvider` / `useVistaPrevia` |
| `app/[slug]/page.tsx` (+ `page.test.ts` nuevo) | Mínima: delega en `WebReto` |
| `app/[slug]/admin/vista-previa/page.tsx` (+ `page.test.ts`) | Creada: sesión, `noindex`, `?fase=` con `esFaseWeb`, real vs ejemplo |
| `components/admin/SeccionVistaPrevia.tsx` | Creado: selector de fase local, iframe 390×780, "Recargar" |
| `app/[slug]/admin/page.tsx` | Pestaña "Vista previa" |
| `lib/vista-previa/{datos-ejemplo,fuente,envio}.ts` (+ tests) | Creados (puros) |
| `components/publico/{IntencionForm,ComentarioForm,RespuestaForm}.tsx` (+ `formularios-vista-previa.test.ts`) | Sin envío en vista previa (`envioPermitido`) + aviso |
| `components/publico/{ModoDurante,ModoDuranteLibre,MinutoAMinuto}.tsx` | Sin polling en vista previa; `entradasMinutoAMinutoIniciales` |
| `components/publico/RefrescoAlCambiarFase.tsx` | Comentario de cabecera |
| `lib/types.ts` | `Reto.peregrino_animado`; `EntradaMinutoAMinutoPublica` (movido desde `MinutoAMinuto.tsx`, que lo reexporta) |
| `lib/retos/config.ts` (+ test) | `peregrino_animado ?? true`; `urlInstagramVisible` exige perfil válido |
| `lib/retos/instagram.ts` (+ test) | Creado: `normalizarPerfilInstagram`, `esUrlPerfilInstagram` |
| `components/publico/EnlaceInstagram.tsx` | Solo pinta perfiles válidos |
| `lib/textos/bloques.ts` (+ test) | Bloque "Instagram" fuera; `CLAVES_TEXTO_GESTIONADAS_EN_CONFIGURACION` |
| `app/[slug]/admin/actions.ts` (+ test) | zod con `peregrino_animado`; `guardarTexto` rechaza la clave de Instagram; `guardarInstagram` nueva |
| `components/admin/{FormConfiguracion,SeccionConfiguracion}.tsx` | Interruptor "Peregrino animado" y campo "Perfil de Instagram" |
| `lib/supabase/admin.ts` | `peregrino_animado` opcional en el `Insert` de `retos` |
| `lib/admin/navegacion.ts` (+ test) | Pestaña `vistaprevia`, `esFaseWeb` |
| `lib/superadmin/url-tracker.ts` (+ test) | Creado: URL del tracker con y sin token |
| `app/superadmin/(panel)/page.tsx`, `UrlTrackerConToken.tsx` (nuevo) | URL completa con token; sesión verificada en la página antes de leer `TRACK_TOKEN` |
| Fixtures `Reto` en `app/api/track`, `app/api/admin/login`, `app/[slug]/api/{comentarios,intenciones,minuto-a-minuto}` (tests) | `peregrino_animado: true` |
| `docs/tecnico/{decisiones-tecnicas,modelo-datos,arquitectura}.md`, `CHANGELOG.md`, `DEBT.md` | Actualizados (DT-034; 4 entradas nuevas de DEBT, 1 retocada) |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 691 tests en verde (55 ficheros)
- `pnpm build`: OK (nueva ruta dinámica `/[slug]/admin/vista-previa`)

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **Acción `guardarInstagram`** aparte (el plan dejaba elegir). El botón único de Configuración valida el perfil antes de enviar nada y llama a cada acción solo si su parte cambió.
2. **`esUrlPerfilInstagram` tolerante** con `www.`, barra final, query y `http`: los valores antiguos válidos se siguen viendo.
3. **Llegada de ejemplo al 100 %**, "durante" al 42 %.
4. **`EntradaMinutoAMinutoPublica` a `lib/types.ts`**: para que `lib/` no importe tipos de un componente.
5. **Sesión del superadmin verificada también en la página** (el layout no basta según la guía de Next 16; la página lleva el token).
6. **Test de formularios con `renderToString`**: no hay DOM en los tests; se comprueba el aviso y la regla pura. El test de interacción queda en DEBT.
7. **En la vista previa con datos reales en "durante"** siguen las lecturas GET normales (primera página del minuto a minuto y muro), como dice el plan; lo que no hay es polling.

## Verificación en navegador

- **No hecha:** sigue sin haber `.env` local con Supabase (ver tarea anterior) y no tengo navegador en este entorno.
- **Pendiente en preview:** pestaña "Vista previa" en las tres fases (sin recargas en bucle, formularios con el aviso, mapa y minuto a minuto de ejemplo); interruptor del peregrino (tras aplicar `0015`); perfil de Instagram (`@usuario` ⇒ enlace en la web; valor inválido ⇒ error); superadmin: "Mostrar"/"Copiar" de la URL del GPS.

## Pendiente operativo

- ~~Aplicar `0015_peregrino_animado.sql`~~: aplicada por el orquestador.
- Antes de desplegar: comprobar que el valor guardado de `cierre_antes_instagram_url` de `santi-ago` pasa `esUrlPerfilInstagram` (si no, el enlace desaparece de su web; volver a guardarlo desde Configuración).

## Historial de revisión

### Reviewer — ciclo 1 (2026-09-30): APROBADO, pasa a Seguridad

- Sin bloqueantes. Sin shell en el entorno del Reviewer: no se pudo ejecutar `git diff`; la equivalencia de la web pública se comprobó leyendo `WebReto.tsx` contra la historia documentada de la composición y los tests de `app/[slug]/page.test.ts`.
- Recomendaciones registradas en `DEBT.md` ("Recomendaciones de la revisión de DT-034") y deuda previa detectada: "Las llamadas de la web a `/<slug>/api/*` se registran como visitas en Tráfico" (Alta; afecta también a la vista previa).
- Docs corregidos por el Reviewer: recordatorio de `0015` marcado RESUELTO en `DEBT.md`; matiz de visitas en DT-034 A.2; este fichero.
- `docs/producto/` no contradice lo implementado; al cerrar hay que quitar los "(en desarrollo)" de `funcionalidades.md`, `contexto.md`, `roadmap.md` y el "Impacto" de la decisión del peregrino.
