# Tarea en curso — DT-035: token de GPS por reto + QR de OwnTracks

> El contenido anterior (muro en vivo y pendientes menores) se archivó en
> `docs/tareas/historico/2026-09-30-muro-en-vivo-y-menores.md`.

## Prompt clarificado (aprobado por el usuario)

Cada reto tiene su PROPIO token de GPS (desaparece `TRACK_TOKEN` global). El admin de cada reto
(`/<slug>/admin`) y el superadmin pueden verlo, copiarlo y regenerarlo (regenerar invalida el
anterior al instante). Un QR que configura OwnTracks automáticamente, en el admin del reto y en el
superadmin.

## Decisión técnica

DT-035 en `docs/tecnico/decisiones-tecnicas.md` (plan aprobado: tabla `retos_gps` sin políticas,
token en claro de 192 bits en base64url, `/api/track` con 401 único y rate limit por IP + por reto,
acciones que nunca devuelven el token, `ConfigGps` compartido, QR SVG generado en servidor).

## Archivos creados/modificados (Implementador)

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0016_retos_gps.sql` | Creado: tabla `retos_gps` + token para cada reto existente. **Aplicada y verificada** en producción por el orquestador (2026-10-01) |
| `lib/types.ts`, `lib/supabase/admin.ts` | `RetoGps`; tabla `retos_gps` en `BaseDeDatos` (con `Relationships` hacia `retos` para el embed) |
| `lib/supabase/credenciales-gps.ts` (+ test) | Creado: `generarTokenGps`, `obtenerTokenGps`, `listarCredencialesGps`, `obtenerTokenGpsPorSlug`, `guardarTokenGps`, `asignarTokenGpsNuevo` (reintento único ante 23505) |
| `lib/gps/owntracks.ts` (+ test) | Creado: `construirConfigOwnTracks`, `enlaceOwnTracks`, `tidDesdeSlug` |
| `lib/gps/url-tracker.ts` (+ test) | Movido desde `lib/superadmin/`; añade `origenDesdeCabeceras` y `origenDelTracker` |
| `lib/gps/config-gps-servidor.ts` (+ test) | Creado: `obtenerOrigenTracker`, `prepararDatosConfigGps` (URL, enlace y QR SVG) |
| `app/api/track/route.ts` (+ test reescrito) | Token por reto, 401 único, rate limit IP 120/min + reto 40/min, sin `TRACK_TOKEN`; cabecera actualizada |
| `app/[slug]/admin/actions.ts` (+ test) | `regenerarTokenGps(slug)` |
| `app/superadmin/(panel)/actions.ts` (+ test) | `crearReto` genera el token; `regenerarTokenGpsReto(retoId)` |
| `components/gps/ConfigGps.tsx` | Creado: componente cliente compartido |
| `components/admin/SeccionGps.tsx` (+ test) | Creado: pestaña GPS; vuelve a verificar la sesión |
| `lib/admin/navegacion.ts` (+ test), `app/[slug]/admin/page.tsx` | Pestaña "GPS" |
| `app/superadmin/(panel)/page.tsx` (+ test nuevo) | `ConfigGps` por tarjeta; sin `TRACK_TOKEN` |
| `app/superadmin/(panel)/UrlTrackerConToken.tsx` | Eliminado |
| `package.json`, `pnpm-lock.yaml` | `qrcode` + `@types/qrcode` |
| `next.config.ts` | Solo comentario (la CSP no bloquea el QR en `data:`) |
| `docs/tecnico/{decisiones-tecnicas,arquitectura,modelo-datos}.md`, `docs/producto/funcionalidades.md`, `CHANGELOG.md`, `DEBT.md` | Actualizados (DT-035 nuevo; notas en DT-028 y DT-034; DEBT: 2 entradas nuevas, 3 actualizadas) |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 820 tests en verde (65 ficheros)
- `pnpm build`: OK

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **`obtenerTokenGpsPorSlug` devuelve también `rutaId`** (`{ retoId, rutaId, token }`): el filtro geográfico necesita la ruta y así sigue siendo una sola consulta (`retos_gps` con `retos!inner` embebido).
2. **Pestaña propia "GPS"** en el admin (no dentro de Configuración): es una tarea distinta (configurar un dispositivo) y así el token no viaja al navegador cada vez que se abre Configuración.
3. **`SeccionGps` vuelve a llamar a `resolverRetoConSesion`** aunque la página ya lo hizo: la sección lleva el token y no debe depender de quién la monte (consultas deduplicadas con `React.cache`).
4. **`lib/superadmin/url-tracker.ts` pasa a `lib/gps/url-tracker.ts`**: ahora lo usan admin y superadmin; la lectura de cabeceras que vivía en la página del superadmin se extrae a `lib/gps/config-gps-servidor.ts` (lógica pura en `url-tracker.ts`).
5. **QR en SVG** (`qrcode.toString({ type: "svg" })` → data URL), corrección "M". URL y QR solo se pintan tras "Mostrar"; "Abrir en OwnTracks" también.
6. **`ConfigGps` recibe `datos: DatosConfigGps | null`** (en vez de props sueltas): `null` = "Sin token GPS" + "Generar". Añade `urlSinToken` (para enmascarar) y `origenProvisional` (aviso).
7. **Claves de rate limit con prefijo** (`track:ip:`, `track:reto:`): el `Map` de `lib/rate-limit.ts` es compartido y las demás rutas usan la IP a secas.
8. **`crearReto` sigue devolviendo `ok: true` si solo falla el token**, con el aviso en el mensaje ("pulsa «Generar» en su tarjeta").
9. **Slug mal formado ⇒ 401 sin consultar la BD** (no hace falta la comparación ficticia: el formato del slug no es secreto).

## Verificación en navegador

- **No hecha:** no hay `.env` local con Supabase ni navegador en este entorno.
- **Pendiente en preview:** pestaña GPS del admin y tarjetas del superadmin (Mostrar/Ocultar, Copiar, QR visible y escaneable, Regenerar con confirmación, "Sin token GPS" + Generar); escanear el QR con OwnTracks en el móvil (con "Allow external configuration") y comprobar que llega un punto en Posición.

## Despliegue (orden obligatorio)

1. ~~Aplicar `0016_retos_gps.sql` en Supabase de producción.~~ Hecho y verificado (2026-10-01).
2. Desplegar.
3. Reconfigurar el móvil de cada reto con el QR (el `TRACK_TOKEN` deja de valer).
4. Borrar `TRACK_TOKEN` de Vercel.

## Historial de revisión

### Reviewer — 2026-10-01 — Aprobado (pasa a Seguridad)

Sin bloqueantes. `/api/track` conserva intento activo del reto, fallback 0003, modo guiado/libre y filtro
geográfico por `ruta_id`; `TRACK_TOKEN` ya no aparece en código; claves de OwnTracks coinciden con la
documentación oficial; el token solo se lee tras verificar sesión en la propia página/sección.
Recomendaciones (registradas en `DEBT.md`): texto de `ConfigGps` tras regenerar ("QR de abajo" con el QR
vuelto a ocultar). Docs retocadas por el Reviewer: estado de `0016` aplicada (aquí y en `DEBT.md`) y
`TRACK_TOKEN` marcada obsoleta en `docs/producto/roadmap.md`.
