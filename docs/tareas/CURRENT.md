# Tarea en curso — FP2: Superadmin y gestión de retos

## Decisión técnica

**DT-027** (`docs/tecnico/decisiones-tecnicas.md`). Panel `/superadmin` con auth propia paralela al admin (módulo `lib/auth/superadmin-session.ts`, cookie `superadmin_session`, env var `SUPERADMIN_PASSWORD`, secreto de firma compartido con `ADMIN_SESSION_SECRET`). CRUD de retos en `app/superadmin/actions.ts`. `app/page.tsx` pasa a ser server component que lista retos `activo = true`. Proxy protege `/superadmin/*` igual que ya protege `/:slug/admin/*`.

## Alcance exacto de FP2

### 1. Módulo de sesión del superadmin

**`lib/auth/superadmin-session.ts`** (nuevo):
- Espeja `lib/auth/admin-session.ts` en su totalidad
- `NOMBRE_COOKIE_SUPERADMIN_SESION = "superadmin_session"`
- `crearSesionSuperadmin()` y `verificarSesionSuperadmin()`
- Firma HMAC con `ADMIN_SESSION_SECRET`
- Test: `lib/auth/superadmin-session.test.ts` — mismos casos que `admin-session.test.ts`

### 2. API de login del superadmin

**`app/api/superadmin/login/route.ts`** (nuevo):
- Espeja `app/api/admin/login/route.ts`
- Lee `process.env.SUPERADMIN_PASSWORD`
- Fija cookie `superadmin_session` con `crearSesionSuperadmin()`
- Mismo rate limiting
- Test: `app/api/superadmin/login/route.test.ts`

### 3. Página de login del superadmin

**`app/superadmin/login/page.tsx`** (nuevo):
- Espeja `app/admin/login/page.tsx`
- Llama a `/api/superadmin/login`
- `returnTo` por defecto: `/superadmin`

### 4. Layout del superadmin

**`app/superadmin/layout.tsx`** (nuevo):
- Server Component
- Verifica `superadmin_session` con `verificarSesionSuperadmin()`
- Si inválida: `redirect('/superadmin/login')`

### 5. `lib/supabase/retos.ts` — nuevas funciones

**Añadir:**
- `listarRetosActivos(): Promise<Reto[]>` — `WHERE activo = true ORDER BY created_at DESC`; para `app/page.tsx`
- `listarTodosLosRetos(): Promise<Reto[]>` — `ORDER BY created_at DESC`; para `app/superadmin/page.tsx`
- Ambas usan cliente público (no admin)

### 6. Panel del superadmin

**`app/superadmin/page.tsx`** (nuevo):
- Server Component
- Llama a `listarTodosLosRetos()` — lista todos (activos e inactivos)
- Por cada reto: slug (inmutable), nombre, ruta_tipo, activo (badge), botones Editar / Eliminar
- Formulario "Crear reto nuevo": slug, nombre, descripción, ruta_tipo, ruta_id
- Botón "Cerrar sesión"
- Estilo funcional idéntico al admin normal

### 7. Server Actions del superadmin

**`app/superadmin/actions.ts`** (nuevo):

Función interna `requerirSesionSuperadmin()` — lanza si sesión inválida.

**`crearReto(formData: FormData)`**:
- Valida con zod: slug (`^[a-z0-9-]+$`, max 60), nombre (1-100), descripcion, ruta_tipo, ruta_id (requerido si predefinida)
- INSERT en `retos` con `activo: true`
- Captura `id` del reto creado
- INSERT en `intentos` con `{ fase: "antes", reto_id: id }`
- `revalidatePath('/superadmin')` + `revalidatePath('/')`

**`editarReto(id: number, formData: FormData)`**:
- Mismas validaciones (sin slug — inmutable)
- UPDATE `retos WHERE id = $id`
- `revalidatePath('/superadmin')` + `revalidatePath('/')` + `revalidatePath('/', 'layout')`

**`eliminarReto(id: number)`**:
- DELETE `retos WHERE id = $id` (cascada en BD)
- `revalidatePath('/superadmin')` + `revalidatePath('/')`

**`cerrarSesionSuperadmin()`**:
- `cookies().delete(NOMBRE_COOKIE_SUPERADMIN_SESION)`

### 8. `proxy.ts` — rama superadmin

**Añadir** antes de `proxyPublico`:
```ts
if (pathname === '/superadmin' || pathname.startsWith('/superadmin/')) {
  return proxySuperAdmin(request);
}
```

**`proxySuperAdmin()`**: misma lógica que `proxyAdmin` pero con `superadmin_session` y redirect a `/superadmin/login`. No registra visita.

### 9. `app/page.tsx` — listado dinámico

- Server Component (eliminar el `redirect` estático)
- Llama a `listarRetosActivos()`
- Si vacío: "No hay retos activos en este momento."
- Si hay retos: lista con links `<a href="/${reto.slug}">{reto.nombre}</a>`

### 10. Migración de BD

