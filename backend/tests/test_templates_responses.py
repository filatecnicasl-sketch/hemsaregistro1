"""Tests for templates + responses (digital signature) module."""
import os
import uuid
import hashlib
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-router-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@gestion.com", "password": "admin123"}
RECEP = {"email": "recepcion@gestion.com", "password": "demo123"}
JEFE_TEC = {"email": "jefe.tecnico@gestion.com", "password": "demo123"}
PERSONAL = {"email": "personal2@gestion.com", "password": "demo123"}

# Valid 1x1 transparent PNG data URL
VALID_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
)


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {creds}"
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def recep_token():
    return _login(RECEP)


@pytest.fixture(scope="module")
def jefe_token():
    return _login(JEFE_TEC)


@pytest.fixture(scope="module")
def personal_token():
    return _login(PERSONAL)


# ---------- Templates ----------
def test_seed_templates_present(admin_token):
    r = requests.get(f"{API}/templates", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200
    tpls = r.json()
    cats = {t["category"] for t in tpls}
    # 5 seeded categories must exist
    for c in {"acuse", "requerimiento", "resolucion", "notificacion", "informe"}:
        assert c in cats, f"falta plantilla seed {c}"
    assert len(tpls) >= 5


def test_list_templates_any_role(personal_token):
    r = requests.get(f"{API}/templates", headers=_h(personal_token), timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_personal_cannot_create_template(personal_token):
    r = requests.post(f"{API}/templates", headers=_h(personal_token),
                      json={"name": "x", "category": "otro", "subject": "x", "body": "x"},
                      timeout=10)
    assert r.status_code == 403


def test_recep_can_create_template(recep_token):
    payload = {"name": f"TEST_tpl_{uuid.uuid4().hex[:6]}", "category": "otro", "subject": "S", "body": "B"}
    r = requests.post(f"{API}/templates", headers=_h(recep_token), json=payload, timeout=10)
    assert r.status_code == 200
    t = r.json()
    assert t["name"] == payload["name"]
    assert t["category"] == "otro"
    # cleanup via admin later
    return t


def test_invalid_category_rejected(admin_token):
    r = requests.post(f"{API}/templates", headers=_h(admin_token),
                      json={"name": "TEST_bad", "category": "INVALID", "subject": "x", "body": "x"},
                      timeout=10)
    assert r.status_code == 400


def test_jefe_can_update_template(admin_token, jefe_token):
    # admin creates
    r = requests.post(f"{API}/templates", headers=_h(admin_token),
                      json={"name": "TEST_upd", "category": "otro", "subject": "s", "body": "b"},
                      timeout=10)
    tid = r.json()["id"]
    # jefe updates
    r = requests.patch(f"{API}/templates/{tid}", headers=_h(jefe_token),
                       json={"name": "TEST_upd2", "category": "informe", "subject": "s2", "body": "b2"},
                       timeout=10)
    assert r.status_code == 200
    assert r.json()["category"] == "informe"
    # cleanup
    r = requests.delete(f"{API}/templates/{tid}", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200


def test_only_admin_delete_template(recep_token, admin_token):
    r = requests.post(f"{API}/templates", headers=_h(admin_token),
                      json={"name": "TEST_del", "category": "otro", "subject": "s", "body": "b"}, timeout=10)
    tid = r.json()["id"]
    # recep cannot delete
    r = requests.delete(f"{API}/templates/{tid}", headers=_h(recep_token), timeout=10)
    assert r.status_code == 403
    # admin deletes
    r = requests.delete(f"{API}/templates/{tid}", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200


# ---------- Responses ----------
@pytest.fixture(scope="module")
def doc_for_response(recep_token):
    """Create a document and assign to personal2 (tecnico) for full RBAC tests."""
    r = requests.post(f"{API}/documents", headers=_h(recep_token),
                      json={"sender": "TEST_ResSender", "subject": "TEST_ResDoc",
                            "medium": "email", "priority": "media"}, timeout=10)
    assert r.status_code == 200
    doc = r.json()
    # assign dept tecnico
    requests.post(f"{API}/documents/{doc['id']}/assign-department",
                  headers=_h(recep_token), json={"department": "tecnico"}, timeout=10)
    # find personal2
    users = requests.get(f"{API}/users", headers=_h(recep_token), timeout=10).json()
    p2 = next(u for u in users if u["email"] == "personal2@gestion.com")
    requests.post(f"{API}/documents/{doc['id']}/assign-person",
                  headers=_h(recep_token), json={"user_id": p2["id"]}, timeout=10)
    return doc


def test_create_response_personal(doc_for_response, personal_token):
    r = requests.post(f"{API}/documents/{doc_for_response['id']}/responses",
                      headers=_h(personal_token),
                      json={"subject": "TEST_resp", "body": "Cuerpo de respuesta"}, timeout=10)
    assert r.status_code == 200, r.text
    resp = r.json()
    assert resp["status"] == "borrador"
    assert resp["created_by_name"]
    assert resp["signature_hash"] is None


def test_list_responses_includes_created(doc_for_response, recep_token):
    r = requests.get(f"{API}/documents/{doc_for_response['id']}/responses",
                     headers=_h(recep_token), timeout=10)
    assert r.status_code == 200
    assert any(x["subject"] == "TEST_resp" for x in r.json())


def test_history_logs_response_creation(doc_for_response, recep_token):
    r = requests.get(f"{API}/documents/{doc_for_response['id']}/history",
                     headers=_h(recep_token), timeout=10)
    assert r.status_code == 200
    actions = [h["action"] for h in r.json()]
    assert "respuesta_creada" in actions


def test_update_response_only_creator(doc_for_response, personal_token, jefe_token):
    # personal creates
    r = requests.post(f"{API}/documents/{doc_for_response['id']}/responses",
                      headers=_h(personal_token), json={"subject": "TEST_upd", "body": "B"}, timeout=10)
    rid = r.json()["id"]
    # jefe (not creator, not admin) cannot update
    r = requests.patch(f"{API}/responses/{rid}", headers=_h(jefe_token),
                       json={"subject": "Hacked"}, timeout=10)
    assert r.status_code == 403
    # creator can update
    r = requests.patch(f"{API}/responses/{rid}", headers=_h(personal_token),
                       json={"subject": "TEST_upd2"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["subject"] == "TEST_upd2"


def test_sign_response_flow(doc_for_response, personal_token, recep_token):
    # create draft
    r = requests.post(f"{API}/documents/{doc_for_response['id']}/responses",
                      headers=_h(personal_token), json={"subject": "TEST_sign", "body": "Body"}, timeout=10)
    rid = r.json()["id"]
    # invalid signature image
    r = requests.post(f"{API}/responses/{rid}/sign", headers=_h(personal_token),
                      json={"signature_image": "not-a-data-url"}, timeout=10)
    assert r.status_code == 400
    # valid
    r = requests.post(f"{API}/responses/{rid}/sign", headers=_h(personal_token),
                      json={"signature_image": VALID_PNG}, timeout=10)
    assert r.status_code == 200
    signed = r.json()
    assert signed["status"] == "firmado"
    assert signed["signed_by_name"]
    assert signed["signed_at"]
    assert signed["signature_image"].startswith("data:image")
    # hash is sha256 = 64 hex chars
    assert isinstance(signed["signature_hash"], str)
    assert len(signed["signature_hash"]) == 64
    int(signed["signature_hash"], 16)  # is hex

    # double-sign rejected
    r = requests.post(f"{API}/responses/{rid}/sign", headers=_h(personal_token),
                      json={"signature_image": VALID_PNG}, timeout=10)
    assert r.status_code == 400

    # signed cannot be edited
    r = requests.patch(f"{API}/responses/{rid}", headers=_h(personal_token),
                       json={"subject": "x"}, timeout=10)
    assert r.status_code == 400

    # history has firmada
    r = requests.get(f"{API}/documents/{doc_for_response['id']}/history",
                     headers=_h(recep_token), timeout=10)
    actions = [h["action"] for h in r.json()]
    assert "respuesta_firmada" in actions


def test_personal_cannot_access_unassigned_doc_response(doc_for_response, admin_token):
    # create doc not assigned to personal2
    r = requests.post(f"{API}/documents", headers=_h(admin_token),
                      json={"sender": "TEST", "subject": "TEST_other", "medium": "email"}, timeout=10)
    other_id = r.json()["id"]
    p_token = _login(PERSONAL)
    r = requests.get(f"{API}/documents/{other_id}/responses", headers=_h(p_token), timeout=10)
    assert r.status_code == 403
    r = requests.post(f"{API}/documents/{other_id}/responses", headers=_h(p_token),
                      json={"subject": "x", "body": "x"}, timeout=10)
    assert r.status_code == 403
    # cleanup
    requests.delete(f"{API}/documents/{other_id}", headers=_h(admin_token), timeout=10)


def test_delete_response_rules(doc_for_response, personal_token, admin_token, recep_token):
    # personal creates draft
    r = requests.post(f"{API}/documents/{doc_for_response['id']}/responses",
                      headers=_h(personal_token), json={"subject": "TEST_del1", "body": "b"}, timeout=10)
    rid_draft = r.json()["id"]
    # recep is not creator nor admin and draft is not theirs -> 403
    r = requests.delete(f"{API}/responses/{rid_draft}", headers=_h(recep_token), timeout=10)
    assert r.status_code == 403
    # creator can delete own draft
    r = requests.delete(f"{API}/responses/{rid_draft}", headers=_h(personal_token), timeout=10)
    assert r.status_code == 200

    # creator cannot delete signed (only admin)
    r = requests.post(f"{API}/documents/{doc_for_response['id']}/responses",
                      headers=_h(personal_token), json={"subject": "TEST_del2", "body": "b"}, timeout=10)
    rid_signed = r.json()["id"]
    requests.post(f"{API}/responses/{rid_signed}/sign", headers=_h(personal_token),
                  json={"signature_image": VALID_PNG}, timeout=10)
    r = requests.delete(f"{API}/responses/{rid_signed}", headers=_h(personal_token), timeout=10)
    assert r.status_code == 403
    # admin can delete signed
    r = requests.delete(f"{API}/responses/{rid_signed}", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200


# ---------- Cleanup ----------
def test_zz_cleanup(admin_token):
    # delete TEST_ docs (cascades delete responses indirectly via doc remove? No - but they are gone with doc removal isn't implemented for responses)
    r = requests.get(f"{API}/documents", headers=_h(admin_token), params={"q": "TEST_"}, timeout=10)
    if r.status_code == 200:
        for d in r.json():
            requests.delete(f"{API}/documents/{d['id']}", headers=_h(admin_token), timeout=10)
    # delete TEST_ templates
    r = requests.get(f"{API}/templates", headers=_h(admin_token), timeout=10)
    if r.status_code == 200:
        for t in r.json():
            if t["name"].startswith("TEST_"):
                requests.delete(f"{API}/templates/{t['id']}", headers=_h(admin_token), timeout=10)
