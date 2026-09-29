# Tarea en curso — FP2.6: Contraseña de admin propia por reto

> El contenido anterior (FP2.5, aislamiento por reto) se archivó en
> `docs/tareas/historico/2026-09-29-fp2-5-aislamiento-por-reto.md`.

## Decisión técnica

**DT-029** (`docs/tecnico/decisiones-tecnicas.md`). Hash scrypt por reto en la tabla `retos_admin` (migración 0010, sin políticas RLS). Cookie `admin_session` firma `{r, s, v, exp}` (v = huella del hash; invalidación opción B). Proxy: firma + exp + slug, sin BD, renovando r/s/v. Página del panel y cada Server Action: verificación completa con `resolverRetoConSesion(slug)`. Login `{slug, password}` con respuesta 401 única y verificación siempre ejecutada (`HASH_SENTINELA`). `ADMIN_PASSWORD` obsoleta. Superadmin fija la contraseña (obligatoria al crear, opcional al editar).

## Archivos creados/modificados (Implementador)

| Archivo | Estado |
|---|---|
| `supabase/migrations/0010_retos_admin.sql` | Creado (NO aplicado) — `retos.id` es `bigint` identity en 0007, se mantiene `bigint` |
| `lib/auth/password.ts` (+ `password.test.ts`) | Creado: `hashearPassword`, `verificarPassword`, `huellaCredencial`, `HASH_SENTINELA` |
| `lib/supabase/credenciales-admin.ts` | Creado: `obtenerHashAdmin` (React.cache), `guardarHashAdmin`, `listarRetosConCredencial` |
| `lib/auth/sesion-admin-servidor.ts` | Creado: `resolverRetoConSesion(slug)` |
| `lib/auth/admin-session.ts` (+ test reescrito) | `crearSesion(reto, huella)`, `renovarSesion`, `verificarSesionEnProxy`, `verificarSesion(cookie, reto, huella)`; payload validado con zod |
| `lib/types.ts`, `lib/supabase/admin.ts` | Tipo `RetoAdmin` y tabla `retos_admin` en `BaseDeDatos` (patrón `Pick<T, keyof T>`) |
| `proxy.ts` (+ `proxy.test.ts`) | `proxyAdmin` con `verificarSesionEnProxy` + `renovarSesion`, sin BD |
| `app/[slug]/admin/page.tsx` | `resolverRetoConSesion` → redirect a login si null |
| `app/[slug]/admin/actions.ts` (+ test) | `requerirSesion(slug): Promise<Reto>` sustituye `requerirSesion()`+`requerirReto()` |
| `app/api/admin/login/route.ts` (+ test reescrito) | `{slug, password}`, hash por reto, 401 único, sin `ADMIN_PASSWORD` |
| `app/admin/login/page.tsx` | Slug desde `returnTo`; sin `returnTo` válido, formulario desactivado |
| `app/superadmin/(panel)/actions.ts` (+ `actions.test.ts` nuevo) | `esquemaPasswordAdmin`; crear (obligatoria) / editar (vacío = no tocar) |
| `app/superadmin/(panel)/page.tsx` | Campo `password_admin` y estado "Contraseña admin: configurada / sin configurar" |
| `docs/tecnico/decisiones-tecnicas.md` | DT-029 (con notas de cierre) |
| `docs/tecnico/arquitectura.md`, `docs/tecnico/modelo-datos.md` | Ficheros nuevos, invariante de sesión por reto, `retos_admin`, `ADMIN_PASSWORD` obsoleta |
| `CHANGELOG.md`, `DEBT.md` | Actualizados |

No existe `.env.example` en el proyecto (nada que ajustar).

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 400 tests en verde (37 ficheros). Una primera ejecución registró además un "Timeout calling onTaskUpdate" intermitente del worker de vitest (sin test fallido); la repetición salió limpia. Registrado en DEBT.md.
- `pnpm build`: OK
- Migración `0010`: creada, **pendiente de aplicar** en Supabase (orquestador)

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **`finalizarReto` / `crearMinutoAMinuto`** (devuelven `ResultadoPublicacion`) usan `resolverRetoConSesion` directamente y devuelven el mensaje de sesión caducada; el antiguo "No se ha encontrado el reto" desaparece (ambos casos son sesión inválida).
2. **Login UI:** además del mensaje pedido, muestra "Demasiados intentos…" ante 429.
3. **`verificarPassword`** rechaza parámetros scrypt fuera de rango (N potencia de 2 ≤ 2^17, r ≤ 16, p ≤ 4, clave de 64 B) y limita `maxmem` a 64 MB: un hash manipulado en BD no puede provocar un cálculo costoso.
4. **Payload de la cookie validado con zod** tras comprobar la firma (las cookies antiguas `{exp}` se rechazan).
5. **`editarReto`** valida la contraseña antes de tocar la BD y la guarda al final (tras revalidar); `crearReto` la valida antes de insertar el reto.
6. **`CampoPasswordAdmin`** lleva `minLength=8`/`maxLength=200` además de la validación de servidor.
7. **`app/[slug]/admin/page.tsx`**: el `notFound()` por reto inexistente pasa a ser redirect a login (el layout ya da 404 antes en ese caso).

## Pendiente operativo tras el merge

- Aplicar `0010` en Supabase y comprobar que `anon` no puede leer `retos_admin`.
- En `/superadmin`, fijar la contraseña de cada reto existente (hasta entonces sus paneles no son accesibles).
- Borrar `ADMIN_PASSWORD` de Vercel.

## Historial de revisión

### Reviewer — ciclo 1 (2026-09-29): BLOQUEANTE (solo limpieza)

Código conforme a DT-029: todas las Server Actions del panel (incluidas las de subida de foto `finalizarReto`/`crearMinutoAMinuto`) y la página usan `resolverRetoConSesion` como primera operación; sin rastro de `ADMIN_PASSWORD` ni de la firma `{exp}` en código vivo; tests reales de sesión A en B e invalidación por cambio de hash.

Bloqueante:
- Borrar los ficheros de copia que quedaron en el árbol y NO están en `.gitignore` (se commitearían con código/docs obsoletos, incl. la firma antigua y `ADMIN_PASSWORD`): `app/[slug]/admin/actions.ts.bak`, `app/[slug]/admin/actions.test.ts.bak`, `app/superadmin/(panel)/actions.ts.bak`, `app/superadmin/(panel)/page.tsx.bak`, `docs/tecnico/arquitectura.md.bak`.

Recomendaciones (registradas en DEBT.md): JSDoc de `requerirSesion` desplazado (`actions.ts:47-57`); test de sesión inválida para `finalizarReto`.

Siguiente: Seguridad, tras borrar los `.bak`.
