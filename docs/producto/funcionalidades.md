# Funcionalidades

Descripción desde el punto de vista del usuario. Para el detalle técnico, ver
`docs/tecnico/arquitectura.md`.

Estado a 2026-09-30.

---

## Plataforma multi-reto

El producto nació como la web de un único reto (el Camino de Santi·ago) y
desde FP0-FP3 (2026-09-28 → 2026-09-30) es una plataforma donde conviven
varios retos de amigos. Cada reto tiene su propia web pública, su propio
panel admin y sus propios datos.

- **Portada (`/`)** — lista de los retos activos, cada uno con enlace a su
  web. Si no hay ninguno activo, muestra un mensaje informativo. No
  redirige automáticamente aunque solo haya un reto: es un selector.
- **Web de un reto (`/<slug>`)** — la web pública del reto (ver "Web
  pública de un reto").
- **Panel admin de un reto (`/<slug>/admin`)** — gestión del reto por quien
  camina (ver "Panel admin de un reto").
- **Panel superadmin (`/superadmin`)** — gestión de la plataforma, solo
  Santi (ver "Panel superadmin").

**Retos activos e inactivos.** Un reto inactivo desaparece de la portada,
pero su web y su panel siguen accesibles para quien tenga el enlace.

**Datos aislados por reto.** Posiciones, minuto a minuto, comentarios,
intenciones, textos, configuración y tráfico pertenecen a un único reto: ni
la web ni el panel de un reto ven ni tocan los de otro. Varios retos pueden
estar en marcha a la vez.

**Rutas.** Un reto sigue una ruta predefinida del catálogo (en v1 solo
existe `portuguesa-110`, el Camino Portugués de ~110 km) o es de **ruta
libre** (sin traza oficial). Los retos de ruta libre no muestran la traza del
Camino Portugués en ningún sitio. No se pueden subir rutas nuevas desde la
interfaz: añadir una ruta es trabajo de desarrollo.

---

## Panel superadmin (`/superadmin`)

Solo para Santi. Contraseña propia (distinta de la de los paneles admin de
cada reto) y sesión propia: entrar en el panel de un reto nunca da acceso al
superadmin. No hay auto-registro: solo Santi crea retos.

- **Lista de todos los retos**, activos e inactivos, cada uno en una tarjeta
  con enlaces "Ver web" y "Panel admin" (en pestaña nueva). Enlace "Ver
  portada" en la cabecera.
- **Crear reto** — slug, nombre, descripción, tipo de ruta (predefinida o
  libre) y, si es predefinida, la ruta elegida en un **desplegable** del
  catálogo (no se escribe a mano). La **contraseña de admin del reto es
  obligatoria** al crear. El reto nace listo para usar, en fase "antes". Tras
  crearlo aparecen los enlaces a su web y a su panel.
- **Editar reto** — nombre, descripción, ruta, activo/inactivo y, si se
  quiere, una contraseña de admin nueva (vacío = no cambiar). Cambiar la
  contraseña cierra las sesiones abiertas con la anterior.
- **Eliminar reto** — con confirmación; borra el reto y todos sus datos.
- **Estado de la contraseña** — cada tarjeta indica si el reto tiene
  contraseña de admin configurada (sin ella, su panel no es accesible).
- **GPS del reto** — cada tarjeta muestra lo mismo que la pestaña GPS del
  admin de ese reto: la URL con su token propio y un QR que configura
  OwnTracks solo (ocultos hasta pulsar "Mostrar"), "Copiar", "Abrir en
  OwnTracks" y "Regenerar". Un reto sin token muestra "Sin token GPS" y el
  botón "Generar". Al crear un reto se le genera su token.
- **Cada acción dice qué ha pasado** — "Creando…"/"Guardando…"/
  "Eliminando…" mientras espera, mensaje de éxito o el motivo concreto del
  error (slug repetido, contraseña demasiado corta, sesión caducada…). Si
  algo falla, lo escrito en el formulario se conserva.

---

## Web pública de un reto (`/<slug>`)

### Tres modos según el estado del reto (`fase`)

**Antes** — presentación del reto, con la foto de "quién camina" (la que
haya subido el caminante en Configuración; sin foto, una silueta).
Formulario para dejar intenciones (anónimas o con nombre, siempre privadas).
Presentación y formulario para dejar comentarios. Enlace a Instagram en el
cierre, si está configurado.

**Durante** — pantalla principal. Mapa en directo con la posición del
caminante y el **recorrido GPS real** que lleva andado (no la traza oficial
de fondo) con un marcador de meta (bandera a cuadros). Estadísticas: tiempo
en marcha, km caminados, ritmo medio (tiempo y ritmo se congelan en el
último dato real recibido si el móvil deja de enviar). Cinta "En directo"
con enlace a Instagram. Feed "Minuto a minuto" y muro de comentarios.

**Llegada** — el mapa (con el recorrido real completo) y las estadísticas
quedan congeladas en el momento de llegar. Aparece el mensaje de llegada y,
si se adjuntó, la foto de llegada. El "Minuto a minuto" queda como
recopilatorio, plegado. Los formularios de intención/comentario siguen
disponibles.

Cualquier sección apagada en la Configuración del reto (intenciones,
comentarios, minuto a minuto, Instagram) no aparece en ninguna fase.

### Modo guiado y modo libre

Al pulsar Iniciar, el caminante elige el modo del intento, que queda fijo
hasta Reiniciar:

- **Guiado** — progreso sobre la ruta oficial del reto: barra de avance,
  mojón con los km restantes, perfil de elevación.
- **Libre** — para cualquier ruta, en cualquier sitio. Se fija un destino
  (latitud/longitud) al iniciar. La web muestra la distancia que queda en
  línea recta hasta el destino, junto con tiempo en marcha, ritmo medio y km
  caminados. Sin barra de progreso ni ruta de fondo: el mapa dibuja solo el
  recorrido real. En modo libre el enlace a Instagram aparece como una
  insignia sobre el mapa.

Un reto de ruta libre (sin ruta predefinida) siempre se mide como libre.

### Progreso (modo guiado)

- **Barra de avance** (%) — proyección del punto sobre la traza. Monótona:
  nunca baja aunque el caminante retroceda o se desvíe brevemente.
- **Km andados** — odómetro haversine real. Sí sube al retroceder (mide distancia
  real, no solo avance sobre el plan).
- **Km restantes** — lo que queda de ruta oficial desde el punto proyectado
  más cercano hasta la meta. Si el caminante está desviado, no suma el coste
  de volver a la ruta (eso ya lo refleja el estado en-ruta/desvío). Puede no
  sumar 100 con la barra: es correcto, miden cosas distintas.

### Minuto a minuto

Feed en directo (estilo comentario de fútbol) con lo que el caminante va
publicando: texto corto y, si quiere, una foto. Cada entrada muestra la hora
y, si tiene posición asociada, se puede pinchar para ver en el mapa dónde
estaba al publicarla — el mapa resalta solo ese punto de forma temporal, no
hay marcadores permanentes de todas las entradas (para no saturar el mapa).
En "durante" las entradas nuevas aparecen solas, sin refrescar (también la
primera del reto).

**Plegable en acordeón.** Toda la cabecera de la sección se pulsa para
abrir/cerrar, con una flecha que gira. Abierta en "durante", plegada en
"llegada"; la elección no se recuerda al recargar. Plegada, si llegan
entradas nuevas la cabecera muestra una insignia "1 nueva" / "N nuevas"
hasta que se despliega. El punto marcado en el mapa se mantiene al plegar.

### Intenciones

- Anónimas o con nombre; siempre privadas. Solo el admin las ve.
- No hay límite de intenciones por persona.

### Comentarios

- Siempre llevan nombre del autor.
- El autor elige público o privado. Solo los públicos y no ocultos aparecen
  en el muro. Los privados son mensajes solo para quien camina. Un comentario
  público recién enviado aparece en el muro sin recargar.
- **Respuestas (un solo nivel).** Los visitantes pueden responder a
  cualquier comentario público y a cualquier respuesta; todas las respuestas
  van al mismo hilo, bajo el comentario original. El formulario se abre al
  final del hilo e indica a quién se contesta ("Respondiendo a Ana"). Las
  respuestas son siempre públicas.
- **Insignia "Caminante".** Las respuestas que el caminante escribe desde su
  panel llevan la insignia "Caminante" (solo él puede ponerla).
- Los hilos con más de dos respuestas aparecen plegados tras "Ver N
  respuestas".
- Si el caminante apaga las respuestas de visitantes, desaparece el botón
  "Responder" del muro; las respuestas existentes siguen visibles y él sigue
  pudiendo responder desde el panel.
- Sin notificaciones.

### Otros elementos

- **Monigote** — cada reto puede tener un monigote que deambula por la web
  dejando su propio rastro (huellas, tinta, estrellitas, notas, charcos…).
  Hay 22 para elegir, todos del Camino: el Atleti rojiblanco de siempre,
  peregrino clásico, borrachillo, pulpo, meiga, gaiteiro, vaca rubia,
  gallego con paraguas, peregrino con ampollas, abuelo, guiri, botafumeiro,
  flecha amarilla, mojón, caracol, sello de la credencial, pimiento de
  Padrón, tarta de Santiago, tortilla, hórreo, roncador de albergue y perro
  peregrino. Cada uno anda a su manera (en zigzag, volando, reptando, a
  saltos, dando volteretas…). Al pincharlo se enfada, se acelera y lanza su
  grito a pantalla completa con su propio estilo (el mojón canta los km que
  le quedan, y bajan con cada pinchazo); si el reto lo tiene activado,
  además suena. Con "reducir movimiento" activado en el dispositivo se queda
  quieto en una esquina. Se elige en Configuración (o ninguno); los retos
  que tenían el peregrino animado pasan al Atleti.
- **Cielo-reloj** — degradado de fondo día → noche según la hora real.

---

## Panel admin de un reto (`/<slug>/admin`)

**Acceso.** Cada reto tiene su propia contraseña de admin, que fija
únicamente el superadmin (al crear el reto o al editarlo). Entrar en el
panel de un reto no da acceso al de otro. Si se cambia la contraseña, las
sesiones abiertas con la anterior se cierran. Sin contraseña configurada, el
panel no es accesible. La cabecera tiene un enlace "Ver web" que abre la web
del reto en otra pestaña.

### Actividad

- **Iniciar** — arranca el reto (transición `antes` → `durante`) eligiendo
  modo guiado o libre (con destino). Pide confirmación.
- **Finalizar** — abre un panel donde se escribe el mensaje de llegada, se
  puede adjuntar, reemplazar o quitar una **foto de llegada opcional**, y se
  ve en directo una **vista previa real** de cómo quedará la pantalla de
  llegada pública antes de confirmar (transición `durante` → `llegada`). La
  foto se comprime en el móvil antes de subirse.
- **Retomar** — deshace un Finalizar: vuelve de `llegada` a `durante` sobre
  el mismo intento (no crea ni cierra nada, el histórico de posiciones queda
  intacto). Pensado para seguir andando si Finalizar se pulsó por error o
  antes de tiempo. No pide confirmación — es tan reversible como volver a
  pulsar Finalizar.
- **Reiniciar** — disponible desde `durante` (abortar un intento en marcha) y
  desde `llegada` (empezar de cero). Cierra el intento actual y abre uno
  nuevo en `antes`. Nada se borra de la BD: el historial completo queda
  intacto por si hay que auditarlo. Pide confirmación — es la única acción
  de Actividad que de verdad cierra una etapa sin vuelta atrás sencilla.

### Posición

- Ver la última posición conocida y cuándo se recibió.
- Histórico completo de posiciones, paginado, con la opción de **descartar
  cualquier punto**, no solo el más reciente — útil para limpiar un salto de
  GPS raro aunque se descubra horas después. Reversible.

No incluye geolocalización manual de respaldo ("fichar posición a mano"): se
confía en que la app de tracking del móvil (OwnTracks) es suficiente, así
que se ha decidido no construir esa red de seguridad adicional.

### Mapa

Comparación que el público no ve: la ruta oficial completa y el recorrido
real a la vez, con una línea discontinua desde la posición actual hasta el
punto de la ruta oficial que se usa para calcular los km restantes. Sirve
para comprobar de un vistazo si la cifra pública tiene sentido. En modo
libre avisa de que no hay ruta oficial de referencia.

### Minuto a minuto

- Publicar una entrada nueva: texto + foto opcional, subida directamente
  desde el móvil/ordenador. Se guarda automáticamente con la última posición
  conocida.
- **La foto publicada es una copia recomprimida en el propio móvil** (JPEG),
  conservando toda la resolución que quepa: en el caso normal mantiene sus
  píxeles originales y solo baja de tamaño si hace falta. Puede perder algo
  de calidad a cambio de subir rápido con la cobertura irregular del Camino.
  Si preparar la foto tarda más de 10 s, se envía la original.
- **Envío robusto** — si se corta la conexión, se reintenta solo, sin
  duplicar la entrada ni subir la foto dos veces. Si tarda más de 15 s, el
  panel avisa de que sigue subiendo y no hay que cerrar la página. Si falla,
  aparece el motivo y el texto y la foto siguen en el formulario.
- Editar el texto de una entrada ya publicada (la foto no se puede cambiar
  una vez subida — si está mal, se borra la entrada y se publica de nuevo).
- Eliminar una entrada.
- Si la sección está apagada en Configuración, la pestaña lo avisa.

### Intenciones

- Leer y eliminar intenciones.

### Comentarios

Tres apartados, cada uno con su número:

- **Públicos** — lo que se ve en la web, agrupado por hilos. Se puede
  ocultar, mostrar, eliminar y **responder como caminante** (con insignia).
  Un hilo cuyo comentario principal está oculto no aparece aquí.
- **Privados** — mensajes escritos solo para quien camina. No se publican
  ni se responden: solo se pueden eliminar.
- **Ocultos** — comentarios ocultos con su hilo como contexto.

Ocultar un comentario oculta también sus respuestas en la web; borrarlo las
borra (la confirmación indica cuántas).

### Configuración

Qué ve el público de este reto, sin tocar código:

- **Interruptores de secciones** — intenciones, comentarios (formulario y
  muro), minuto a minuto e Instagram. Encendidas por defecto. Una sección
  apagada desaparece de la web en todas las fases, sin borrar nada de lo
  recibido.
- **Respuestas de visitantes** — on/off (ver "Comentarios" de la web
  pública). Sin efecto si los comentarios están apagados.
- **Foto de "quién camina"** — subir, cambiar o quitar (sin foto, silueta).
- **Monigote de la web** — galería con "Ninguno" y los 22 monigotes andando;
  "Probar" enseña cómo se enfada, su grito y su sonido. Del elegido se puede
  cambiar el grito (hasta 48 caracteres; vacío = el suyo) y decidir si suena
  al pincharlo. Se guarda con el resto de la configuración.
- Perfil de Instagram del reto, configurado aquí.

### Textos

- Editar los textos de la web desde el panel sin tocar código.
- Agrupados por bloques plegables con un índice arriba; los bloques de
  secciones apagadas se marcan como tal.
- El valor por defecto vive en el código; la BD lo sobreescribe si hay una
  entrada para esa clave. Si no hay entrada en BD, la web usa el valor por
  defecto. Cada reto tiene sus propios textos.

### Tráfico

Cuánta gente visita la web del reto, de forma anónima (sin cookies de
consentimiento ni datos personales): visitas totales y visitantes distintos,
gráfico de visitas por tramo (cada 5 min, 30 min o hora) con la cifra de
cada punto, y desglose por página y por origen. Reparte el histórico en
antes / durante / después del reto y abre en la pestaña que tiene sentido
según la fase. Botón "Reset" que empieza a contar desde ahora sin borrar
datos.

### GPS

Configurar el móvil que envía la posición del reto:

- **URL del GPS** con el token propio de este reto y **QR** que configura
  OwnTracks automáticamente. Ocultos por defecto ("Mostrar"), para que no
  queden a la vista en una pantalla compartida.
- **Copiar** la URL y **Abrir en OwnTracks** (útil si el panel se abre desde
  el propio móvil).
- **Regenerar** el token, con confirmación: el anterior deja de funcionar al
  momento y hay que volver a configurar el móvil con el QR nuevo.
- Instrucciones en cuatro pasos: instalar OwnTracks, activar en Ajustes →
  Remote Control "Allow external configuration", escanear el QR y comprobar
  en la pestaña Posición que llega un punto.
- Si la web no conoce su dominio de producción, avisa de que la URL usa el
  dominio desde el que se abre el panel.

### Vista previa

Pestaña para ver la web pública tal y como quedaría en cada fase (antes,
durante, llegada) con la configuración actual del reto, sin tener que
cambiar de fase de verdad.

---

## GPS (OwnTracks)

El móvil del caminante envía su posición con OwnTracks a
`/api/track?reto=<slug>&t=<token>`: el reto y su token van en la URL, así que
cada caminante configura la de su reto y varios pueden enviar posiciones a la
vez. Cada reto tiene su propio token: el móvil de un reto no puede enviar
posiciones a otro. La URL y el QR que configura OwnTracks se consultan en la
pestaña GPS del admin del reto o en el superadmin, donde también se regenera
el token. Un envío sin reto, con un reto que no existe o con un token que no
es el de ese reto se rechaza (el móvil lo ve como "no autorizado").