Verificar que las FK de `retos.id` en las tablas hijas tienen `ON DELETE CASCADE`. Si no, crear `supabase/migrations/0008_cascade_delete.sql`. Confirmar contra Supabase antes de cerrar la tarea.

### 11. Nueva env var de producción

- `SUPERADMIN_PASSWORD` — en Vercel, sin `NEXT_PUBLIC_`

## Archivos a crear

| Archivo | Tipo |
|---|---|
| `lib/auth/superadmin-session.ts` | Nuevo |
| `lib/auth/superadmin-session.test.ts` | Nuevo |
| `app/api/superadmin/login/route.ts` | Nuevo |
| `app/api/superadmin/login/route.test.ts` | Nuevo |
| `app/superadmin/login/page.tsx` | Nuevo |
| `app/superadmin/layout.tsx` | Nuevo |
| `app/superadmin/page.tsx` | Nuevo |
| `app/superadmin/actions.ts` | Nuevo |

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `lib/supabase/retos.ts` | Añadir `listarRetosActivos` y `listarTodosLosRetos` |
| `proxy.ts` | Añadir rama `/superadmin/*` con `proxySuperAdmin()` |
| `app/page.tsx` | Listado dinámico de retos activos |

## Archivos sin cambios

- `lib/types.ts`, `lib/auth/admin-session.ts`, `app/[slug]/admin/actions.ts`

## Quality gates

- `pnpm typecheck` — 0 errores
- `pnpm lint` — 0 errores
- `pnpm test` — todos en verde
- `pnpm build` — build limpio
- Verificar migración cascade delete en Supabase real
- Verificación manual: `/` lista retos, `/superadmin` redirige al login, login funciona, CRUD operativo

## Qué NO hace FP2

- No cambia el panel admin normal
- No añade paginación al listado de retos en superadmin
- No actualiza caches para multi-reto (deuda FP1)

## Archivos creados/modificados

| Archivo | Estado |
|---|---|
| `lib/auth/superadmin-session.ts` | Creado |
| `lib/auth/superadmin-session.test.ts` | Creado (12 tests) |
| `app/api/superadmin/login/route.ts` | Creado |
| `app/api/superadmin/login/route.test.ts` | Creado (10 tests) |
| `app/superadmin/login/page.tsx` | Creado |
| `app/superadmin/(panel)/layout.tsx` | Creado (route group para evitar redirect circular) |
| `app/superadmin/(panel)/page.tsx` | Creado |
| `app/superadmin/(panel)/actions.ts` | Creado |
| `app/superadmin/(panel)/BotonEliminarReto.tsx` | Creado (client component para confirmación) |
| `lib/supabase/retos.ts` | Modificado: añadidas `listarRetosActivos` y `listarTodosLosRetos` |
| `lib/supabase/retos.test.ts` | Modificado: añadidos tests para las nuevas funciones (+6 tests) |
| `proxy.ts` | Modificado: añadida rama `/superadmin/*` con `proxySuperAdmin()` |
| `app/page.tsx` | Modificado: listado dinámico de retos activos |
| `supabase/migrations/0008_cascade_delete.sql` | Creado |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores
- `pnpm test`: 328 tests en verde (32 ficheros)
- Migración `0008_cascade_delete.sql`: creada, pendiente de aplicar en Supabase

## Decisiones de implementación (bloqueos menores resueltos)

1. **Route group en lugar de `app/superadmin/layout.tsx`**: el spec indicaba crear el layout directamente en `app/superadmin/layout.tsx`, pero ese layout habría envuelto también `/superadmin/login`, causando un redirect circular. Se usó el patrón Next.js de route groups: `app/superadmin/(panel)/layout.tsx` protege solo el panel, dejando el login fuera del grupo. La URL `/superadmin` no cambia.

2. **`listarTodosLosRetos` usa cliente admin**: la spec decía "ambas usan cliente público", pero la política RLS de `retos` bloquea retos inactivos al rol anon. `listarTodosLosRetos` necesita verlos para el panel superadmin; se usa el cliente admin. Registrado en DEBT.md.

3. **`proxySuperAdmin` excluye `/superadmin/login`**: para evitar bucle de redirect, el proxy no verifica sesión si el pathname es `/superadmin/login` — pasa directamente a Next.js.

## Historial de revisión

### Ronda 1 — Reviewer (2026-09-29)

**Veredicto: BLOQUEANTE**

Bloqueante: `docs/tecnico/decisiones-tecnicas.md` — DT-027 no documentaba las dos desviaciones de implementación (route group `(panel)` y cliente admin en `listarTodosLosRetos`). Violación de la regla de LESSONS.md sobre desviaciones conscientes.

### Ronda 2 — Reviewer (2026-09-29)

**Veredicto: APROBADO**

Bloqueante resuelto. La sección "Desviaciones de implementación" añadida al final de DT-027 documenta ambas desviaciones con contexto completo. La lista de archivos en "Estructura de archivos resultante" también fue corregida para reflejar el route group real. No quedan bloqueantes.
