# Roadmap

Backlog vivo del proyecto. Estado: idea / definido / en curso / hecho.

---

## Fases principales

| Fase | Descripción | Estado |
|---|---|---|
| F0 | Infraestructura (repo, Supabase, Vercel, MapTiler, env vars) | **hecho** |
| F1 | Base (scaffolding, traza, dominio de progreso, tipos, docs) | **hecho** |
| F2 | Datos e ingesta (esquema SQL, RLS, `/api/track`, clientes Supabase) | **hecho y verificado en producción real** |
| F3 | Web pública (mapa, progreso, stats, formularios, textos) | hecho |
| F4 | Panel admin (login, proxy, secciones) | **hecho** |
| F5 | Cierre (Reviewer, Seguridad OWASP/RLS, deploy producción, prueba real) | **hecho (ingeniería)** |

## Fases de plataforma multi-reto

Desde 2026-09-28 el producto deja de ser la web de un único reto y pasa a ser
una plataforma multi-reto para amigos. Ver "La web pasa a ser una plataforma
multi-reto para amigos" en `decisiones-producto.md` y DT-025 a DT-033.

| Fase | Descripción | Estado |
|---|---|---|
| FP0 | Esquema multi-reto (tabla `retos`, datos por reto, rutas en `lib/rutas/`) | **hecho** (2026-09-28) |
| FP1 | Cada reto en `/<slug>` y su admin en `/<slug>/admin` | **hecho** (2026-09-29) |
| FP2 | Panel `/superadmin` (crear/editar/eliminar retos, desplegable de rutas) y portada `/` con retos activos | **hecho** (2026-09-29) |
| FP2.5 | Datos aislados por reto; GPS con el reto en la URL; varios retos en marcha a la vez | **hecho** (2026-09-29) |
| FP2.6 | Contraseña de admin propia por reto, fijada desde el superadmin | **hecho** (2026-09-29) |
| FP3a | Respuestas de un nivel en comentarios, insignia "Caminante" | **hecho** (2026-09-29) |
| FP3b | "Minuto a minuto" plegable con aviso de nuevas | **hecho** (2026-09-30) |
| FP3c | Configuración por reto y textos por bloques | **hecho** (2026-09-30) |
| — | Vista previa, peregrino on/off, perfil de Instagram, URL del GPS con token | hecho |

---

## F0 — Infraestructura (hecha, 2026-07-31)

- [x] Repo GitHub `Ago00/camino-santi-ago` (público, por el límite de Vercel Hobby)
- [x] Proyecto Supabase nuevo (región eu-west-1, URL/anon/service role
      configuradas en `.env.local`) — 2026-07-30
- [x] Proyecto Vercel nuevo conectado al repo — desplegado y verificado en
      producción real (`https://camino-santi-ago-sage.vercel.app`) — 2026-07-31
- [x] Cuenta MapTiler (free tier) y su API key — verificada con una petición
      real de tiles antes de guardarla — 2026-07-31
- [x] Env vars cargadas en Vercel (Production): `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TRACK_TOKEN`,
      `NEXT_PUBLIC_MAPTILER_KEY`
- [x] `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` — cargadas en Vercel Production
      (confirmado en F5, 2026-08-01). `ADMIN_PASSWORD` queda obsoleta desde
      FP2.6 (2026-09-29): cada reto tiene su propia contraseña de admin.

## F2 — Datos e ingesta

**Hecha y verificada contra Supabase real (2026-07-30).**

- [x] Escribir migración SQL (`supabase/migrations/0001_esquema_inicial.sql`)
- [x] Políticas RLS según la tabla del plan, incluidas en la migración
- [x] Route handler `/api/track` (ingesta OwnTracks con token +
      `timingSafeEqual` + filtro de plausibilidad geográfica de 100 km,
      DT-006 capa 1)
- [x] Cliente Supabase admin (`lib/supabase/admin.ts`) — construcción
      perezosa, no falla el build sin env vars
- [x] Cliente Supabase público (`lib/supabase/public.ts`) — ídem
- [x] Tests unitarios del endpoint con Supabase mockado (36 tests)
- [x] Aplicar la migración contra Supabase real — 5 tablas, RLS activo en
      las 5, verificado que `intenciones` es inaccesible para `anon` incluso
      con filas reales insertadas
