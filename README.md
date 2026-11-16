# GradeCheck

App para calcular la nota que necesitas en cada examen para aprobar una asignatura.
Funciona como **app de Android (APK)** y como **web instalable en iPhone** (o en cualquier
navegador): <https://marioprincesita.github.io/GradeCheck/>

Basada en [GradeCalc](https://github.com/mauriciabad/GradeCalc) de Maurici Abad (licencia ISC):
mismo diseño, tarjetas y animaciones, sin cuentas ni nube y con estas mejoras:

- **Crear asignaturas más rápido**: Cuatrimestre (Q1 / Q2 / Anual) y año académico vienen
  preseleccionados según la fecha. Facultad y Universidad se rellenan con las últimas que usaste
  y sugieren las anteriores.
- **Categorías recordadas**: al escribir una categoría (p. ej. `Labs`) aparece como sugerencia en
  las filas de abajo y en otras asignaturas. Si pones `Lab2` y ya existe `Lab1`, la categoría se
  rellena sola. Las sugerencias se pueden borrar con la × (o desde ⚙️ Ajustes).
- **Evaluación alternativa opcional**: por defecto solo hay una columna de porcentajes ("Peso"),
  sin nombre. Con **+ Evaluación alternativa** añades otra columna con nombre (p. ej. `Continua` y
  `Única`) y en la tarjeta eliges cuál usar.
- **Guardado automático**: cada nota se guarda al momento en el móvil (almacenamiento nativo de
  Android, o el del navegador en la web) y sigue ahí al cerrar la app y al actualizarla.
- **Copia de seguridad**: ⚙️ → Exportar crea un `.json` que puedes guardar en Drive o en Archivos.
  Importar lo restaura (reemplaza los datos actuales). Sirve también para pasar las notas de un
  móvil a otro, incluso de Android a iPhone.

## Instalar en iPhone

1. Abre <https://marioprincesita.github.io/GradeCheck/> en **Safari**.
2. Pulsa **Compartir** (el cuadrado con la flecha) → **Añadir a pantalla de inicio**.
3. Ábrela desde el icono: va a pantalla completa, funciona sin internet y guarda tus notas.

> ⚠️ Instálala **antes** de poner notas: en iPhone, lo que guardes en Safari no pasa a la app
> instalada (si ya lo hiciste, usa Exportar en Safari e Importar en la app).
>
> Las actualizaciones llegan solas: cada vez que se sube algo a `main` se publica la web
> (pestaña **Actions → Web (GitHub Pages)**) y la app la descarga la siguiente vez que la abres
> con internet.

## Instalar en Android

1. Cada vez que se sube algo a la rama `main`, GitHub Actions compila el APK
   (pestaña **Actions → Android APK**, tarda unos 5 minutos).
2. En el móvil, abre el repositorio en GitHub → **Releases → GradeCheck → `GradeCheck.apk`** y
   descárgalo.
3. Ábrelo y acepta *instalar apps de origen desconocido* para tu navegador la primera vez.
4. Para actualizar, repite los pasos 2 y 3: se instala encima y **tus notas se mantienen**.

> El APK se firma siempre con la misma clave de depuración (`android/app/debug.keystore`). Por eso
> cada versión se instala como actualización. Esa clave es pública: sirve para instalar la app tú
> mismo, pero no para publicarla en Google Play.
>
> ⚠️ Si **desinstalas** la app, Android borra sus datos. Exporta antes una copia de seguridad.

## Desarrollo

Necesitas [Node.js](https://nodejs.org) 22 o superior.

```bash
npm install
npm run dev      # abre http://localhost:5173 (usa la vista de móvil del navegador)
npm test         # tests del cálculo de notas
npm run build    # genera la web en dist/
```

### Compilar el APK en tu PC (opcional)

No hace falta (lo hace GitHub), pero si quieres: instala
[Android Studio](https://developer.android.com/studio) y luego:

```bash
npm run android:sync   # build + copia la web al proyecto Android
npm run android:open   # abre Android Studio -> Run ▶ (con el móvil conectado por USB)
```

### Estructura

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Estructura de la página (barra superior, popups, toast) |
| `src/styles/main.css` | Estilos, casi todos copiados de GradeCalc |
| `src/dashboard.js` | Tarjetas de asignaturas, barra de notas, confeti |
| `src/editor.js` | Popup de crear / editar asignatura |
| `src/autocomplete.js` | Desplegable de sugerencias |
| `src/grades.js` | Cálculo de nota final y nota necesaria |
| `src/store.js` | Datos y guardado (Preferences en Android, localStorage en web) |
| `src/backup.js`, `src/settings.js` | Copia de seguridad y popup de ajustes |
| `android/` | Proyecto Android generado por Capacitor |
| `scripts/make-icons.mjs` | Genera los iconos (`npm run icons`) |
| `.github/workflows/android.yml` | Compila y publica el APK |
| `.github/workflows/pages.yml` | Publica la web en GitHub Pages |
| `public/sw.js` | Service worker: la web funciona sin internet |

### Cambiar el icono

Edita el SVG de `scripts/make-icons.mjs` y ejecuta:

```bash
npm run icons
npx capacitor-assets generate --android --iconBackgroundColor '#1b9f64' --splashBackgroundColor '#1b9f64'
```
