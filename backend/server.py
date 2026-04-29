from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Query, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "gestion-documental")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
storage_key: Optional[str] = None

VALID_ROLES = {"admin", "recepcionista", "jefe_departamento", "personal"}
VALID_DEPARTMENTS = {"administracion", "direccion", "tecnico", "coordinacion"}
VALID_MEDIUMS = {"email", "fisico", "fax", "web", "telefono", "mensajeria", "otro"}
VALID_PRIORITIES = {"baja", "media", "alta", "urgente"}
VALID_STATUSES = {"recibido", "repartido", "asignado", "en_proceso", "finalizado", "archivado"}

app = FastAPI(title="Sistema de Gestión Documental")
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Helpers - Auth
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "department": user.get("department"),
        "created_at": user.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def require_roles(*allowed_roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Permisos insuficientes")
        return user
    return checker


# ---------------------------------------------------------------------------
# Helpers - Storage
# ---------------------------------------------------------------------------
def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY no configurada - almacenamiento deshabilitado")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Almacenamiento de objetos inicializado")
        return storage_key
    except Exception as e:
        logger.error(f"Error inicializando almacenamiento: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Almacenamiento no disponible")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 403:
        # refresh key
        global storage_key
        storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Almacenamiento no disponible")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 403:
        global storage_key
        storage_key = None
        key = init_storage()
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str
    department: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    password: Optional[str] = None


class DocumentCreate(BaseModel):
    sender: str
    subject: str
    medium: str
    priority: str = "media"
    description: Optional[str] = ""
    received_at: Optional[str] = None


class AssignDepartmentIn(BaseModel):
    department: str
    note: Optional[str] = ""


class AssignPersonIn(BaseModel):
    user_id: str
    note: Optional[str] = ""


class StatusChangeIn(BaseModel):
    status: str
    note: Optional[str] = ""


class CommentIn(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
async def log_event(document_id: str, action: str, user: dict, details: str = ""):
    await db.document_history.insert_one({
        "id": str(uuid.uuid4()),
        "document_id": document_id,
        "action": action,
        "by_user_id": user["id"],
        "by_user_name": user["name"],
        "details": details,
        "timestamp": now_iso(),
    })


async def push_notification(user_id: str, document_id: str, message: str):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "document_id": document_id,
        "message": message,
        "read": False,
        "created_at": now_iso(),
    })


@api_router.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "personal",  # default new sign-ups
        "department": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email, "personal")
    return {"token": token, "user": public_user(user_doc)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    identifier = f"login:{email}"
    attempts_doc = await db.login_attempts.find_one({"identifier": identifier})
    if attempts_doc and attempts_doc.get("locked_until"):
        locked_until = datetime.fromisoformat(attempts_doc["locked_until"])
        if locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta más tarde.")

    if not user or not verify_password(body.password, user["password_hash"]):
        # bump attempts
        count = (attempts_doc.get("count", 0) if attempts_doc else 0) + 1
        update = {"identifier": identifier, "count": count, "updated_at": now_iso()}
        if count >= 5:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
            update["count"] = 0
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/logout")
async def logout():
    return {"ok": True}


# ---------------------------------------------------------------------------
# Users management (admin)
# ---------------------------------------------------------------------------
@api_router.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    # All authenticated users can list users (needed to assign documents).
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0})
    users = await cursor.to_list(2000)
    return users


@api_router.post("/users")
async def create_user(body: UserCreate, _: dict = Depends(require_roles("admin"))):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Rol inválido")
    if body.department and body.department not in VALID_DEPARTMENTS:
        raise HTTPException(status_code=400, detail="Departamento inválido")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "department": body.department,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    return public_user(user_doc)