- [x] Verificar `/api/track` con peticiones reales contra la BD viva (local y
      **en producción real, `camino-santi-ago-sage.vercel.app`**): token
      incorrecto → 401, punto fuera de rango → descartado sin guardar, punto
      válido → guardado correctamente. Encontrado y corregido un bug real en
      el proceso (`admin.ts` leía una env var inexistente — ver `BUGS.md`)
- [ ] Verificar con OwnTracks real desde el móvil (siguiente paso — hace
      falta una URL pública para que el teléfono pueda mandar peticiones)

## F3 — Web pública

**Hecha (2026-07-31).**

- [x] Página principal con 3 modos (antes/durante/llegada)
- [x] Componente mapa (MapLibre + overlay SVG, patrón POC)
- [x] Stats (barra, km andados, km restantes, tiempo, ritmo)
- [x] Cielo-reloj (degradado dinámico día→noche según hora real)
- [x] Mojón como cifra de km restantes
- [x] Peregrino animado (camiseta rojiblanca, cabeza que se enfada al pinchar)
- [x] Formulario de intenciones
- [x] Formulario de comentarios + hilo público
- [x] Sistema de textos (default en código + override desde BD)

## F4 — Panel admin

**Hecha (2026-08-01).**

- [x] Página de login (`/admin/login`, contraseña única)
- [x] `proxy.ts` protegiendo `/admin/*` (Next 16 renombró `middleware.ts` a
      `proxy.ts`, ver DT-010) + verificación de sesión independiente en cada
      Server Action
- [x] Sección Actividad: Iniciar / Finalizar / **Retomar** (deshace un
      Finalizar sobre el mismo intento, sin confirmación) / Reiniciar (cierra
      el intento y abre uno nuevo, con confirmación — disponible desde
      `durante` y desde `llegada`)
- [x] Sección Posición (ver última, **descartar cualquier punto del
      histórico** — no solo el último; DT-006 capa 2, defensa complementaria
      al filtro geográfico de F2 contra el envenenamiento del ancla de
      progreso). No incluye "fichar posición ahora" (geolocalización manual
      de respaldo): retirado explícitamente del alcance, se confía en
      OwnTracks.
- [x] Sección Intenciones (leer, eliminar — borrado real, la tabla no tiene
      soft-delete)
- [x] Sección Comentarios (ocultar, mostrar, eliminar, filtrar)
- [x] Sección Textos (editar las 6 claves de `lib/textos/defaults.ts`)

## F5 — Cierre

**Ingeniería hecha (2026-08-01).**

- [x] Rate limiting en los 6 endpoints públicos/sensibles (DT-011), cerrando
      la deuda técnica que lo marcaba como bloqueante explícito antes de
      producción real
- [x] Reviewer del código — auditoría completa F1-F5, sin bloqueantes
- [x] Agente de Seguridad (OWASP Top 10, auditoría de dependencias, RLS) —
      auditoría completa F1-F5; un bloqueante encontrado y corregido (control
      de acceso en lectura de datos de admin sin verificación de sesión
      propia), re-revisado y aprobado
- [x] Verificación de despliegue a producción — env vars de admin confirmadas
      en Vercel Production
- [ ] Prueba real andando (como la POC) — pendiente, solo puede hacerla Santi
      el día del reto
- [ ] Carga de textos finales desde el panel — pendiente, la hace Santi
      directamente en el panel admin cuando tenga los textos definitivos

## Post-F5 — Minuto a minuto (hecho, 2026-08-02)

Idea promovida desde "Ideas v2" y ampliada con fotos. Ver DT-013
(`docs/tecnico/decisiones-tecnicas.md`) y
`docs/tareas/historico/2026-08-02-minuto-a-minuto.md`.

- [x] Tabla `minuto_a_minuto` + Supabase Storage (bucket público) — **migración
      `0002_minuto_a_minuto.sql` pendiente de aplicar contra Supabase real**
- [x] Panel admin: publicar (texto + foto opcional), editar texto, eliminar
- [x] Web pública: feed en "durante" (con auto-actualización) y recopilatorio
      en "llegada"
- [x] Clic en una entrada → marcador temporal en el mapa con la posición en
      la que se publicó (sin saturar el mapa con marcadores permanentes)
- [x] Reviewer y Seguridad aprobados

---

## Post-F5 — Mapa: traza real vs. traza oficial (hecho, 2026-08-12)

