# Requerimientos Técnicos y de Arquitectura
## Sistema de Tickets para Folios con Errores HIT

### 1. Arquitectura de la Solución

```
+---------------------------------------------------------------------------------+
|                                 GITHUB PAGES                                    |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                 Portal Web SPA (HTML5 / TailwindCSS / JS)                 |  |
|  |                                                                           |  |
|  |  +-----------------------+  +-------------------+  +-------------------+  |  |
|  |  |  Módulo Formulario    |  |  SheetJS Parser   |  |  API Client HTTP  |  |  |
|  |  |  - Nombre             |  |  - Lectura .xlsx  |  |  - cloud_upload   |  |  |
|  |  |  - Teléfono / Email   |  |  - Conteo folios  |  |  - form_answer    |  |  |
|  |  |  - Descripción        |  |  - Detección ML   |  |  - Manejo errores |  |  |
|  |  +-----------------------+  +-------------------+  +-------------------+  |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
                                      |
                         Llamadas HTTP REST (HTTPS)
                                      v
+---------------------------------------------------------------------------------+
|                             LINKAFORM BACKEND API                               |
|                                                                                 |
|  - GET /api/infosync/get_form_for_answer/?form_id=179149 (Esquema oficial)       |
|  - POST /api/infosync/cloud_upload/ (Storage CDN Backblaze B2)                  |
|  - POST /api/infosync/form_answer/ (Creación de Registro / Folio correlativo)   |
|  - Servicio de Correo Saliente -> cbautista@operacionpci.com.mx & Solicitante   |
+---------------------------------------------------------------------------------+
```

---

### 2. Especificaciones Técnicas de Frontend
* **Entorno de Ejecución:** Navegadores modernos (Google Chrome, Safari, Microsoft Edge, Firefox, navegadores móviles Android/iOS).
* **Librerías Core:**
  - `xlsx.full.min.js` (SheetJS v0.18+): Procesamiento en memoria de archivos Excel vía ArrayBuffer.
  - Tailwind CSS: Sistema de diseño responsivo basado en utilidades, garantizando carga rápida sin frameworks pesados.
* **Compatibilidad de Red:** Optimizado para conexiones inestables de campo; reintentos automáticos en caso de interrupción temporal.

---

### 3. Integración con Linkaform
* **ID de la Forma:** `179149` ("Tickets Folios HIT")
* **Modalidad de la Forma:** Pública (`public: true`, `edit_public_records: true`).
* **Subida de Archivos:**
  - Endpoint: `https://app.linkaform.com/api/infosync/cloud_upload/`
  - Content-Type: `multipart/form-data`
* **Persistencia de Respuestas:**
  - Endpoint: `https://app.linkaform.com/api/infosync/form_answer/`
  - Content-Type: `application/json`
* **Credenciales Administrativas de Consulta/Mantenimiento:**
  - Usuario: `pahernandez@operacionpci.com.mx`
  - API Key: `003ab07a66c6795f8d3fcca2a3b6f94a7f06258e`
  - Nota de seguridad: Estas credenciales se mantienen reservadas para scripts administrativos de descarga o integración posterior, sin exponerse en el código cliente de GitHub Pages.

---

### 4. Estructura de Repositorio Sugerida para GitHub
```
repositorio-tickets-hit/
├── index.html                 # Página principal del portal
├── app.js                     # Lógica de negocio, validaciones y cliente API
├── style.css                  # Estilos y personalizaciones
├── assets/                    # Logotipos PCI / HIT e iconos
├── directivas_proyecto/       # Reglas, skills y requerimientos de arquitectura
└── .github/
    └── workflows/
        └── deploy.yml         # Despliegue automático a GitHub Pages
```
