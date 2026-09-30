# Decisiones de producto

Log de decisiones relevantes de producto. Cada entrada: qué se decidió, qué
alternativas se valoraron, por qué se eligió, fecha.

---

## La meta es la Praza do Obradoiro

**Fecha:** 2026-07-30
**Decidido por:** Santi

**Decisión.** La barra de progreso llega al 100% cuando Santi pisa la
**Praza do Obradoiro**, no la Praza da Quintana (fin de la traza oficial de la Xunta).

**Alternativas valoradas:**
- Dejar la meta en Quintana (fin de la traza oficial) y marcar el Obradoiro como
  un icono decorativo → descartado. La barra marcaría 100% dos minutos antes de
  pisar la plaza, que es el momento más importante del reto.
- Extender la traza y recortar 210 m por el inicio para mantener exactamente
  100,000 km → descartado. Mueve el punto de inicio ya calculado y validado
  contra el mojón físico, por ganar una precisión simbólica que no aporta.

**Consecuencia técnica:** la traza pasa a medir 100,210 km. Los últimos ~210 m
son geometría dibujada a mano (Quintana → Obradoiro rodeando la catedral).
Pendiente validar sobre el terreno. Ver `DEBT.md`.

---

## La traza es un corredor: el recorrido real empieza donde Santi pulse Iniciar

**Fecha:** 2026-07-30
**Decidido por:** Santi

**Decisión.** La traza deja de representar el recorrido exacto y pasa a ser un
**corredor previsto** que comienza varios kilómetros antes del punto de salida
real. La barra de progreso arranca en 0% en el momento en que Santi pulsa
Iniciar, sea cual sea el punto de la traza donde se encuentre en ese momento.

Lo que experimenta Santi (y los espectadores): la barra empieza en 0% cuando
él dice "empiezo", avanza según se mueve, y llega al 100% al pisar el
Obradoiro. El corredor extendido por el sur es invisible para el usuario: solo
importa que el sistema tenga traza suficiente para cubrir cualquier punto de
arranque razonable.

**Por qué.** El inicio actual de la traza estaba 1,7 km al norte de O Porriño,
lo que equivale aproximadamente a la escala del mojón 98,7. El criterio de Santi
era arrancar junto a un mojón que grabara ≥ 100 km. No era posible localizar ese
mojón con precisión suficiente (las coordenadas de los mojones físicos no están
en ningún dataset público). La solución fue ensanchar el margen sur de la traza
hasta que cualquier mojón con cifra ≥ 100 quede dentro del corredor, y dejar que
el recorrido real lo defina el momento del Iniciar.

**Alternativas valoradas:**
- Localizar el mojón del km 100 con datos de campo (Wikiloc, Street View, fotos
  geolocalizadas) → descartado por Santi a favor de estimar, más rápido y
  suficiente dado el diseño de corredor.
- Estimar a partir del mojón 99,408 (único documentado cerca) contando ~500 m
  hacia atrás → encadena dos estimaciones (posición del cruce, espaciado regular)
  para ganar una precisión que el diseño de corredor hace innecesaria.

**Consecuencia técnica:** la traza pasa de 100,21 km a ~105 km (7.121 puntos).
El porcentaje se calcula desde la proyección del primer punto del intento, no
desde el origen del corredor. Ver `docs/tecnico/decisiones-tecnicas.md` → DT-005
para el detalle de implementación.

> **Nota (2026-09-30):** la cifra de esta decisión es la vigente en su fecha;
> DT-015 (2026-08-07) la corrige a **110,43 km / 7.951 puntos** (extensión sur
> por el camino que se anda de verdad). La decisión de producto no cambia.

---

## Repo nuevo, no reutilizar la POC

**Fecha:** 2026-07-30
**Decidido por:** Santi (con análisis del Arquitecto)

**Decisión.** Proyecto nuevo (`camino-santi-ago`, repo público), no reutilizar
el repo de la POC (`camino-tracking-poc`).

**Por qué:** la POC tiene deuda de estructura (sin App Router estructurado, sin
tipado estricto, dependencias de experimentos). Partir de cero permite hacer bien
la base sin cargar con los compromisos de la exploración.

