# Simplificar el modelo: fuera franquicias

**Decidido:** 2026-08-05 · **Estado:** plan, sin empezar

El modelo pasa a ser: **un administrador** (`zinergiaconsultora@gmail.com`) **y colaboradores**. Sin franquicias, sin canon, sin royalties. Cada colaborador puede tener **su propia comisión**, fijada al darlo de alta.

---

## Por qué esto no es una limpieza de pantallas

La base de datos tiene grabada esta regla sobre cada perfil:

```sql
(role = 'admin'                    AND parent_id IS NULL     AND franchise_id IS NULL)
OR (role IN ('franchise', 'agent') AND parent_id IS NOT NULL AND franchise_id IS NOT NULL)
```

**Un colaborador sin franquicia es rechazado hoy por la base de datos.** Y esa regla es la misma que sostiene que la cuenta de administración no pueda quedar atrapada bajo nadie — el arreglo de agosto, cuando se descubrió que aplicar el contrato habría dejado a Zinergia sin forma de gestionar su propia red.

Encima de eso: **61 migraciones** mencionan franquicia, las políticas de acceso por filas deciden **quién ve qué cliente** mirando `franchise_id`, y el reparto de comisiones se calcula hoy en tres partes (colaborador / franquicia / central).

O sea: se tocan **permisos, visibilidad de datos y dinero** a la vez. Es el trío que conviene no tocar deprisa.

## Lo que ayuda

El terreno está casi vacío. En pruebas: 3 colaboradores, 1 franquicia-perfil, 1 admin, 2 franquicias, **0 configuraciones de franquicia y 0 planes de comisión**. En producción, la última medición: 1 franquicia formal ("Zinergia Central") de la que cuelgan todos, y **ningún perfil con rol de franquicia**.

Es decir: **la capa de franquicias ya está sin usar en la práctica**. Se retira una formalidad, no una operación en marcha. Eso reduce mucho el riesgo, pero no cambia que haya que hacerlo en orden.

---

## Plan por fases

Cada fase se despliega y se comprueba antes de la siguiente. Ninguna deja el sistema a medias.

> **Por dónde empezar: por la fase 2, no por la 1.** La comisión por colaborador **no necesita** que las franquicias desaparezcan: se añade encima de lo que hay, no rompe nada y se puede deshacer. La fase 1 toca permisos y visibilidad de datos, que es lo que conviene hacer con tiempo y probado en pruebas antes de acercarse a producción. Además la fase 2 es la que de verdad hace falta para dar de alta colaboradores de verdad.

### Fase 1 · Que un colaborador pueda existir sin franquicia
*Base de datos. Sin cambios visibles.*

- Nueva migración que sustituye la regla: `agent` exige responsable, **ya no exige franquicia**. `admin` sigue sin ninguno de los dos.
- Revisar las políticas de acceso que filtran por `franchise_id` para que un colaborador sin franquicia siga viendo lo suyo y **solo** lo suyo. **Esta es la parte delicada:** una política mal ajustada enseña la cartera de otro.
- El rol `franchise` sigue existiendo y funcionando. No se rompe nada de lo que hay.

### Fase 2 · Comisión por colaborador
*Base de datos y alta de usuarios. Es una función nueva, no una limpieza.*

- Guardar el **porcentaje** de cada colaborador, con historial: cambiarlo no puede reescribir lo ya liquidado.
- Poder fijarlo **al invitar**, y cambiarlo después dejando rastro de quién y cuándo.
- Añadir el **extra por cliente** en la pantalla donde un lead pasa a cliente, con su motivo y su autor.
- Que el cálculo de comisiones use porcentaje + extra en lugar del reparto a tres bandas.

El diseño está cerrado (ver arriba): euros, por operación, opcional, con historial de porcentajes por fecha y congelación al cerrar.

### Fase 3 · Retirar la franquicia de la interfaz
*Solo pantallas. Reversible.*

- Fuera el selector de franquicia al invitar y al cambiar autoridad.
- Fuera la pestaña "Red" entera, la lista de franquicias y las tarjetas de reparto 100/80/50 — que además son cifras escritas a mano, no datos.
- Fuera el "Canon Entrada: 3.000 €", por lo mismo.

### Fase 4 · Migrar los datos que quedan
- Los colaboradores cuelgan directamente del administrador.
- Las franquicias existentes se marcan inactivas, **no se borran**: hay comisiones históricas que las referencian y borrarlas dejaría huérfano el pasado.

### Fase 5 · Retirar el rol `franchise`
*Última, y solo cuando 1-4 lleven tiempo en producción sin incidencias.*

- Quitar el rol del código y de la regla de la base de datos.
- Las tablas de franquicia se quedan, inertes, como archivo.

---

## Cómo es la comisión de un colaborador (decidido 05/08/2026)

**Dos piezas que se suman:**

1. **Un porcentaje fijo por colaborador**, que se fija **al crear su perfil**. Se aplica sobre lo que la operación genera según el catálogo: si la tarifa paga 120 € y el colaborador tiene un 60 %, le corresponden 72 €.
2. **Un extra por cliente**, que el administrador puede añadir **en el momento en que un lead pasa a ser cliente**, en un campo editable de esa misma pantalla.

Así el porcentaje cubre el caso normal sin tener que tocar nada, y el extra permite reconocer una captación concreta sin renegociar el acuerdo entero.

### Cómo se comporta cada pieza

**El porcentaje se puede cambiar, y el cambio mira hacia delante.**
Todo lo que se cierre **a partir de la fecha del cambio** usa el porcentaje nuevo; lo cerrado antes se queda con el que tenía. Eso significa guardar el porcentaje **con su fecha de entrada en vigor** y conservar los anteriores, no sobrescribirlos: la pregunta "¿por qué esta operación pagó un 55 % si ahora tiene 65 %?" tiene que poder responderse sola.

En la práctica: cuando una operación se cierra, se **congela** en ella el porcentaje vigente en ese momento, igual que ya se hace con los precios de una propuesta. A partir de ahí, nada de lo que pase con el perfil la altera.

**El extra es en euros, por operación, y opcional.**
No es un premio único por traer al cliente: **cada operación de ese cliente puede llevar el suyo, o ninguno**. Se añade en la pantalla donde el lead pasa a cliente, en un campo editable, y lo normal es dejarlo vacío.

Va en euros y no en puntos de porcentaje a propósito: "a este le sumo 50 €" se entiende de un vistazo, y no cambia de valor según lo que pague la tarifa.

**El extra deja rastro y el colaborador lo ve.**
Queda registrado quién lo puso y cuándo. Y el colaborador lo ve en su operación, desglosado del porcentaje: es dinero que sale de una decisión manual, y un importe que no cuadra y que nadie explica genera más preguntas que el propio importe.

**Cada uno ve su porcentaje, no el de los demás.** Lo contrario es la fuga que se cerró con la pestaña "Red".

---

## Qué NO se toca

- **Las comisiones ya liquidadas.** Ningún cambio puede alterar lo que alguien ya cobró.
- **La regla de que el administrador no cuelga de nadie.** Es lo que impide quedarse sin control de la aplicación.
- **Las tablas históricas.** Se marcan inactivas; borrarlas rompería la trazabilidad de lo ya pagado.
