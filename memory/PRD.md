# PRD - Sistema de Gestión Documental Integral

## Original Problem Statement
"quiero hacer una registro de entrada de documentacion , quiero que la documentacion recibida por diferentes medios llegue a un usuario en particular y este la repararta a los diferentes deparatamentos, administracion, direccion, tecnico, coordinacion y que se la puedan asignar a personas. Tambien quiero una gestion documental integral. Software va a funcionar en red y tambien puede que funcione en la nube."

## User Choices
- Auth: JWT email/password (custom)
- Roles confirmed + Admin role
- Spanish UI

## User Personas
1. **Administrador** — gestión de usuarios, control total.
2. **Recepcionista** — registra documentos recibidos, los reparte a departamentos.
3. **Jefe de Departamento** (administración / dirección / técnico / coordinación) — recibe documentos del dept y asigna a su personal.
4. **Personal** — recibe documentos asignados, actualiza estado.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) + JWT (PyJWT) + bcrypt + Emergent Object Storage
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI + Sonner toasts + Lucide icons
- **Design**: Swiss Brutalist light theme, Outfit (display) + IBM Plex Sans (body)
- **Storage**: archivos adjuntos en Emergent Object Storage (`gestion-documental/documents/{doc_id}/{uuid}.{ext}`)

## Implemented Features
### 2026-04-29 (v1)
- Auth JWT, RBAC, brute-force lockout
- CRUD documentos + reparto/asignación/estados
- Adjuntos via Emergent Object Storage
- Comentarios, historial, notificaciones, dashboard
- Gestión de usuarios (admin)

### 2026-04-29 (v2 - branding Hemsa)
- Logotipo Hemsa, color corporativo verde (#1FB877) en toda la app
- Favicon y title actualizados

### 2026-04-29 (v3 - plantillas + firma digital)
- Módulo de plantillas de respuesta con CRUD (admin/jefe/recepcionista pueden editar; admin elimina)
- 5 plantillas semilla: acuse, requerimiento, resolución, notificación, informe
- Marcadores `{{numero_entrada}} {{remitente}} {{asunto}} {{usuario}} {{departamento}} {{fecha_actual}} {{fecha_recepcion}}` con interpolación
- Pestaña Respuestas en detalle del documento (borrador → firmado)
- Firma digital con lienzo HTML5 (ratón + táctil), PNG base64
- Hash SHA-256 de integridad sobre id + doc_id + subject + body + user_id + user_name + signed_at
- Vista "Imprimir" con membrete Hemsa, contenido y firma manuscrita
- Cascada al eliminar documento: respuestas, comentarios e historial
- Tests: 15/15 nuevos pasados, 28 regresión OK

## Test Credentials (`/app/memory/test_credentials.md`)
- admin@gestion.com / admin123
- recepcion@gestion.com / demo123
- jefe.{admin,direccion,tecnico,coord}@gestion.com / demo123
- personal1@gestion.com / demo123 (administracion)
- personal2@gestion.com / demo123 (tecnico)

## Backlog (P1/P2)
- P1: editor de campos del documento (sender, asunto, prioridad) post-registro
- P1: exportar listado a CSV / PDF
- P1: vista de calendario / timeline de plazos
- P2: notificaciones por email (Resend / SendGrid)
- P2: firma digital de documentos
- P2: OCR automático de PDFs (texto buscable)
- P2: respaldo cifrado y compartición segura entre sedes
- P2: integración con buzón de correo entrante para auto-registro
