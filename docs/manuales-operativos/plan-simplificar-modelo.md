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

### Fase 1 · Que un colaborador pueda existir sin franquicia
*Base de datos. Sin cambios visibles.*

- Nueva migración que sustituye la regla: `agent` exige responsable, **ya no exige franquicia**. `admin` sigue sin ninguno de los dos.
- Revisar las políticas de acceso que filtran por `franchise_id` para que un colaborador sin franquicia siga viendo lo suyo y **solo** lo suyo. **Esta es la parte delicada:** una política mal ajustada enseña la cartera de otro.
- El rol `franchise` sigue existiendo y funcionando. No se rompe nada de lo que hay.

### Fase 2 · Comisión por colaborador
*Base de datos y alta de usuarios. Es una función nueva, no una limpieza.*

- Guardar la comisión de cada colaborador, con historial: cambiarla no puede reescribir lo ya liquidado.
- Poder fijarla **al invitar**, y cambiarla después dejando rastro de quién y cuándo.
- Que el cálculo de comisiones use ese valor en lugar del reparto a tres bandas.

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

## Lo que hay que decidir antes de la fase 2

**¿Cómo es "la comisión" de un colaborador?** Cambia el diseño entero:

**A · Un porcentaje sobre la comisión de la operación.** El catálogo dice que esa tarifa paga 120 €; el colaborador tiene un 60 % y se lleva 72 €. Simple, y encaja con las 324 reglas de comisión que ya existen por tarifa y tramo de consumo.

**B · Importes propios por tarifa.** Cada colaborador con su tabla. Mucho más flexible y mucho más trabajo de mantener: cada tarifa nueva hay que darla de alta para cada persona.

**C · Un porcentaje por defecto, con excepciones puntuales.** Lo de A, más la posibilidad de pactar algo distinto en casos concretos.

**Recomendación: A.** Es lo que hace la competencia, aprovecha las 324 reglas ya cargadas y se explica en una frase al colaborador. Si más adelante hace falta, C se construye encima de A sin rehacer nada; al revés no.

---

## Qué NO se toca

- **Las comisiones ya liquidadas.** Ningún cambio puede alterar lo que alguien ya cobró.
- **La regla de que el administrador no cuelga de nadie.** Es lo que impide quedarse sin control de la aplicación.
- **Las tablas históricas.** Se marcan inactivas; borrarlas rompería la trazabilidad de lo ya pagado.
