# Tarea en curso — DT-036: monigote elegible por reto (22 del catálogo)

> El contenido anterior (DT-035, token de GPS por reto + QR) se archivó en
> `docs/tareas/historico/2026-10-01-token-gps-y-qr.md`.

## Prompt clarificado (aprobado por el usuario)

El admin de cada reto elige en Configuración qué monigote pasea por su web pública (o ninguno) entre
los 22 del catálogo aprobado (`design-sandbox/public/monigotes-tematicos.html`), puede cambiar el
grito que lanza al pincharlo (máx. 48 caracteres) y decidir si suena. El "Peregrino animado" actual
pasa a ser el monigote "Atleti" (conserva "¡AUPA ATLETI!" rojiblanco). Port fiel del catálogo.

## Decisión técnica

DT-036 en `docs/tecnico/decisiones-tecnicas.md` (plan aprobado: catálogo puro en `lib/monigotes/`,
motor de navegador en `components/monigotes/`, CSS aislado bajo `.mng`, columnas `monigote`,
`monigote_grito`, `monigote_sonido` en `retos` (0017), `peregrino_animado` obsoleta hasta 0018).

## Archivos creados/modificados (Implementador)

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0017_monigote.sql` | Creado. **Aplicada** el 2026-10-01 (`santi-ago`, `prueba` → `atleti`; `saco-walkers` → null) |
| `lib/monigotes/catalogo.ts` (+ test) | Creado: `IDS_MONIGOTE`, `DefMonigote`, `MONIGOTES` (22), `esIdMonigote` |
| `lib/monigotes/piezas.ts`, `figuras.ts`, `marcas.ts` | Creados: piezas SVG, `FIGURAS`, `svgFigura`, `uidSvgSeguro`, `MARCAS`, `particulaSvg` (extraídos del HTML por script) |
| `lib/monigotes/grito.ts` (+ test) | Creado: `normalizarGritoMonigote`, `gritoEfectivo`, `partirGrito`, `longitudGrito`, km del mojón |
| `components/monigotes/motor.ts`, `sonidos.ts`, `monigotes.css`, `MonigoteSuelto.tsx` | Creados: motor imperativo, Web Audio, CSS aislado `.mng`/`mng-*`, capas + efecto |
| `components/publico/MonigoteWeb.tsx` | Creado: `next/dynamic` `ssr:false` de `MonigoteSuelto` |
| `components/admin/SelectorMonigote.tsx` | Creado: radiogroup "Ninguno" + 22, "Probar", panel del elegido |
| `components/publico/PeregrinoLibre.tsx` | **Eliminado** |
| `lib/types.ts`, `lib/supabase/admin.ts` | 3 campos nuevos en `Reto` (opcionales al insertar); `peregrino_animado` marcada obsoleta |
| `lib/retos/config.ts` (+ test) | `peregrino_animado` fuera de `CAMPOS_CONFIG_RETO`; `ConfiguracionWebReto`, `MonigoteDelReto`, `monigoteDelReto` |
| `lib/retos/huella-publica.ts` (+ test) | Monigote `[id, grito, sonido]` en la huella |
| `lib/textos/bloques.ts` | `SeccionConfigurable` sin `peregrino_animado` |
| `app/[slug]/admin/actions.ts` (+ test) | `guardarConfiguracion`: zod con monigote, grito normalizado, un solo update que sincroniza `peregrino_animado` |
| `app/[slug]/api/fase/route.ts` | Pasa `monigoteDelReto(reto)` a la huella |
| `components/publico/WebReto.tsx` (+ test nuevo) | `MonigoteWeb` solo con `monigote.id`; huella con monigote |
| `components/admin/FormConfiguracion.tsx`, `SeccionConfiguracion.tsx` | Selector por `next/dynamic` + esqueleto en lugar del interruptor; mismo guardado |
| `components/publico/FotoLlegada.tsx`, `app/[slug]/page.test.ts` | Referencias a `PeregrinoLibre`/`peregrino_animado` en config |
| Fixtures `Reto` (7 tests más) | Campos del monigote |
| `docs/tecnico/{decisiones-tecnicas,arquitectura,modelo-datos}.md`, `docs/producto/funcionalidades.md`, `CHANGELOG.md`, `DEBT.md` | DT-036 nueva + nota en DT-034; DEBT: 3 entradas nuevas, 1 actualizada |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 931 tests en verde
- `pnpm build`: OK

## Decisiones de implementación (bloqueos menores resueltos) — revisar

Detalladas en las notas de cierre de DT-036. Resumen:
1. `normalizarGritoMonigote(valor, gritoPorDefecto)` (dos argumentos); quita también marcas bidi.
2. `gritoVivo` booleano; el grito por defecto del mojón escrito a mano sigue cantando los km.
3. `MonigoteWeb` con props primitivas (`id`, `grito`, `sonido`) en vez de `config={monigote}`.
4. Margen superior de 64 px para el suelto (el de `PeregrinoLibre`).
5. Hipo y arrebato también en las tarjetas del selector (solo visibles).
6. "Probar" en eucalipto (contraste); grito recortado por caracteres en `onChange` en vez de `maxLength`.
7. Poses estáticas de movimiento reducido también con la media query real.
8. El obsoleto `peregrino_animado` se rechaza en la entrada de `guardarConfiguracion` (`.strict()`).

## Verificación en navegador

- **Hecha (parcial)** con Chrome headless sobre una página temporal ya borrada (sin Supabase local):
  las 22 figuras animadas en el selector, "Probar" del mojón (grito «¡QUEDAN 99!» y placa a 99) y del
  atleti (Fraunces cursiva rojiblanca), atleti suelto pinchado (pose, bocadillo, carrera, huellas,
  grito a pantalla completa), hipo del borrachillo, arrebato del pimiento y movimiento reducido
  (quieto en la esquina, sin animaciones). Consola sin errores de React.
- **Pendiente en preview:** web real con un reto (y vista previa del admin), guardar desde
  Configuración tras aplicar `0017`, sonido con clic real (en headless el clic sintético no desbloquea
  el audio), teclado del radiogroup, y en iPhone con el modo silencio.

## Historial de revisión

- **2026-10-01 — Reviewer: APROBADO** (pasa a Seguridad). Sin bloqueantes. Port fiel verificado contra
  el catálogo (22 defs, `partir`, `lanzarGrito`, `Suelto`, km del mojón, `gritoDe`); limpieza del motor
  completa; CSS 100 % bajo `.mng` (con test); guardado strict + normalización + sincronía
  `peregrino_animado`; huella idéntica en `WebReto` y `/api/fase`. Arreglado por el Reviewer:
  `docs/tecnico/modelo-datos.md` (fila `monigote` corrompida con el inicio del documento duplicado),
  0017 marcada como aplicada aquí y en `DEBT.md`. Recomendaciones registradas en `DEBT.md`: cursiva de
  Fraunces sintetizada, caracteres de anchura cero en el grito, flechas del selector durante el guardado.

## Despliegue

1. ~~Aplicar `0017_monigote.sql` y verificar~~ — hecho (2026-10-01).
2. Desplegar.
3. Más adelante, `0018` para borrar `peregrino_animado`.