Mapa público en modo guiado pinta el recorrido GPS real en vez de la traza
oficial (mismo comportamiento que modo libre); panel admin gana pestaña
"Mapa" con ambas trazas y el punto de referencia del cálculo. Ver DT-021
(`docs/tecnico/decisiones-tecnicas.md`) y
`docs/tareas/historico/2026-08-12-mapa-traza-real-vs-oficial.md`.

- [x] Mapa público, modo guiado: pinta `puntosGps` (real), no la traza
      oficial recortada; marcador de destino ⛪
- [x] Panel admin: pestaña "Mapa" nueva (traza real + oficial + línea de
      referencia al punto proyectado)
- [x] Reviewer y Seguridad aprobados (2 rondas de Seguridad — bloqueante de
      coste corregido)

---

## Post-F5 — Otras mejoras del reto de Santi (hecho, 2026-08-07 → 2026-08-13)

- [x] Modo de intento configurable: guiado o libre con destino en línea
      recta (2026-08-07, DT-016)
- [x] Fotos del minuto a minuto recomprimidas en el móvil y envío con
      reintentos (2026-08-09, DT-017)
- [x] Pestaña "Tráfico" en el admin: visitas anónimas, antes/durante/después,
      botón Reset (2026-08-12, DT-022)
- [x] "Finalizar" con vista previa real y foto de llegada opcional
      (2026-08-12, DT-024)
- [x] Enlace a Instagram en "Antes" y "Durante" (2026-08-13)
- [x] "¡AUPA ATLETI!" al pinchar el peregrino (2026-08-12)

---

## Plataforma — FP0 a FP2.6 (hecho, 2026-09-28 → 2026-09-29)

- [x] Esquema multi-reto: tabla `retos`, todos los datos ligados a un reto
- [x] Rutas del catálogo en `lib/rutas/<ruta_id>/` (v1: `portuguesa-110`);
      retos de ruta libre sin traza
- [x] Web pública en `/<slug>` y panel admin en `/<slug>/admin`
- [x] Panel `/superadmin` (solo Santi, contraseña propia): crear, editar y
      eliminar retos; ruta en desplegable; mensajes claros de resultado y
      error; enlaces a la web y al panel de cada reto
- [x] Portada `/` con los retos activos (un reto inactivo sale de la
      portada pero sigue accesible por enlace)
- [x] Reto original renombrado a `santi-ago`
- [x] Datos aislados por reto; varios retos en marcha a la vez
- [x] GPS con el reto en la URL (`/api/track?reto=<slug>`); el superadmin
      muestra la URL de cada reto
- [x] Contraseña de admin propia por reto, fijada solo desde el superadmin

## Plataforma — FP3 (hecho, 2026-09-29 → 2026-09-30)

- [x] **FP3a** — Respuestas de un nivel en comentarios (visitantes y
      caminante con insignia "Caminante"); "Responder" también en cada
      respuesta; hilos largos plegados
- [x] Panel admin: comentarios en Públicos / Privados / Ocultos (a los
      privados no se responde); enlace "Ver web"
- [x] **FP3b** — "Minuto a minuto" plegable en acordeón (abierto en
      "durante", plegado en "llegada") con insignia de "N nuevas"
- [x] **FP3c** — Pestaña "Configuración": interruptores de intenciones,
      comentarios, minuto a minuto e Instagram; respuestas de visitantes
      on/off; foto de "quién camina". Textos agrupados por bloques
- [x] Endurecimiento pre-reto: el minuto a minuto no duplica entradas si se
      corta la conexión; preparar o subir fotos no se queda colgado sin aviso
- [x] Subida de fotos arreglada en la plataforma (faltaba el almacenamiento)
- [x] Pestaña "Vista previa" en el admin: ver la web en fase antes /
      durante / llegada con la configuración actual
- [x] Interruptor del peregrino animado en Configuración (encendido en
      `santi-ago`, apagado por defecto en retos nuevos)
- [x] Perfil de Instagram del reto en Configuración
- [x] URL del GPS con token en el superadmin, lista para copiar

---

## Ideas v2 (fuera de alcance v1)

- Hitos automáticos (cada pueblo, cada 10 km)
- Bot de Telegram
- Contador de seguidores (presencia en localStorage + BD)
- Geocodificación inversa ("Ahora: cerca de Redondela") en web pública
