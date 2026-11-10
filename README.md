# Agenda de Kaw

Agenda mensual digital en una sola página (`index.html`), pensada para organizar estudios, deberes, exámenes, festivos y tareas personales. Incluye cuaderno de notas.

## Qué incluye

- Calendario mensual con cambio de mes y año, y botón "Hoy".
- Tareas con título, descripción, categoría (deberes, examen, trabajo, festivo, personal), fecha, fecha final opcional y hora opcional.
- Estados: pendiente (corazón medio lleno, en rosa claro), completada (tic rosa) e importante (estrella).
- Pantallas con todas las tareas pendientes y completadas.
- Próximos exámenes, contador de pendientes, buscador y filtros por categoría.
- Cuaderno de notas con buscador y notas fijadas.
- Diseño responsive para móvil y ordenador, en modo claro.

## Cómo funciona el guardado

La página usa la base de datos compartida de los artifacts de Claude (`window.claude.use("db")`). Hay dos modos:

- **Dentro de Claude (artifact publicado):** los datos se guardan en la base compartida, se sincronizan entre las personas con acceso y siguen ahí al cerrar la página.
- **Fuera de Claude (abriendo `index.html` en un navegador o en GitHub Pages):** la base compartida no existe, así que la agenda funciona en "modo local" y guarda las tareas y notas solo en ese navegador (`localStorage`). No se comparte con nadie.

Para compartir la agenda fuera de Claude habría que cambiar el guardado a un backend propio (por ejemplo Firebase o Supabase).

## Uso local

Abre `index.html` en el navegador. No necesita instalación. Las fuentes se cargan desde Google Fonts, por lo que hace falta conexión a internet para verlas.
