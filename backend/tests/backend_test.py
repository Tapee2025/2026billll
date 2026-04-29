"""Backend API tests for Invoice Overlay Printer (Iteration 2 — adds calculation, product column, top_offset coverage)."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(autouse=True)
def _reset_before(client):
    client.post(f"{API}/settings/reset", timeout=15)
    yield


# ---------- Settings (existing + new fields) ----------
class TestSettings:
    def test_defaults_endpoint(self, client):
        r = client.get(f"{API}/defaults", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "single_fields" in data and "box_fields" in data and "line_items" in data
        assert data["single_fields"]["po_no"]["top"] == 7.5
        assert data["box_fields"]["bill_to"]["top"] == 9.4
        # NEW: calculation defaults exposed
        assert data["calculation"]["bags_per_mt"] == 20
        assert data["calculation"]["gst_percent"] == 18.0
        # NEW: product column with negative top_offset
        assert "product" in data["line_items"]["columns"]
        assert data["line_items"]["columns"]["product"]["left"] == 2.5
        assert data["line_items"]["columns"]["product"]["top_offset"] == -0.7

    def test_get_settings_returns_defaults_when_empty(self, client):
        r = client.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["calculation"]["bags_per_mt"] == 20
        assert data["calculation"]["gst_percent"] == 18.0
        assert data["line_items"]["columns"]["product"]["top_offset"] == -0.7

    def test_save_and_persist_calculation(self, client):
        defaults = client.get(f"{API}/settings", timeout=15).json()
        defaults.pop("key", None)
        defaults.pop("_id", None)
        # Modify calculation values
        defaults["calculation"]["gst_percent"] = 28.0
        defaults["calculation"]["bags_per_mt"] = 25

        save = client.post(f"{API}/settings", json=defaults, timeout=15)
        assert save.status_code == 200, save.text

        fetched = client.get(f"{API}/settings", timeout=15).json()
        assert fetched["calculation"]["gst_percent"] == 28.0
        assert fetched["calculation"]["bags_per_mt"] == 25
        # Other fields preserved
        assert fetched["single_fields"]["po_no"]["top"] == 7.5

    def test_save_and_persist_product_column(self, client):
        defaults = client.get(f"{API}/settings", timeout=15).json()
        defaults.pop("key", None)
        defaults.pop("_id", None)
        defaults["line_items"]["columns"]["product"]["left"] = 3.1
        defaults["line_items"]["columns"]["product"]["top_offset"] = -0.9

        save = client.post(f"{API}/settings", json=defaults, timeout=15)
        assert save.status_code == 200, save.text

        fetched = client.get(f"{API}/settings", timeout=15).json()
        assert fetched["line_items"]["columns"]["product"]["left"] == 3.1
        assert fetched["line_items"]["columns"]["product"]["top_offset"] == -0.9

    def test_reset_settings(self, client):
        defaults = client.get(f"{API}/settings", timeout=15).json()
        defaults.pop("key", None); defaults.pop("_id", None)
        defaults["calculation"]["gst_percent"] = 9.9
        client.post(f"{API}/settings", json=defaults, timeout=15)

        r = client.post(f"{API}/settings/reset", timeout=15)
        assert r.status_code == 200
        assert r.json()["calculation"]["gst_percent"] == 18.0
        again = client.get(f"{API}/settings", timeout=15).json()
        assert again["calculation"]["gst_percent"] == 18.0


# ---------- Backfill: insert legacy doc, GET should backfill ----------
class TestBackfill:
    def test_backfill_legacy_doc(self, client):
        # First reset to clean state
        client.post(f"{API}/settings/reset", timeout=15)

        # Save a legacy-shaped doc (no calculation, no product column, no top_offset)
        legacy = client.get(f"{API}/defaults", timeout=15).json()
        legacy.pop("key", None)
        # Strip newer fields to simulate old saved doc
        legacy.pop("calculation", None)
        legacy["line_items"]["columns"].pop("product", None)
        for k, v in legacy["line_items"]["columns"].items():
            v.pop("top_offset", None)

        r = client.post(f"{API}/settings", json=legacy, timeout=15)
        assert r.status_code == 200, r.text

        # Now GET /api/settings — backfill must add missing fields
        fetched = client.get(f"{API}/settings", timeout=15).json()
        assert "calculation" in fetched, "calculation field not backfilled"
        assert fetched["calculation"]["bags_per_mt"] == 20
        assert fetched["calculation"]["gst_percent"] == 18.0
        assert "product" in fetched["line_items"]["columns"], "product column not backfilled"
        assert fetched["line_items"]["columns"]["product"]["top_offset"] == -0.7
        # Existing columns now have top_offset=0.0
        for k, v in fetched["line_items"]["columns"].items():
            assert "top_offset" in v


# ---------- PDF generation ----------
class TestGeneratePdf:
    def test_generate_pdf_returns_real_pdf(self, client):
        payload = {
            "data": {
                "single_values": {"po_no": "PO-123", "invoice_no": "INV-001"},
                "bill_to": "M/s ABC", "ship_to": "M/s XYZ",
                "line_items": [
                    {"product": "OPC CEMENT", "mt": "4.00", "no_of_bags": "80",
                     "rate_per_mt": "4237.29", "amount": "16949.15"}
                ],
            }
        }
        r = client.post(f"{API}/generate-pdf", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert "application/pdf" in r.headers.get("Content-Type", "")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_generate_pdf_accepts_product_field(self, client):
        # Specifically validate that product field is accepted (no 422)
        payload = {
            "data": {
                "single_values": {},
                "bill_to": "", "ship_to": "",
                "line_items": [
                    {"product": "PPC CEMENT", "no_of_bags": "40",
                     "rate_per_mt": "5000", "amount": "10000"}
                ],
            }
        }
        r = client.post(f"{API}/generate-pdf", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"%PDF"

    def test_generate_pdf_with_empty_data(self, client):
        payload = {"data": {"single_values": {}, "bill_to": "", "ship_to": "", "line_items": []}}
        r = client.post(f"{API}/generate-pdf", json=payload, timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
