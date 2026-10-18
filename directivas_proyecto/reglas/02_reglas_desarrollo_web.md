# Directiva y Reglas de Desarrollo Web (Frontend & GitHub)
## Proyecto: Portal Web de Tickets para Contratistas HIT

### 1. Arquitectura de Despliegue en GitHub
* **Modelo de Alojamiento:** **GitHub Pages** (Single Page Application - SPA estática, sin servidor dedicado intermedio requerido para la interfaz).
* **Stack Tecnológico Recomendado:**
  - **Framework UI:** HTML5 + Tailwind CSS + JavaScript moderno (ESModules) o Vue 3 / React empacado con Vite.
  - **Motor de Procesamiento Excel en Cliente:** `SheetJS (xlsx.full.min.js)` para parseo inmediato sin subir el archivo a servidores de terceros.
  - **Cliente HTTP:** Fetch API nativo con manejo de streams o `axios` para control fino de subida de archivos multipart y barras de progreso.

---

### 2. Principios de Experiencia de Usuario (UX/UI) para Contratistas en Campo

#### R-WEB-01: Enfoque Mobile-First y Ergonomía de Campo
* La mayoría de contratistas reportan desde smartphones o tablets en campo:
  - Componentes táctiles grandes (botones con altura mínima de 48px).
  - Formularios de un solo paso o flujo guiado en 3 pasos claros (Datos de Contacto -> Carga de Archivo -> Resumen y Envío).
  - Tipografías legibles con alto contraste visual (WCAG AA).

#### R-WEB-02: Carga de Archivo Interactiva (Drag & Drop + Explorador)
* Zona de carga visual con soporte para:
  - Arrastrar y soltar archivos `.xlsx` / `.xls`.
  - Botón tradicional para seleccionar archivo desde el gestor del dispositivo móvil.
  - Barra de progreso real durante la subida al servicio en la nube de Linkaform (`cloud_upload`).
  - Previsualización inmediata del resumen: Nombre del archivo, tamaño en KB/MB y número de folios detectados.

#### R-WEB-03: Validaciones en Tiempo Real en Cliente
* **Nombre:** Campo requerido, mínimo 3 caracteres alfabéticos.
* **Teléfono:** 10 dígitos numéricos exactos, con máscara automática `(###) ###-####`.
* **Email:** Formato de correo válido con regex RFC 5322 para garantizar que el contratista reciba la confirmación de Linkaform (`Se ha creado un folio para atención de errores HIT`).
* **Descripción:** Validación opcional/recomendada con contador de caracteres (mínimo 10 caracteres sugeridos para dar contexto suficiente).
* **Bloqueo contra envíos duplicados:** El botón "Enviar Ticket" debe deshabilitarse inmediatamente tras el primer clic, mostrando un spinner de carga (`Subiendo archivo y registrando ticket...`).

---

### 3. Manejo de Estados y Mensajes de Confirmación

#### R-WEB-04: Confirmación Transparente con Folio Asignado
* Al completarse el envío exitoso a Linkaform:
  - Limpieza del formulario.
  - Pantalla modal o banner de éxito prominente con:
    * **Folio de Ticket generado** (retornado por Linkaform).
    * Mensaje: *"Su ticket ha sido registrado con éxito. Se ha enviado una notificación por correo electrónico."*
    * Botón para *"Registrar otro ticket"*.

#### R-WEB-05: Resiliencia ante Fallas de Conexión
* Si la red del contratista falla durante el envío:
  - Notificación no intrusiva con botón *"Reintentar envío"* sin perder la información ya escrita ni el archivo ya seleccionado.
  - Cache local temporal en `sessionStorage` para evitar pérdida de datos si el navegador se refresca accidentalmente.
