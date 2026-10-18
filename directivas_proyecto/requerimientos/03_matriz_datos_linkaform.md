# Matriz de Datos y Ciclo de Vida de Tickets Linkaform
## Forma: "Tickets Folios HIT" (ID: 179149)

### 1. Diccionario de Datos Oficial

| Campo | `field_id` | Tipo | Capturado por | Rol en el Sistema |
| :--- | :--- | :--- | :---: | :--- |
| **Nombre** | `6ab1478e5fe35fa36de6cb1e` | `text` | Contratista | Nombre del solicitante |
| **Teléfono de contacto** | `6ab1478e5fe35fa36de6cb1f` | `text` | Contratista | 10 dígitos de contacto |
| **Email** | `6ab599c75e02297c1d2a03df` | `email` | Contratista | Recibe el correo automático al finalizar |
| **Excel de carga (Errores)**| `6ab1478e5fe35fa36de6cb21` | `files` | Contratista | Archivo Excel subido a Backblaze B2 |
| **Número de folios en excel**| `6abc1b54d480ac87e62ccc17` | `integer` | Automático / Responsable | Conteo de folios (1 por fila tras encabezado) |
| **Descripción** | `6ace7405cb9c71e698addfc1` | `textarea` | Responsable | Comentarios u observaciones de resolución |
| **Estatus** | `6ab1478e5fe35fa36de6cb23` | `select` | Sistema / Responsable | `"en_progreso"` (inicial) → `"finalizado"` (final) |

---

### 2. Ciclo de Vida del Ticket

#### Fase 1: Creación por Contratista (`POST /api/infosync/form_answer/`)
```json
{
  "form_id": 179149,
  "geolocation": [],
  "answers": {
    "6ab1478e5fe35fa36de6cb1e": "SAID ARMANDO GONZALEZ PARMA",
    "6ab1478e5fe35fa36de6cb1f": "6462456583",
    "6ab599c75e02297c1d2a03df": "auxiliar.durangonortepci@gmail.com",
    "6ab1478e5fe35fa36de6cb21": [
      {
        "file_name": "Reporte_Errores_Folios_HIT.xlsx",
        "file_url": "https://f001.backblazeb2.com/file/app-linkaform/public-client-1259/179149/6ab1478e5fe35fa36de6cb21/xxxx.xlsx"
      }
    ],
    "6abc1b54d480ac87e62ccc17": 12,
    "6ace7405cb9c71e698addfc1": "Incidencia reportada por contratista.",
    "6ab1478e5fe35fa36de6cb23": "en_progreso"
  }
}
```

#### Fase 2: Resolución por la Responsable (`PATCH /api/infosync/form_answer/{recordId}/`)
```json
{
  "form_id": 179149,
  "geolocation": [],
  "answers": {
    "6ab1478e5fe35fa36de6cb1e": "SAID ARMANDO GONZALEZ PARMA",
    "6ab1478e5fe35fa36de6cb1f": "6462456583",
    "6ab599c75e02297c1d2a03df": "auxiliar.durangonortepci@gmail.com",
    "6ab1478e5fe35fa36de6cb21": [
      {
        "file_name": "Reporte_Errores_Folios_HIT.xlsx",
        "file_url": "https://f001.backblazeb2.com/file/app-linkaform/public-client-1259/179149/6ab1478e5fe35fa36de6cb21/xxxx.xlsx"
      }
    ],
    "6abc1b54d480ac87e62ccc17": 12,
    "6ace7405cb9c71e698addfc1": "Folios validados y regularizados correctamente en el sistema HIT.",
    "6ab1478e5fe35fa36de6cb23": "finalizado"
  }
}
```

> **Efecto de la Fase 2:** Al transicionar `Estatus` a `"finalizado"`, Linkaform activa el disparador de correo electrónico enviando la notificación al correo del contratista.