@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, _: dict = Depends(require_roles("admin"))):
    update = {}
    if body.name is not None:
        update["name"] = body.name
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Rol inválido")
        update["role"] = body.role
    if body.department is not None:
        if body.department and body.department not in VALID_DEPARTMENTS:
            raise HTTPException(status_code=400, detail="Departamento inválido")
        update["department"] = body.department or None
    if body.password:
        update["password_hash"] = hash_password(body.password)
    if not update:
        raise HTTPException(status_code=400, detail="Sin cambios")
    res = await db.users.update_one({"id": user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current: dict = Depends(require_roles("admin"))):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------
async def _next_entry_number() -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"id": f"entry-{year}"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    val = (counter or {}).get("value", 1) if counter else 1
    return f"REG-{year}-{str(val).zfill(5)}"


@api_router.post("/documents")
async def create_document(body: DocumentCreate, user: dict = Depends(require_roles("admin", "recepcionista"))):
    if body.medium not in VALID_MEDIUMS:
        raise HTTPException(status_code=400, detail="Medio de recepción inválido")
    if body.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail="Prioridad inválida")
    doc_id = str(uuid.uuid4())
    entry_number = await _next_entry_number()
    received_at = body.received_at or now_iso()
    doc = {
        "id": doc_id,
        "entry_number": entry_number,
        "received_at": received_at,
        "sender": body.sender,
        "subject": body.subject,
        "description": body.description or "",
        "medium": body.medium,
        "priority": body.priority,
        "status": "recibido",
        "department": None,
        "assigned_to": None,
        "assigned_to_name": None,
        "registered_by": user["id"],
        "registered_by_name": user["name"],
        "file_path": None,
        "file_name": None,
        "file_size": None,
        "content_type": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.documents.insert_one(doc)
    await log_event(doc_id, "registrado", user, f"Documento registrado: {entry_number}")
    doc.pop("_id", None)
    return doc


@api_router.get("/documents")
async def list_documents(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    department: Optional[str] = None,
    assigned_to: Optional[str] = None,
    medium: Optional[str] = None,
    priority: Optional[str] = None,
    q: Optional[str] = None,
    inbox: Optional[bool] = False,
    limit: int = 200,
):
    query: dict = {}
    if status:
        query["status"] = status
    if department:
        query["department"] = department
    if assigned_to:
        query["assigned_to"] = assigned_to
    if medium:
        query["medium"] = medium
    if priority:
        query["priority"] = priority
    if q:
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"sender": regex},
            {"subject": regex},
            {"entry_number": regex},
            {"description": regex},
        ]

    role = user["role"]
    if inbox:
        # personal/jefe view of own assignments
        query["assigned_to"] = user["id"]
    else:
        if role == "personal":
            query["assigned_to"] = user["id"]
        elif role == "jefe_departamento" and user.get("department"):
            query["department"] = user["department"]

    cursor = db.documents.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return docs


@api_router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    role = user["role"]
    if role == "personal" and doc.get("assigned_to") != user["id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if role == "jefe_departamento" and doc.get("department") and doc.get("department") != user.get("department"):
        raise HTTPException(status_code=403, detail="Sin acceso")
    return doc


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(require_roles("admin", "recepcionista"))):
    res = await db.documents.delete_one({"id": doc_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    await db.document_history.delete_many({"document_id": doc_id})
    await db.comments.delete_many({"document_id": doc_id})
    await db.responses.delete_many({"document_id": doc_id})
    return {"ok": True}


@api_router.post("/documents/{doc_id}/assign-department")
async def assign_department(
    doc_id: str,
    body: AssignDepartmentIn,
    user: dict = Depends(require_roles("admin", "recepcionista")),
):
    if body.department not in VALID_DEPARTMENTS:
        raise HTTPException(status_code=400, detail="Departamento inválido")
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {
            "department": body.department,
            "assigned_to": None,
            "assigned_to_name": None,
            "status": "repartido",
            "updated_at": now_iso(),
        }},
    )
    await log_event(doc_id, "repartido", user, f"Asignado al departamento {body.department}. {body.note or ''}".strip())
    # notify dept heads
    heads = db.users.find({"role": "jefe_departamento", "department": body.department}, {"_id": 0})
    async for head in heads:
        await push_notification(head["id"], doc_id, f"Nuevo documento {doc.get('entry_number')} repartido a tu departamento")
    return await db.documents.find_one({"id": doc_id}, {"_id": 0})


