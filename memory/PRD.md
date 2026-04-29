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

## Implemented Features (2026-04-29)
### Backend
- Auth: register, login (con anti brute-force 5 intentos / 15 min), `/me`, logout
- RBAC con dependency `require_roles(...)`
- Usuarios: list (todos auth), create/update/delete (admin)
- Documentos: CRUD + filtros (status, department, assigned_to, medium, priority, q, inbox), número de entrada autoincremental `REG-YYYY-NNNNN`
- Reparto: assign-department (recepcionista/admin) → status `repartido` + notifica a jefes
- Asignación: assign-person (recepcionista/admin/jefe con restricción de dept) → status `asignado` + notifica al usuario
- Cambios de estado: recibido / repartido / asignado / en_proceso / finalizado / archivado
- Adjuntos: upload (multipart, max 25MB) + download via Emergent Object Storage
- Comentarios y trazabilidad (history) por documento
- Notificaciones in-app (list, mark-read, mark-all)
- Stats dashboard con timeline 7 días, breakdown por estado/dept/prioridad
- Seed automático: admin + 7 usuarios demo

### Frontend
- Login / Register (split-screen Swiss layout)
- Dashboard con KPIs, mini gráfica 7 días, breakdown estados/depts y actividad reciente
- Listado de documentos con filtros y búsqueda
- Formulario de registro de entrada con subida de archivo
- Detalle de documento con paneles de reparto, asignación, cambio de estado, eliminar
- Tabs de Comentarios e Historial
- Mi Bandeja (asignados a mí)
- Página de Usuarios (admin) con dialogo crear/editar
- Centro de Notificaciones
- Sidebar + topbar con búsqueda + dropdown de usuario

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