La POC queda congelada como referencia. Su `lib/stats.ts` (haversine) y los
patrones de MapLibre con overlay SVG se reutilizan.

---

## No se muestra el pueblo actual en la web pública

**Fecha:** 2026-07-30 (decisión de la especificación v1)

**Decisión.** La web pública no muestra "Ahora: cerca de [pueblo]". Sí en el
panel admin (con lista propia, sin API externa).

**Por qué:** requiere geocodificación inversa (MapTiler API, con límite en plan
free) y la lista de pueblos por km. Se aparca para no bloquear la v1.

---

## ETA fuera de scope

**Fecha:** 2026-07-30 (decisión de la especificación v1)

**Decisión.** La web no calcula ni muestra ETA (hora estimada de llegada).

**Por qué:** el ritmo de Santi bajará con el cansancio de manera no lineal
durante el reto, haciendo cualquier estimación engañosa. Sí se muestra el
ritmo medio global, que es descriptivo sin prometer un tiempo.

---

## Km restantes ya no incluye la vuelta a la ruta si hay desvío

**Fecha:** 2026-08-02
**Decidido por:** Santi

**Decisión.** `kmRestantes` pasa a ser solo el plan restante desde el punto
más cercano de la ruta oficial hasta Santiago. Ya no suma la distancia que
haría falta andar para volver a esa ruta si Santi está desviado.

**Contexto.** La especificación original (2026-07-30) decidió un cálculo
"return-aware" (separación a la ruta + plan restante), sin más justificación
documentada que "es correcto". Al revisarlo con más perspectiva, Santi
prefiere que la cifra sea directamente comparable con "lo que queda de
camino oficial", sin penalizar visualmente un desvío que puede ser
completamente legítimo (p. ej. un tramo cortado que obliga a una variación).

**Alternativas valoradas:**
- Mantener "return-aware" → descartado, es la decisión que se revisa.
- Mostrar ambas cifras (con y sin vuelta) → descartado por complejidad
  visual innecesaria para lo que aporta.

**No cambia:** el estado en-ruta/desvío-menor/desvío-mayor sigue
reflejando si Santi está desviado y cuánto; solo cambia qué cuenta
`kmRestantes`.

---

## Modo de intento configurable: guiado o libre

**Fecha:** 2026-08-07
**Decidido por:** Santi

**Contexto.** La web solo servía para seguir un recorrido sobre la traza del
Camino Portugués. Santi quería poder usarla también para otras rutas, en
cualquier sitio, sin preparar una traza.

**Decisión.** Al pulsar Iniciar se elige el modo del intento. **Guiado**: el
de siempre, progreso sobre la ruta oficial. **Libre**: se fija un destino
(lat/lon) y la web muestra la distancia en línea recta hasta él, tiempo en
marcha, ritmo y km caminados, con el mapa dibujando solo el recorrido real,
sin barra de progreso ni ruta de fondo. El modo queda fijo durante todo el
intento; cambiarlo exige Reiniciar.

**Alternativas valoradas:**
- Solo modo guiado, preparando una traza para cada ruta nueva → descartado,
  obliga a trabajo de desarrollo por cada salida.

**Impacto.** El resto de la web (intenciones, comentarios, minuto a minuto)
funciona igual en ambos modos. Con la plataforma multi-reto, un reto sin
ruta predefinida se mide siempre como libre.

---

## La foto del minuto a minuto se publica como copia recomprimida en el móvil

**Fecha:** 2026-08-09
**Decidido por:** Santi

**Contexto.** En la prueba del 2026-08-07 las fotos normales de iPhone
(> ~4,4 MB) no se podían publicar, y con la cobertura irregular del Camino
las subidas eran lentas.

**Decisión.** Antes de subirla, la foto se recomprime a JPEG en el propio
navegador con una escalera adaptativa: conserva toda la resolución que
quepa y solo reduce tamaño si hace falta. Se acepta perder algo de calidad
(y, en fotos excepcionalmente pesadas, resolución) a cambio de subir rápido
y siempre. El mismo tratamiento se aplica después a la foto de llegada y a
la foto de "quién camina".

**Alternativas valoradas:**
- Reducir siempre a 1600 px → rechazado por Santi, pierde resolución sin
  necesidad en el caso normal.