@api_router.post("/documents/{doc_id}/assign-person")
async def assign_person(
    doc_id: str,
    body: AssignPersonIn,
    user: dict = Depends(require_roles("admin", "recepcionista", "jefe_departamento")),
):
    target = await db.users.find_one({"id": body.user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if user["role"] == "jefe_departamento":
        if doc.get("department") != user.get("department"):
            raise HTTPException(status_code=403, detail="Documento fuera de tu departamento")
    update = {
        "assigned_to": target["id"],
        "assigned_to_name": target["name"],
        "status": "asignado",
        "updated_at": now_iso(),
    }
    if target.get("department") and not doc.get("department"):
        update["department"] = target["department"]
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    await log_event(doc_id, "asignado", user, f"Asignado a {target['name']}. {body.note or ''}".strip())
    await push_notification(target["id"], doc_id, f"Te han asignado el documento {doc.get('entry_number')}")
    return await db.documents.find_one({"id": doc_id}, {"_id": 0})


@api_router.post("/documents/{doc_id}/status")
async def change_status(doc_id: str, body: StatusChangeIn, user: dict = Depends(get_current_user)):
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Estado inválido")
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    role = user["role"]
    if role == "personal" and doc.get("assigned_to") != user["id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if role == "jefe_departamento" and doc.get("department") != user.get("department"):
        raise HTTPException(status_code=403, detail="Sin acceso")
    await db.documents.update_one({"id": doc_id}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    await log_event(doc_id, "estado_cambiado", user, f"Estado: {body.status}. {body.note or ''}".strip())
    return await db.documents.find_one({"id": doc_id}, {"_id": 0})


@api_router.post("/documents/{doc_id}/upload")
async def upload_document_file(
    doc_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_roles("admin", "recepcionista", "jefe_departamento", "personal")),
):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_NAME}/documents/{doc_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (max 25MB)")
    content_type = file.content_type or "application/octet-stream"
    result = put_object(path, data, content_type)
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {
            "file_path": result["path"],
            "file_name": file.filename,
            "file_size": result.get("size", len(data)),
            "content_type": content_type,
            "updated_at": now_iso(),
        }},
    )
    await log_event(doc_id, "archivo_subido", user, f"Archivo: {file.filename}")
    return await db.documents.find_one({"id": doc_id}, {"_id": 0})


@api_router.get("/documents/{doc_id}/download")
async def download_document_file(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc or not doc.get("file_path"):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    role = user["role"]
    if role == "personal" and doc.get("assigned_to") != user["id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if role == "jefe_departamento" and doc.get("department") and doc.get("department") != user.get("department"):
        raise HTTPException(status_code=403, detail="Sin acceso")
    data, content_type = get_object(doc["file_path"])
    headers = {"Content-Disposition": f'attachment; filename="{doc.get("file_name", "archivo")}"'}
    return Response(content=data, media_type=doc.get("content_type") or content_type, headers=headers)


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
@api_router.get("/documents/{doc_id}/comments")
async def list_comments(doc_id: str, _: dict = Depends(get_current_user)):
    cursor = db.comments.find({"document_id": doc_id}, {"_id": 0}).sort("created_at", 1)
    return await cursor.to_list(1000)


@api_router.post("/documents/{doc_id}/comments")
async def add_comment(doc_id: str, body: CommentIn, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    comment = {
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": body.text,
        "created_at": now_iso(),
    }
    await db.comments.insert_one(comment)
    comment.pop("_id", None)
    return comment


@api_router.get("/documents/{doc_id}/history")
async def list_history(doc_id: str, _: dict = Depends(get_current_user)):
    cursor = db.document_history.find({"document_id": doc_id}, {"_id": 0}).sort("timestamp", 1)
    return await cursor.to_list(1000)


# ---------------------------------------------------------------------------
# Templates (response templates)
# ---------------------------------------------------------------------------
VALID_TEMPLATE_CATEGORIES = {"acuse", "requerimiento", "resolucion", "notificacion", "informe", "otro"}


class TemplateIn(BaseModel):
    name: str
    category: str = "otro"
    subject: str
    body: str


@api_router.get("/templates")
async def list_templates(_: dict = Depends(get_current_user)):
    cursor = db.templates.find({}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(500)


@api_router.post("/templates")
async def create_template(body: TemplateIn, user: dict = Depends(require_roles("admin", "jefe_departamento", "recepcionista"))):
    if body.category not in VALID_TEMPLATE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoría inválida")
    t = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "category": body.category,
        "subject": body.subject,
        "body": body.body,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.templates.insert_one(t)
    t.pop("_id", None)
    return t


@api_router.patch("/templates/{tid}")
async def update_template(tid: str, body: TemplateIn, _: dict = Depends(require_roles("admin", "jefe_departamento", "recepcionista"))):
    if body.category not in VALID_TEMPLATE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoría inválida")
    update = {
        "name": body.name,
        "category": body.category,
        "subject": body.subject,
        "body": body.body,
        "updated_at": now_iso(),
    }
    res = await db.templates.update_one({"id": tid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return await db.templates.find_one({"id": tid}, {"_id": 0})


@api_router.delete("/templates/{tid}")
async def delete_template(tid: str, _: dict = Depends(require_roles("admin"))):
    res = await db.templates.delete_one({"id": tid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Responses (with digital signature)
# ---------------------------------------------------------------------------
class ResponseCreate(BaseModel):
    template_id: Optional[str] = None
    subject: str
    body: str


class ResponseUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None


class ResponseSignIn(BaseModel):
    signature_image: str  # base64 data URL (image/png)


def _can_view_doc(doc: dict, user: dict) -> bool:
    role = user["role"]
    if role == "admin" or role == "recepcionista":
        return True
    if role == "jefe_departamento":
        return (not doc.get("department")) or doc.get("department") == user.get("department")
    if role == "personal":
        return doc.get("assigned_to") == user["id"]
    return False


@api_router.get("/documents/{doc_id}/responses")
async def list_responses(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not _can_view_doc(doc, user):
        raise HTTPException(status_code=403, detail="Sin acceso")
    cursor = db.responses.find({"document_id": doc_id}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@api_router.post("/documents/{doc_id}/responses")
async def create_response(doc_id: str, body: ResponseCreate, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not _can_view_doc(doc, user):
        raise HTTPException(status_code=403, detail="Sin acceso")
    r = {
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "template_id": body.template_id,
        "subject": body.subject,
        "body": body.body,
        "status": "borrador",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "signed_by": None,
        "signed_by_name": None,
        "signed_at": None,
        "signature_image": None,
        "signature_hash": None,
    }
    await db.responses.insert_one(r)
    await log_event(doc_id, "respuesta_creada", user, f"Borrador: {body.subject}")
    r.pop("_id", None)
    return r


@api_router.get("/responses/{rid}")
async def get_response(rid: str, user: dict = Depends(get_current_user)):
    r = await db.responses.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Respuesta no encontrada")
    doc = await db.documents.find_one({"id": r["document_id"]})
    if not doc or not _can_view_doc(doc, user):
        raise HTTPException(status_code=403, detail="Sin acceso")
    return r


@api_router.patch("/responses/{rid}")
async def update_response(rid: str, body: ResponseUpdate, user: dict = Depends(get_current_user)):
    r = await db.responses.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Respuesta no encontrada")
    if r["status"] == "firmado":
        raise HTTPException(status_code=400, detail="Respuesta firmada, no editable")
    if r["created_by"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Sin permisos")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Sin cambios")
    update["updated_at"] = now_iso()
    await db.responses.update_one({"id": rid}, {"$set": update})
    return await db.responses.find_one({"id": rid}, {"_id": 0})


@api_router.post("/responses/{rid}/sign")
async def sign_response(rid: str, body: ResponseSignIn, user: dict = Depends(get_current_user)):
    r = await db.responses.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Respuesta no encontrada")
    if r["status"] == "firmado":
        raise HTTPException(status_code=400, detail="La respuesta ya está firmada")
    if not body.signature_image.startswith("data:image"):
        raise HTTPException(status_code=400, detail="Imagen de firma inválida")
    if len(body.signature_image) > 1_500_000:
        raise HTTPException(status_code=400, detail="Imagen de firma demasiado grande")
    signed_at = now_iso()
    payload = f"{rid}|{r['document_id']}|{r['subject']}|{r['body']}|{user['id']}|{user['name']}|{signed_at}"
    sig_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    update = {
        "status": "firmado",
        "signed_by": user["id"],
        "signed_by_name": user["name"],
        "signed_at": signed_at,
        "signature_image": body.signature_image,
        "signature_hash": sig_hash,
        "updated_at": signed_at,
    }
    await db.responses.update_one({"id": rid}, {"$set": update})
    await log_event(r["document_id"], "respuesta_firmada", user, f"Firmada: {r['subject']} (hash {sig_hash[:12]}…)")
    return await db.responses.find_one({"id": rid}, {"_id": 0})


@api_router.delete("/responses/{rid}")
async def delete_response(rid: str, user: dict = Depends(get_current_user)):
    r = await db.responses.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Respuesta no encontrada")
    if user["role"] != "admin" and not (r["created_by"] == user["id"] and r["status"] == "borrador"):
        raise HTTPException(status_code=403, detail="Sin permisos")
    await db.responses.delete_one({"id": rid})
    await log_event(r["document_id"], "respuesta_eliminada", user, f"{r.get('subject','')}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    return await cursor.to_list(100)


@api_router.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
@api_router.get("/stats/dashboard")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    base_query: dict = {}
    role = user["role"]
    if role == "personal":
        base_query["assigned_to"] = user["id"]
    elif role == "jefe_departamento" and user.get("department"):
        base_query["department"] = user["department"]

    total = await db.documents.count_documents(base_query)
    by_status = {}
    for s in VALID_STATUSES:
        by_status[s] = await db.documents.count_documents({**base_query, "status": s})

    by_dept = {}
    for d in VALID_DEPARTMENTS:
        by_dept[d] = await db.documents.count_documents({**base_query, "department": d})

    by_priority = {}
    for p in VALID_PRIORITIES:
        by_priority[p] = await db.documents.count_documents({**base_query, "priority": p})

    # last 7 days counts
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    timeline = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)
        cnt = await db.documents.count_documents({
            **base_query,
            "created_at": {"$gte": day.isoformat(), "$lt": next_day.isoformat()},
        })
        timeline.append({"date": day.strftime("%Y-%m-%d"), "label": day.strftime("%a"), "count": cnt})

    recent_cursor = db.documents.find(base_query, {"_id": 0}).sort("created_at", -1).limit(8)
    recent = await recent_cursor.to_list(8)

    unread_notifs = await db.notifications.count_documents({"user_id": user["id"], "read": False})

    return {
        "total": total,
        "by_status": by_status,
        "by_department": by_dept,
        "by_priority": by_priority,
        "timeline": timeline,
        "recent": recent,
        "unread_notifications": unread_notifs,
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"app": "Sistema de Gestión Documental", "ok": True}


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@gestion.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrador",
            "role": "admin",
            "department": None,
            "created_at": now_iso(),
        })
        logger.info(f"Admin sembrado: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        logger.info("Contraseña de admin actualizada desde .env")


async def seed_demo_users():
    demo_users = [
        {"email": "recepcion@gestion.com", "name": "Lucía Recepción", "role": "recepcionista", "department": None, "password": "demo123"},
        {"email": "jefe.admin@gestion.com", "name": "Carlos Admin", "role": "jefe_departamento", "department": "administracion", "password": "demo123"},
        {"email": "jefe.direccion@gestion.com", "name": "María Dirección", "role": "jefe_departamento", "department": "direccion", "password": "demo123"},
        {"email": "jefe.tecnico@gestion.com", "name": "Pedro Técnico", "role": "jefe_departamento", "department": "tecnico", "password": "demo123"},
        {"email": "jefe.coord@gestion.com", "name": "Ana Coordinación", "role": "jefe_departamento", "department": "coordinacion", "password": "demo123"},
        {"email": "personal1@gestion.com", "name": "Juan Pérez", "role": "personal", "department": "administracion", "password": "demo123"},
        {"email": "personal2@gestion.com", "name": "Sofía López", "role": "personal", "department": "tecnico", "password": "demo123"},
    ]
    for u in demo_users:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            continue
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": u["email"],
            "password_hash": hash_password(u["password"]),
            "name": u["name"],
            "role": u["role"],
            "department": u["department"],
            "created_at": now_iso(),
        })


async def seed_templates():
    if await db.templates.count_documents({}) > 0:
        return
    defaults = [
        {
            "name": "Acuse de recibo",
            "category": "acuse",
            "subject": "Acuse de recibo - Expediente {{numero_entrada}}",
            "body": "Estimado/a {{remitente}},\n\nLe confirmamos la recepción de su documento con número de entrada {{numero_entrada}} relativo a \"{{asunto}}\", registrado el {{fecha_recepcion}}.\n\nSe han iniciado las actuaciones correspondientes y será informado/a oportunamente del trámite.\n\nAtentamente,\n\n{{usuario}}\n{{departamento}}\nHemsa - Servicios Públicos Municipales · San Fernando",
        },
        {
            "name": "Requerimiento de subsanación",
            "category": "requerimiento",
            "subject": "Requerimiento de subsanación - Expediente {{numero_entrada}}",
            "body": "Estimado/a {{remitente}},\n\nEn relación con su documento con número de entrada {{numero_entrada}} (\"{{asunto}}\"), se le requiere para que en el plazo máximo de DIEZ (10) días hábiles aporte la siguiente documentación:\n\n  - [Documento o aclaración requerida]\n\nLe advertimos de que, transcurrido dicho plazo sin atender al requerimiento, se le tendrá por desistido de su solicitud.\n\nAtentamente,\n\n{{usuario}}\n{{departamento}}\nHemsa - Servicios Públicos Municipales · San Fernando",
        },
        {
            "name": "Resolución",
            "category": "resolucion",
            "subject": "Resolución expediente {{numero_entrada}}",
            "body": "RESOLUCIÓN\n\nVisto el expediente {{numero_entrada}} relativo a \"{{asunto}}\" presentado por {{remitente}}, y de conformidad con la normativa aplicable,\n\nRESUELVE:\n\n  PRIMERO. - [Descripción de la resolución].\n  SEGUNDO. - [Acto administrativo o medida acordada].\n\nContra esta resolución podrán interponerse los recursos previstos en la legislación vigente.\n\nEn San Fernando, a {{fecha_actual}}.\n\n{{usuario}}\n{{departamento}}",
        },
        {
            "name": "Notificación general",
            "category": "notificacion",
            "subject": "Notificación - {{asunto}}",
            "body": "Estimado/a {{remitente}},\n\nPor la presente le notificamos en relación al expediente {{numero_entrada}} (\"{{asunto}}\") lo siguiente:\n\n[Contenido de la notificación]\n\nAtentamente,\n\n{{usuario}}\n{{departamento}}\nHemsa - Servicios Públicos Municipales · San Fernando",
        },
        {
            "name": "Informe técnico",
            "category": "informe",
            "subject": "Informe técnico - Expediente {{numero_entrada}}",
            "body": "INFORME TÉCNICO\n\nExpediente: {{numero_entrada}}\nAsunto: {{asunto}}\nSolicitante: {{remitente}}\nFecha: {{fecha_actual}}\n\nANTECEDENTES\n\n  [Descripción de antecedentes]\n\nVALORACIÓN TÉCNICA\n\n  [Análisis y consideraciones]\n\nCONCLUSIONES\n\n  [Conclusiones del informe]\n\n{{usuario}}\n{{departamento}}",
        },
    ]
    now = now_iso()
    for d in defaults:
        await db.templates.insert_one({
            "id": str(uuid.uuid4()),
            **d,
            "created_by": "system",
            "created_by_name": "Sistema",
            "created_at": now,
            "updated_at": now,
        })
    logger.info(f"Plantillas semilla creadas: {len(defaults)}")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.documents.create_index("entry_number")
    await db.documents.create_index("status")
    await db.documents.create_index("department")
    await db.documents.create_index("assigned_to")
    await db.notifications.create_index("user_id")
    await db.document_history.create_index("document_id")
    await db.comments.create_index("document_id")
    await db.responses.create_index("document_id")
    await db.templates.create_index("category")
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    await seed_demo_users()
    await seed_templates()
    init_storage()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------------------------------------------------------------------------
# Mount router & CORS
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
