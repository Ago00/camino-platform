# Tarea en curso — FP1: Routing multi-tenant

## Decisión técnica

**DT-026** (`docs/tecnico/decisiones-tecnicas.md`). Slug nesting completo: web pública y admin bajo `app/[slug]/`, APIs públicas bajo `app/[slug]/api/`. `track` y `admin/login` quedan en `app/api/`. `slug → reto_id` mediante helper `obtenerRetoPorSlug` con `React.cache()`. Raíz `/` redirige estáticamente a `/portuguesa-110` para FP1.

## Alcance exacto de FP1

### 1. Nuevo helper de resolución de slug

**`lib/supabase/retos.ts`** (nuevo):
- `obtenerRetoPorSlug(slug: string): Promise<Reto | null>` — consulta `SELECT * FROM retos WHERE slug = $slug LIMIT 1`
- Envuelto en `React.cache()` para deduplicar dentro del render tree de un mismo request
- Devuelve `null` si el slug no existe (no lanza); el caller hace `notFound()` si lo necesita
- Test unitario: `lib/supabase/retos.test.ts` — mismo patrón que `admin.test.ts` (vi.stubEnv + Supabase mockeado)

### 2. Layout de slug con 404

**`app/[slug]/layout.tsx`** (nuevo):
- Server Component; llama `obtenerRetoPorSlug(params.slug)`
- Si devuelve `null` → `notFound()`

### 3. Web pública

**`app/[slug]/page.tsx`** (movido de `app/page.tsx`):
- Recibe `params: { slug: string }`
- Sustituye todos los `"portuguesa-110"` hardcodeados por `reto.ruta_id` (de `obtenerRetoPorSlug`)
- Elimina los `// FP1:` comments de `calcularProgresoDelIntento` y `cargarTrazaDeMapa`
- Pasa `slug` como prop a los componentes cliente que hacen fetch

**`app/page.tsx`** (modificado):
```ts
import { redirect } from 'next/navigation';
// FP2: redirigir al reto activo desde Supabase cuando existan múltiples retos
export default function Home() { redirect('/portuguesa-110'); }
```

### 4. Panel admin

**`app/[slug]/admin/page.tsx`** (movido de `app/admin/page.tsx`):
- Recibe `params: { slug: string }`
- Sin cambios de contenido — la UI es idéntica
- El redirect de sesión inválida va a `/admin/login?returnTo=/${slug}/admin/`

**`app/[slug]/admin/actions.ts`** (movido de `app/admin/actions.ts`):
- Cada action añade `slug: string` como primer parámetro
- `revalidarAdmin()` usa `revalidatePath(\`/${slug}/admin\`)`
- `reto_id` se resuelve con `(await obtenerRetoPorSlug(slug))!.id` antes de cualquier insert
- Elimina todos los `reto_id: 1` y los `// FP1:` comments

### 5. API routes bajo slug

Cinco archivos movidos. Para cada uno:
- Recibe `params: { slug: string }` en la firma del handler
- Llama `obtenerRetoPorSlug(params.slug)` para obtener `reto_id`
- Sustituye `reto_id: 1` hardcodeado por el valor resuelto
- Elimina los `// FP1:` comments

| Origen | Destino |
|---|---|
| `app/api/comentarios/route.ts` | `app/[slug]/api/comentarios/route.ts` |
| `app/api/intenciones/route.ts` | `app/[slug]/api/intenciones/route.ts` |
| `app/api/progreso/route.ts` | `app/[slug]/api/progreso/route.ts` |
| `app/api/fase/route.ts` | `app/[slug]/api/fase/route.ts` |
| `app/api/minuto-a-minuto/route.ts` | `app/[slug]/api/minuto-a-minuto/route.ts` |

### 6. `app/api/track/route.ts` — resolución desde intento activo

El endpoint se queda en `/api/track` (URL configurada en OwnTracks). El `reto_id` se obtiene del intento activo ya consultado:

```ts
// Añadir "reto_id" al select del intento activo que ya se hace en el handler
const retoId = intentoActivo.reto_id;
```

No necesita slug en la URL porque siempre opera sobre el único intento activo (`cerrado = false`).

### 7. `proxy.ts` — nuevo matcher y lógica de slug

```ts
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|maplibre-gl-worker).*)"],
};
```

Lógica interna:
- `pathname === '/'` → pass-through (Next.js hace el redirect desde `app/page.tsx`)
- `pathname.match(/^\/[^\/]+\/admin/)` → `proxyAdmin` (protege `/:slug/admin/:path*`)
- En otro caso → `proxyPublico` (captura visita para `/:slug`)

`registrarVisita`: extrae slug de `pathname.split('/')[1]`, llama `obtenerRetoPorSlug(slug)`. Si null → silencio (nunca rompe la carga de página).

### 8. Login page — `returnTo`

**`app/admin/login/page.tsx`** (modificado):
- Tras login exitoso, lee `searchParams.returnTo` y redirige allí
- Default si `returnTo` está ausente: `/portuguesa-110/admin/`
- Valida que `returnTo` empiece por `/` y no sea URL externa (open redirect básico)

### 9. Client components — slug prop

