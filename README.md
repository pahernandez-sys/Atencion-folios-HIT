# Mesa de Validacion HIT (Operación PCI)

Sistema web integral y responsivo diseñado para gestionar el flujo de validación y atención de errores en folios HIT mediante:
1. **Contratistas de Campo:** Suben su reporte con únicamente 4 datos y reciben un turno diario.
2. **Responsable (Mesa de Validación HIT):** Atiende los errores en orden cronológico, valida los folios y marca el ticket como finalizado para que **Integra** envíe automáticamente la confirmación por correo al contratista.
3. **Módulo Revisión TAC:** Consolidado de errores específicos ("Verifica que tu folio sea el correcto y se encuentre liquidado completado en PIC Movil") extraídos automáticamente de los archivos Excel adjuntos con acceso por PIN.

---

## 👥 Arquitectura de la Plataforma

### 1. Entidad: Contratistas
* **Formulario Minimalista:** Únicamente ingresa:
  1. Nombre Completo
  2. Teléfono de Contacto (10 dígitos)
  3. Correo Electrónico
  4. Archivo Excel con Errores (`.xlsx`, `.xls`)
* **Conteo Automático de Folios:** Cada Excel lleva una fila de encabezado y un folio por fila. El navegador lee el archivo en tiempo real mediante `SheetJS` y contabiliza automáticamente los folios.
* **Sistema de Turnos Diarios:**
  - Al enviar el reporte, se genera el ticket en Integra en estatus `en_progreso`.
  - Se le asigna un número de **Turno del Día** (ej. Turno #04).
  - En la parte superior de la web, ve un **Tablero de Turnos en Vivo**:
    * **Atendiendo Turno:** En qué turno va la responsable.
    * **Último Turno:** Cantidad de turnos registrados hoy.
    * **Tu Turno:** Notifica si está en espera o ya fue finalizado.
  - **Restablecimiento Diario:** El conteo de turnos se reinicia automáticamente cada día a las 00:00 hrs.

### 2. Entidad: Responsable de Atender Errores (Mesa de Control / Validación)
* **Pestaña Dedicada:** "Mesa de Control".
* **Cola de Tickets del Día:** Visualiza la lista de tickets ordenados por Turno correlativo.
* **Control de Turnos:** Botón *"Atender Siguiente"* para avanzar el turno actual que ven los contratistas en el tablero.
* **Validación de Folios:** El número de folios viene precalculado del Excel, con opción a ajuste manual si lo requiere.
* **Resolución y Cierre:**
  - Descarga el archivo Excel directamente desde Integra Storage.
  - Puede añadir comentarios u observaciones de la solución.
  - Al dar clic en *"Finalizar y Notificar por Correo"*:
    * Se actualiza Integra mediante `PATCH` cambiando el estatus a `finalizado`.
    * **Integra se encarga de enviar automáticamente el correo electrónico al contratista.**
    * El tablero de turnos avanza al siguiente ticket.

### 3. Entidad: Revisión TAC
* **Pestaña Dedicada:** "Revisión TAC" con acceso seguro por PIN `2468`.
* **Filtro Exclusivo:** Extrae y lista únicamente la falla de liquidación en PIC Móvil.
* Permite marcar folios atendidos y exportar el consolidado a Excel.

---

## 🛠️ Conexión con Integra API

* **Forma ID:** `179149` ("Tickets Folios HIT")
* **Subida de Archivos:** `POST https://app.linkaform.com/api/infosync/cloud_upload/`
* **Creación de Tickets:** `POST https://app.linkaform.com/api/infosync/form_answer/`
* **Actualización a Finalizado:** `PATCH https://app.linkaform.com/api/infosync/form_answer/{recordId}/`

---

## 📁 Estructura del Proyecto

```
Folios Errores HIT/
├── index.html                           # Interfaz dual (Contratistas y Mesa de Control)
├── app.js                               # Lógica de turnos diarios, SheetJS y llamadas API Linkaform
├── style.css                            # Estilos y animaciones
├── directivas_proyecto/                 # Reglas, skills y requerimientos
│   ├── reglas/
│   │   ├── 01_reglas_machine_learning.md
│   │   ├── 02_reglas_desarrollo_web.md
│   │   └── 03_reglas_integracion_linkaform.md
│   ├── skills/
│   │   ├── 01_skill_experto_machine_learning.md
│   │   ├── 02_skill_integrador_linkaform.md
│   │   └── 03_skill_frontend_developer.md
│   └── requerimientos/
│       ├── 01_requerimientos_funcionales.md
│       ├── 02_requerimientos_tecnicos_arquitectura.md
│       ├── 03_matriz_datos_linkaform.md
│       └── form_schema_179149.json
└── .github/
    └── workflows/
        └── deploy.yml                   # Despliegue automático a GitHub Pages
```

---

## 🚀 Despliegue en GitHub Pages

1. Sube tu código al repositorio de GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: Sistema de tickets y turnos para errores HIT con Linkaform"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
2. En GitHub entra a **Settings > Pages** y en **Source** selecciona **GitHub Actions**. Tu web quedará publicada de inmediato.
