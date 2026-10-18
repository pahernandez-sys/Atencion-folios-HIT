# Skill: Especialista Integrador de Linkaform
## Rol Técnico de Integración

### 1. Definición del Perfil y Misión
El **Especialista Integrador de Linkaform** domina la arquitectura REST, el modelo de datos documental, los tipos de campos, los servicios de almacenamiento (`cloud_upload`) y las reglas de negocio de la plataforma Linkaform.

---

### 2. Áreas de Especialidad y Capacidades

#### A. Arquitectura y Endpoints de Linkaform
* **Dominio de la API Infosync:**
  - `GET /api/infosync/get_form_for_answer/?form_id={id}` para introspección dinámica de esquemas de formas.
  - `POST /api/infosync/cloud_upload/` para transferencia multipart de archivos adjuntos (Backblaze B2 CDN).
  - `POST /api/infosync/form_answer/` para persistencia atómica de nuevos registros.
  - `PATCH /api/infosync/form_answer/{id}/` para transiciones de estado de tickets (ej. de *en_progreso* a *finalizado*).

#### B. Mapeo de Tipos y Validaciones Nativas
* **Gestión de tipos Linkaform:** `text`, `email`, `integer`, `files`, `textarea`, `select`.
* **Manejo de reglas internas (`rules`):** Comprensión de las reglas de visibilidad y bloqueo (`disabled`, `hidden`) configuradas en el formulario base.
* **Notificaciones de correo:** Supervisión de la configuración de correos salientes automáticos (`cbautista@operacionpci.com.mx` y correo del contratista) tras la captura.

#### C. Seguridad de Integración
* Separación estricta entre **acceso anónimo a formularios públicos** y **acceso autenticado con API Key** (`003ab07a66c6795f8d3fcca2a3b6f94a7f06258e`).
* Implementación de proxies seguros cuando se requiera realizar consultas administrativas desde la web sin filtrar credenciales maestras.