| Componente | Antes | Después |
|---|---|---|
| `RefrescoAlCambiarFase` | `/api/fase` | `/${slug}/api/fase` |
| `ModoDurante` | `/api/progreso` | `/${slug}/api/progreso` |
| `ModoDuranteLibre` | `/api/progreso` | `/${slug}/api/progreso` |
| `MuroComentarios` | `/api/comentarios` | `/${slug}/api/comentarios` |
| `ComentarioForm` | `/api/comentarios` | `/${slug}/api/comentarios` |
| `IntencionForm` | `/api/intenciones` | `/${slug}/api/intenciones` |
| `MinutoAMinuto` | `/api/minuto-a-minuto` | `/${slug}/api/minuto-a-minuto` |

El `slug` llega como prop desde el server component padre (`app/[slug]/page.tsx`).

### 10. Archivos a eliminar (tras crear los equivalentes bajo `[slug]`)

- `app/api/comentarios/route.ts`
- `app/api/intenciones/route.ts`
- `app/api/progreso/route.ts`
- `app/api/fase/route.ts`
- `app/api/minuto-a-minuto/route.ts`
- `app/admin/page.tsx`
- `app/admin/actions.ts`

### 11. Quality gates

- `pnpm typecheck` — 0 errores
- `pnpm test` — en verde
- `pnpm build` — build limpio
- Verificación visual: cargar `/:slug/` y `/:slug/admin/` en el browser

## Qué NO hace FP1

- No crea UI nueva
- No implementa `/superadmin` (FP2)
- No actualiza caches para keying multi-reto (deuda registrada en DEBT.md al cerrar)
- No cambia la URL de OwnTracks

## Archivos a crear/modificar/eliminar

**Nuevos:**
- `lib/supabase/retos.ts`
- `lib/supabase/retos.test.ts`
- `app/[slug]/layout.tsx`
- `app/[slug]/page.tsx`
- `app/[slug]/admin/page.tsx`
- `app/[slug]/admin/actions.ts`
- `app/[slug]/api/comentarios/route.ts`
- `app/[slug]/api/intenciones/route.ts`
- `app/[slug]/api/progreso/route.ts`
- `app/[slug]/api/fase/route.ts`
- `app/[slug]/api/minuto-a-minuto/route.ts`

**Modificados:**
- `app/page.tsx`
- `proxy.ts`
- `proxy.test.ts` (actualizado para slug-based routing)
- `app/admin/login/page.tsx`
- `app/api/track/route.ts`
- `components/publico/RefrescoAlCambiarFase.tsx`
- `components/publico/ModoDurante.tsx`
- `components/publico/ModoDuranteLibre.tsx`
- `components/publico/MuroComentarios.tsx`
- `components/publico/ComentarioForm.tsx`
- `components/publico/IntencionForm.tsx`
- `components/publico/MinutoAMinuto.tsx`
- `components/publico/ModoAntes.tsx` (slug prop añadido — IntencionForm y ComentarioForm internos)
- `components/publico/ModoLlegada.tsx`
- `components/publico/ModoLlegadaLibre.tsx`
- `components/admin/BotonCerrarSesion.tsx`
- `components/admin/AccionesComentario.tsx`
- `components/admin/EliminarIntencionBoton.tsx`
- `components/admin/DescartarPosicionBoton.tsx`
- `components/admin/CampoTexto.tsx`
- `components/admin/CrearPrimerIntentoBoton.tsx`
- `components/admin/EntradaMinutoAMinuto.tsx`
- `components/admin/ComposerMinutoAMinuto.tsx`
- `components/admin/ModalFinalizar.tsx`
- `components/admin/ActividadAcciones.tsx`
- `components/admin/SeccionActividad.tsx`
- `components/admin/SeccionComentarios.tsx`
- `components/admin/SeccionIntenciones.tsx`
- `components/admin/SeccionPosicion.tsx`
- `components/admin/SeccionMinutoAMinuto.tsx`
- `components/admin/SeccionTextos.tsx`
- `components/admin/SeccionTrafico.tsx`

**Eliminados:**
- `app/api/comentarios/route.ts` + `route.test.ts`
- `app/api/intenciones/route.ts` + `route.test.ts`
- `app/api/progreso/route.ts` + `route.test.ts`
- `app/api/fase/route.ts` + `route.test.ts`
- `app/api/minuto-a-minuto/route.ts` + `route.test.ts`
- `app/admin/page.tsx` + `page.test.ts`
- `app/admin/actions.ts` + `actions.test.ts`
- `app/page.test.ts`

## Quality gates

- `pnpm typecheck`: 0 errores ✓
- `pnpm lint`: 0 errores, 0 warnings ✓
- `pnpm test`: 300/300 passing ✓

## Historial de revisión

2026-09-29 — Implementación completada por Implementador. Listo para Reviewer.

2026-09-29 — Revisión completada por Reviewer. Veredicto: APROBADO. Sin bloqueantes. Dos recomendaciones registradas en DEBT.md:
  - `GET /[slug]/api/comentarios` no filtra por `reto_id` (inocuo en FP1, riesgo en FP2).
  - `calcularProgresoActual()` y `datos-mapa-admin.ts` hardcodean `"portuguesa-110"` (marcadores `// FP1:` en ficheros fuera del scope de modificación de FP1).
Pasa a Agente de Seguridad.
