"""End-to-end backend tests for Sistema de Gestión Documental."""
import os
import io
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-router-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@gestion.com", "password": "admin123"}
RECEP = {"email": "recepcion@gestion.com", "password": "demo123"}
JEFE_TEC = {"email": "jefe.tecnico@gestion.com", "password": "demo123"}
PERSONAL = {"email": "personal2@gestion.com", "password": "demo123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.text}"
    return r.json()["token"], r.json()["user"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    t, _ = _login(ADMIN)
    return t


@pytest.fixture(scope="session")
def recep_token():
    t, _ = _login(RECEP)
    return t


@pytest.fixture(scope="session")
def jefe_token():
    t, _ = _login(JEFE_TEC)
    return t


@pytest.fixture(scope="session")
def personal_data():
    t, u = _login(PERSONAL)
    return t, u


# ---------- Health ----------
def test_root():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------- Auth ----------
def test_login_admin_success():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["user"]["role"] == "admin"


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "noexist@x.com", "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_me_with_token(admin_token):
    r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN["email"]


def test_me_without_token():
    r = requests.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 401


def test_register_new_user_default_personal():
    email = f"TEST_reg_{uuid.uuid4().hex[:8]}@x.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "Test Reg"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["role"] == "personal"
    assert "token" in data


# ---------- Users ----------
def test_list_users_any_auth(personal_data):
    token, _ = personal_data
    r = requests.get(f"{API}/users", headers=_h(token), timeout=10)
    assert r.status_code == 200
    users = r.json()
    assert any(u["email"] == "admin@gestion.com" for u in users)
    # ensure no password_hash leak
    assert all("password_hash" not in u for u in users)


def test_create_user_admin_only(recep_token):
    r = requests.post(f"{API}/users", headers=_h(recep_token),
                      json={"email": "TEST_unauth@x.com", "password": "secret123", "name": "x", "role": "personal"},
                      timeout=10)
    assert r.status_code == 403


def test_create_update_delete_user(admin_token):
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@x.com"
    r = requests.post(f"{API}/users", headers=_h(admin_token),
                      json={"email": email, "password": "secret123", "name": "Tmp User", "role": "personal", "department": "tecnico"},
                      timeout=10)
    assert r.status_code == 200
    user = r.json()
    uid = user["id"]
    assert user["role"] == "personal"
    assert user["department"] == "tecnico"

    # update
    r = requests.patch(f"{API}/users/{uid}", headers=_h(admin_token), json={"name": "Renamed"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"

    # delete
    r = requests.delete(f"{API}/users/{uid}", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200


# ---------- Documents workflow ----------
@pytest.fixture(scope="session")
def created_document(recep_token):
    payload = {
        "sender": "TEST_Sender",
        "subject": "TEST_Subject_Workflow",
        "medium": "email",
        "priority": "media",
        "description": "Test description",
    }
    r = requests.post(f"{API}/documents", headers=_h(recep_token), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["status"] == "recibido"
    assert doc["entry_number"].startswith("REG-")
    return doc


def test_create_document_personal_forbidden(personal_data):
    token, _ = personal_data
    r = requests.post(f"{API}/documents", headers=_h(token),
                      json={"sender": "x", "subject": "x", "medium": "email"}, timeout=10)
    assert r.status_code == 403


def test_create_document_invalid_medium(recep_token):
    r = requests.post(f"{API}/documents", headers=_h(recep_token),
                      json={"sender": "x", "subject": "x", "medium": "invalid_medium"}, timeout=10)
    assert r.status_code == 400


def test_get_document(created_document, recep_token):
    r = requests.get(f"{API}/documents/{created_document['id']}", headers=_h(recep_token), timeout=10)
    assert r.status_code == 200
    assert r.json()["id"] == created_document["id"]


def test_list_documents_filter(recep_token, created_document):
    r = requests.get(f"{API}/documents", headers=_h(recep_token), params={"q": "TEST_Subject_Workflow"}, timeout=10)
    assert r.status_code == 200
    docs = r.json()
    assert any(d["id"] == created_document["id"] for d in docs)


def test_assign_department(recep_token, created_document):
    doc_id = created_document["id"]
    r = requests.post(f"{API}/documents/{doc_id}/assign-department", headers=_h(recep_token),
                      json={"department": "tecnico", "note": "para revisar"}, timeout=15)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["department"] == "tecnico"
    assert doc["status"] == "repartido"


def test_jefe_sees_dept_doc(jefe_token, created_document):
    r = requests.get(f"{API}/documents", headers=_h(jefe_token), timeout=10)
    assert r.status_code == 200
    assert any(d["id"] == created_document["id"] for d in r.json())


def test_jefe_notification_created(jefe_token, created_document):
    r = requests.get(f"{API}/notifications", headers=_h(jefe_token), timeout=10)
    assert r.status_code == 200
    notifs = r.json()
    assert any(n["document_id"] == created_document["id"] for n in notifs)


def test_assign_person_by_jefe(jefe_token, personal_data, created_document):
    _, personal_user = personal_data
    doc_id = created_document["id"]
    r = requests.post(f"{API}/documents/{doc_id}/assign-person", headers=_h(jefe_token),
                      json={"user_id": personal_user["id"], "note": "asignado"}, timeout=15)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["assigned_to"] == personal_user["id"]
    assert doc["status"] == "asignado"


def test_jefe_cannot_assign_outside_dept(jefe_token, admin_token):
    # create doc in administracion
    r = requests.post(f"{API}/documents", headers=_h(admin_token),
                      json={"sender": "x", "subject": "TEST_outside", "medium": "email"}, timeout=10)
    doc_id = r.json()["id"]
    requests.post(f"{API}/documents/{doc_id}/assign-department", headers=_h(admin_token),
                  json={"department": "administracion"}, timeout=10)
    # find a personal user in admin
    users = requests.get(f"{API}/users", headers=_h(admin_token), timeout=10).json()
    target = next(u for u in users if u["email"] == "personal1@gestion.com")
    r = requests.post(f"{API}/documents/{doc_id}/assign-person", headers=_h(jefe_token),
                      json={"user_id": target["id"]}, timeout=10)
    assert r.status_code == 403


def test_personal_status_change(personal_data, created_document):
    token, _ = personal_data
    doc_id = created_document["id"]
    r = requests.post(f"{API}/documents/{doc_id}/status", headers=_h(token),
                      json={"status": "en_proceso", "note": "trabajando"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "en_proceso"

    r = requests.post(f"{API}/documents/{doc_id}/status", headers=_h(token),
                      json={"status": "finalizado"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "finalizado"


def test_personal_inbox_filter(personal_data, created_document):
    token, _ = personal_data
    r = requests.get(f"{API}/documents", headers=_h(token), params={"inbox": "true"}, timeout=10)
    assert r.status_code == 200
    docs = r.json()
    assert any(d["id"] == created_document["id"] for d in docs)


def test_personal_cannot_see_other_docs(personal_data, admin_token):
    token, _ = personal_data
    r = requests.post(f"{API}/documents", headers=_h(admin_token),
                      json={"sender": "x", "subject": "TEST_hidden", "medium": "email"}, timeout=10)
    other_id = r.json()["id"]
    r = requests.get(f"{API}/documents/{other_id}", headers=_h(token), timeout=10)
    assert r.status_code == 403


def test_history_and_comments(created_document, recep_token, personal_data):
    doc_id = created_document["id"]
    # history
    r = requests.get(f"{API}/documents/{doc_id}/history", headers=_h(recep_token), timeout=10)
    assert r.status_code == 200
    actions = [h["action"] for h in r.json()]
    assert "registrado" in actions
    assert "repartido" in actions
    assert "asignado" in actions

    # comment
    token, _ = personal_data
    r = requests.post(f"{API}/documents/{doc_id}/comments", headers=_h(token),
                      json={"text": "TEST comment"}, timeout=10)
    assert r.status_code == 200
    r = requests.get(f"{API}/documents/{doc_id}/comments", headers=_h(recep_token), timeout=10)
    assert r.status_code == 200
    assert any(c["text"] == "TEST comment" for c in r.json())


# ---------- Notifications ----------
def test_personal_notifications(personal_data):
    token, _ = personal_data
    r = requests.get(f"{API}/notifications", headers=_h(token), timeout=10)
    assert r.status_code == 200
    notifs = r.json()
    assert isinstance(notifs, list)
    if notifs:
        nid = notifs[0]["id"]
        r = requests.post(f"{API}/notifications/{nid}/read", headers=_h(token), timeout=10)
        assert r.status_code == 200

    r = requests.post(f"{API}/notifications/read-all", headers=_h(token), timeout=10)
    assert r.status_code == 200


# ---------- Stats ----------
def test_dashboard_stats_admin(admin_token):
    r = requests.get(f"{API}/stats/dashboard", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200
    data = r.json()
    for k in ("total", "by_status", "by_department", "by_priority", "timeline", "recent"):
        assert k in data
    assert len(data["timeline"]) == 7


def test_dashboard_stats_personal_scoped(personal_data):
    token, user = personal_data
    r = requests.get(f"{API}/stats/dashboard", headers=_h(token), timeout=10)
    assert r.status_code == 200


# ---------- File upload/download ----------
def test_upload_and_download(recep_token, created_document):
    doc_id = created_document["id"]
    files = {"file": ("test.txt", io.BytesIO(b"hello world test content"), "text/plain")}
    r = requests.post(f"{API}/documents/{doc_id}/upload", headers=_h(recep_token), files=files, timeout=60)
    if r.status_code == 503:
        pytest.skip("Object storage no disponible")
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["file_name"] == "test.txt"

    r = requests.get(f"{API}/documents/{doc_id}/download", headers=_h(recep_token), timeout=60)
    assert r.status_code == 200
    assert b"hello world" in r.content


# ---------- Brute force protection ----------
def test_brute_force_lockout():
    email = f"TEST_bf_{uuid.uuid4().hex[:6]}@x.com"
    # register so user exists, then attempt wrong passwords
    requests.post(f"{API}/auth/register", json={"email": email, "password": "correctpass", "name": "BF"}, timeout=10)
    last = None
    for _ in range(6):
        last = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"}, timeout=10)
    # After 5 fails the account should be locked (429) or still 401 on the very last (depends on order)
    assert last.status_code in (401, 429)
    # Next attempt should be 429
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"}, timeout=10)
    assert r.status_code == 429


# ---------- Cleanup ----------
def test_zz_cleanup_docs(admin_token):
    r = requests.get(f"{API}/documents", headers=_h(admin_token), params={"q": "TEST_"}, timeout=10)
    if r.status_code == 200:
        for d in r.json():
            requests.delete(f"{API}/documents/{d['id']}", headers=_h(admin_token), timeout=10)
