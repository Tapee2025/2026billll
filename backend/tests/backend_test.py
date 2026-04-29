"""Backend API tests for Invoice Overlay Printer."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gst-invoice-print.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(autouse=True)
def _reset_before(client):
    # Ensure a clean state before each test
    client.post(f"{API}/settings/reset", timeout=15)
    yield


# ---------- Settings ----------
class TestSettings:
    def test_defaults_endpoint(self, client):
        r = client.get(f"{API}/defaults", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "single_fields" in data and "box_fields" in data and "line_items" in data
        assert data["single_fields"]["po_no"]["top"] == 7.5
        assert data["single_fields"]["po_no"]["left"] == 5.0
        assert data["single_fields"]["invoice_no"]["left"] == 14.2
        assert data["box_fields"]["bill_to"]["top"] == 9.4
        assert data["box_fields"]["ship_to"]["left"] == 11.1
        assert data["single_fields"]["pan_no_left"]["top"] == 13.0

    def test_get_settings_returns_defaults_when_empty(self, client):
        r = client.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "single_fields" in data
        assert "box_fields" in data
        assert "line_items" in data
        assert data["single_fields"]["po_no"]["top"] == 7.5

    def test_save_and_persist_settings(self, client):
        # GET defaults, modify po_no.top, POST and re-fetch
        defaults = client.get(f"{API}/settings", timeout=15).json()
        # remove the 'key' field if present (not part of Settings model)
        defaults.pop("key", None)
        defaults.pop("_id", None)
        defaults["single_fields"]["po_no"]["top"] = 8.5

        save = client.post(f"{API}/settings", json=defaults, timeout=15)
        assert save.status_code == 200, save.text
        assert save.json().get("status") == "ok"

        fetched = client.get(f"{API}/settings", timeout=15).json()
        assert fetched["single_fields"]["po_no"]["top"] == 8.5
        # other defaults intact
        assert fetched["single_fields"]["invoice_no"]["left"] == 14.2

    def test_reset_settings(self, client):
        defaults = client.get(f"{API}/settings", timeout=15).json()
        defaults.pop("key", None)
        defaults.pop("_id", None)
        defaults["single_fields"]["po_no"]["top"] = 9.9
        client.post(f"{API}/settings", json=defaults, timeout=15)

        r = client.post(f"{API}/settings/reset", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["single_fields"]["po_no"]["top"] == 7.5

        again = client.get(f"{API}/settings", timeout=15).json()
        assert again["single_fields"]["po_no"]["top"] == 7.5


# ---------- PDF generation ----------
class TestGeneratePdf:
    def test_generate_pdf_returns_real_pdf(self, client):
        payload = {
            "data": {
                "single_values": {
                    "po_no": "PO-123",
                    "invoice_no": "INV-001",
                    "invoice_date": "10/01/2026",
                },
                "bill_to": "M/s ABC Traders\nMain Road, Rajkot\nGSTIN: 24ABCDE1234F1Z5",
                "ship_to": "M/s XYZ Stores\nSurat",
                "line_items": [
                    {"mt": "1.5", "no_of_bags": "30", "rate_per_mt": "5000", "amount": "7500"}
                ],
            }
        }
        r = client.post(f"{API}/generate-pdf", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert "application/pdf" in r.headers.get("Content-Type", "")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_generate_pdf_with_empty_data(self, client):
        # Should still produce a valid (mostly blank) PDF
        payload = {"data": {"single_values": {}, "bill_to": "", "ship_to": "", "line_items": []}}
        r = client.post(f"{API}/generate-pdf", json=payload, timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_generate_pdf_with_settings_override(self, client):
        # pass an inline settings override
        defaults = client.get(f"{API}/defaults", timeout=15).json()
        defaults.pop("key", None)
        payload = {
            "data": {
                "single_values": {"po_no": "OVERRIDE"},
                "bill_to": "Test", "ship_to": "", "line_items": [],
            },
            "settings": {
                "single_fields": defaults["single_fields"],
                "box_fields": defaults["box_fields"],
                "line_items": defaults["line_items"],
            },
        }
        r = client.post(f"{API}/generate-pdf", json=payload, timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