- Subir el original → no cabe en el límite de subida y es lento con mala
  cobertura.

**Impacto.** Lo publicado no es el fichero original. Ver DT-017.

---

## La web pasa a ser una plataforma multi-reto para amigos

**Fecha:** 2026-09-28
**Decidido por:** Santi

**Contexto.** Tras su reto, Santi quiere que amigos puedan usar la misma web
para sus propios retos, sin montar un proyecto nuevo cada vez.

**Decisión.** Un único producto aloja varios retos. Cada reto vive en
`/<slug>` con su panel en `/<slug>/admin` y sus datos aislados (nadie ve ni
toca los datos de otro reto). La portada `/` lista los retos activos. Un
panel `/superadmin`, solo para Santi, crea, edita y elimina retos; no hay
auto-registro. En v1 la única ruta predefinida es `portuguesa-110` (elegida
en un desplegable) y existe la opción de ruta libre; no se suben rutas
desde la interfaz. El reto original pasa a llamarse `santi-ago`.

**Alternativas valoradas:**
- Un proyecto (repo + despliegue) por reto → descartado, multiplica el
  mantenimiento.
- Auto-registro de organizadores → descartado, el público es un círculo de
  amigos y Santi quiere controlar quién crea retos.
- Subida de GeoJSON desde la interfaz → aplazado, no hace falta para v1.

**Impacto.** Todo lo que antes era "de Santi" (textos, configuración, foto
de quién camina, contraseña del panel, GPS) pasa a ser "del reto". Ver
DT-025 a DT-029.

---

## Reto inactivo: fuera de la portada, pero accesible por enlace

**Fecha:** 2026-09-29
**Decidido por:** Santi

**Contexto.** El superadmin puede marcar un reto como activo o inactivo; hay
que decidir qué significa "inactivo" para el público.

**Decisión.** Un reto inactivo deja de aparecer en la portada `/`, pero su
web `/<slug>` y su panel siguen funcionando para quien tenga el enlace.

**Alternativas valoradas:**
- Inactivo = inaccesible (404) → descartado, rompería los enlaces ya
  compartidos de un reto terminado, que sigue teniendo valor como recuerdo.

**Impacto.** "Inactivo" controla solo la visibilidad en la portada, no el
acceso. Para quitar un reto de verdad, se elimina.

---

## Cada reto tiene su propia contraseña de admin, fijada solo por el superadmin

**Fecha:** 2026-09-29
**Decidido por:** Santi

**Contexto.** Todos los paneles compartían una contraseña común: quien
entraba en el panel de un reto entraba en todos. Con retos de amigos
distintos eso no es aceptable.

**Decisión.** Cada reto tiene su contraseña de admin. La fija únicamente el
superadmin: obligatoria al crear el reto y cambiable al editarlo. El
caminante no puede cambiarla desde su panel. Cambiarla cierra las sesiones
abiertas con la anterior. El superadmin ve qué retos la tienen configurada.

**Alternativas valoradas:**
- Mantener la contraseña común → descartado, rompe el aislamiento entre
  retos.
- Que cada caminante gestione su contraseña → descartado por ahora, añade
  flujos (cambio, recuperación) que no hacen falta con un único organizador.

**Impacto.** Si un caminante olvida su contraseña, se la da Santi desde el
superadmin. La sesión de admin de un reto nunca vale como sesión de
superadmin.

---

## El GPS indica su reto en la URL

**Fecha:** 2026-09-29
**Decidido por:** Santi

**Contexto.** Con varios retos, cada posición que llega de OwnTracks tiene
que asignarse al reto correcto, incluso con dos retos en marcha a la vez.

**Decisión.** Cada tracker envía a `/api/track?reto=<slug>`. El token del
GPS sigue siendo común a toda la plataforma. El superadmin muestra la URL
exacta de cada reto para configurarla en el móvil.

**Alternativas valoradas:**
- Un token por reto → descartado, obliga a gestionar un secreto por reto sin
  ganancia real con un único organizador.
- Deducir el reto del único que esté en marcha → descartado, es ambiguo con
  dos retos a la vez, que es justo lo que se quiere permitir.

