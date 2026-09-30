# Contexto del producto

## Qué es

**Camino de Santi·ago** es una web para seguir en directo el reto de Santi:
caminar del tirón ~100 km del Camino Portugués Central (O Porriño → Praza do
Obradoiro de Santiago de Compostela, 24-30 h sin dormir), ofrecido por intenciones
de familia y amigos.

El nombre juega con "Camino de Santiago" y "Camino de Santi (ago)" — "…y este
camino, ¡no lo hago solo!"

**Desde 2026-09-28 es una plataforma multi-reto para amigos.** El reto de
Santi es uno más (`/santi-ago`); cada amigo puede tener su propio reto en
`/<slug>`, con su web pública, su panel admin (`/<slug>/admin`) y sus datos
aislados. La portada `/` lista los retos activos. Ver "La web pasa a ser una
plataforma multi-reto para amigos" en `decisiones-producto.md`.

## Para quién

- **Caminante** — el protagonista de cada reto (Santi en `santi-ago`), que
  lleva el móvil con OwnTracks enviando su posición a la URL de su reto.
- **Familia y amigos** — espectadores que siguen el progreso en directo, dejan
  intenciones (siempre privadas) y comentarios (y responden a otros), y viven
  el reto desde casa.
- **Caminante como admin** — accede al panel de su reto (con la contraseña
  que le da Santi) para controlar la fase, publicar en el minuto a minuto,
  moderar y responder comentarios, configurar qué secciones se ven y
  corregir posiciones si hace falta.
- **Santi como superadmin** — el único que crea, edita y elimina retos, fija
  la contraseña de admin de cada uno y consulta la URL del GPS de cada reto.

## Qué problema resuelve

Sin esta web, los familiares y amigos de Santi no pueden saber dónde está ni cómo
va el reto. La web convierte un esfuerzo físico solitario en una experiencia
compartida: cada % de la barra es un momento de conexión con las personas que le
importan.

## Estado actual

A 2026-09-30:

- **F0-F5** (web del reto único): completadas. El reto de Santi llegó a
  "llegada" el 2026-08-14.
- **FP0-FP3c** (plataforma multi-reto): completadas — retos en `/<slug>`,
  superadmin, portada, datos aislados, GPS por reto, contraseña de admin por
  reto, respuestas en comentarios, minuto a minuto plegable, configuración
  por reto.
- **En desarrollo:** vista previa en el admin, interruptor del peregrino,
  perfil de Instagram en Configuración, URL del GPS con token en el
  superadmin.

Detalle en `roadmap.md` y `funcionalidades.md`.

## Rutas

En v1 la única ruta predefinida es `portuguesa-110` (la traza de abajo).
Los retos sin ruta predefinida usan el modo libre (destino en línea recta).

## Traza

La traza es un **corredor** que cubre más de 100 km del Camino Portugués
Central, desde ~10 km al sur de O Porriño hasta la **Praza do Obradoiro** de
Santiago de Compostela. Total: **~110,43 km** (el corredor tiene margen sur
para que el mojón físico del km 100 quede siempre dentro, sea cual sea el
desfase entre nuestra medición y las piedras). El recorrido real lo define
Santi al pulsar Iniciar — ver DT-005 y DT-015 (extensión sur corregida con
el tramo `t03v`, verificado contra un track GPS real).

Los últimos ~210 m (Quintana → Obradoiro) son geometría manual pendiente
de validar sobre el terreno — ver `DEBT.md`.

Fuente: Xunta de Galicia (abertos.xunta.gal), CC BY-SA 4.0.