**Impacto.** Al cambiar a la plataforma hubo que reconfigurar OwnTracks con
la URL nueva. Varios caminantes pueden enviar posiciones a la vez.

---

## Respuestas en los comentarios: un solo nivel

**Fecha:** 2026-09-29 (ampliada 2026-09-30)
**Decidido por:** Santi

**Contexto.** El muro de comentarios era una lista plana: ni los visitantes
podían conversar ni el caminante podía contestar.

**Decisión.**
- Un solo nivel de respuestas: todas cuelgan del comentario original. Desde
  2026-09-30 se puede pulsar "Responder" en cualquier respuesta, pero la
  nueva sigue yendo al mismo hilo, indicando a quién se contesta.
- Responden los visitantes (nombre + texto, siempre público) y el caminante
  desde el panel, con la insignia "Caminante", que solo él puede poner.
- Solo se responde a comentarios públicos y visibles. **A los privados no se
  responde**: son mensajes para quien camina, y en el panel solo se pueden
  eliminar.
- Ocultar un comentario oculta su hilo en la web; borrarlo borra sus
  respuestas (la confirmación dice cuántas).
- Hilos con más de dos respuestas, plegados. Sin notificaciones.

**Alternativas valoradas:**
- Hilos anidados de varios niveles → descartado, complica la lectura en
  móvil sin aportar en un muro de ánimos.
- Responder a privados → descartado, la respuesta tendría que ser pública o
  habría que construir mensajería privada.

**Impacto.** El panel separa los comentarios en Públicos, Privados y
Ocultos. Cada reto decide si los visitantes pueden responder (ver
"Configuración por reto").

---

## "Minuto a minuto" plegable

**Fecha:** 2026-09-30
**Decidido por:** Santi

**Contexto.** En "llegada" el recopilatorio del minuto a minuto ocupa mucho
espacio y empuja hacia abajo el resto de la página.

**Decisión.** La sección entera se pliega en acordeón: abierta en "durante",
plegada en "llegada". La elección no se recuerda. Plegada, la cabecera
avisa de las entradas nuevas ("1 nueva" / "N nuevas") hasta desplegarla. El
punto marcado en el mapa se conserva al plegar.

**Alternativas valoradas:**
- Recordar la elección de cada visitante → descartado, la fase decide el
  estado inicial más útil.

**Impacto.** Ninguno en el panel admin.

---

## Configuración por reto desde su panel admin

**Fecha:** 2026-09-30
**Decidido por:** Santi

**Contexto.** Cada reto de amigos no necesita lo mismo (quizá no quiere
intenciones, o no tiene Instagram), y la foto de "quién camina" estaba fija
en el código con la de Santi.

**Decisión.** Pestaña "Configuración" en el panel de cada reto:
- Interruptores de intenciones, comentarios, minuto a minuto e Instagram,
  encendidos por defecto. Apagar una sección la quita de la web en todas
  las fases sin borrar lo recibido.
- Respuestas de visitantes on/off (apagadas: sin botón "Responder"; las
  existentes siguen visibles y el caminante sigue respondiendo).
- Foto de "quién camina": subir, cambiar o quitar (sin foto, silueta).
Además, la pestaña Textos se agrupa por bloques plegables con índice.

**Alternativas valoradas:**
- Que lo configure el superadmin → descartado, son decisiones del caminante
  sobre su propia web.

**Impacto.** `santi-ago` conserva su foto. Los interruptores posteriores
(peregrino, perfil de Instagram) se añaden a esta misma pestaña.

---

## Peregrino animado: encendido en `santi-ago`, apagado por defecto en retos nuevos

**Fecha:** 2026-09-30
**Decidido por:** Santi

**Contexto.** El peregrino con camiseta rojiblanca y el "¡AUPA ATLETI!" son
un guiño personal de Santi que no tiene por qué encajar en el reto de otro.

**Decisión.** Interruptor del peregrino animado en la Configuración de cada
reto. Encendido en `santi-ago`; apagado por defecto en los retos nuevos.

**Alternativas valoradas:**
- Encendido por defecto en todos → descartado, impone el guiño a otros.
- Quitarlo de la plataforma → descartado, forma parte del reto de Santi.

**Impacto.** En desarrollo a 2026-09-30.
