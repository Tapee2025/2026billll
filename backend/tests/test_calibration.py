"""Backend tests for Print Calibration feature (Iteration 3).

Validates:
  * GET /settings exposes calibration block w/ defaults
  * Backfill: legacy docs without calibration get default calibration on GET
  * POST /settings round-trips calibration values
  * /generate-pdf applies vertical scale (set/actual) so a field at top=24.5
    cm with cal 24.5/20.4 lands at ~29.42 cm baseline (=> char y_top ~29.11
    cm in pdfplumber coordinates).
  * Disabled calibration leaves coords untouched
  * Horizontal scale and vertical_offset both work
"""
import io
import os
import pytest
import requests
import pdfplumber

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

A4_HEIGHT_CM = 29.7
CM_PER_PT = 1 / 28.3464567


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(autouse=True)
def _reset_before(client):
    client.post(f"{API}/settings/reset", timeout=15)
    yield


def _extract_first_char(pdf_bytes: bytes):
    """Return (x_left_cm_from_left, y_top_cm_from_top) of the first character.

    pdfplumber char['x0'] = left-x in pt from page left
    pdfplumber char['y0'] = top of char in pt from page top (top-down origin
        when accessed via .chars on rendered page object)
    Note: pdfplumber's `chars` already converts to top-down coords with y0 at
    the top of the glyph and y1 at the bottom (PDF page coordinate system is
    rotated). To be safe, we derive y_from_top = page.height - bbox_bottom_in_pdf.
    """
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        chars = page.chars
        assert chars, "PDF has no characters"
        ch = chars[0]
        # In pdfplumber, page.chars uses top-origin coordinates where
        # 'top' is distance from page top to char top.
        x_left_cm = ch["x0"] / 28.3464567
        y_top_cm = ch["top"] / 28.3464567
        return x_left_cm, y_top_cm, ch.get("text"), page.height


def _post_pdf(client, calibration, single_values, single_field_overrides=None):
    """Build a settings dict that places a single test field at known coords
    and POST /generate-pdf with provided calibration. Use inline settings so
    test is hermetic.
    """
    settings_doc = client.get(f"{API}/defaults", timeout=15).json()
    settings_doc.pop("key", None)
    settings_doc["calibration"] = calibration
    if single_field_overrides:
        for k, v in single_field_overrides.items():
            settings_doc["single_fields"][k] = v
    payload = {
        "data": {
            "single_values": single_values,
            "bill_to": "",
            "ship_to": "",
            "line_items": [],
        },
        "settings": settings_doc,
    }
    r = client.post(f"{API}/generate-pdf", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    assert r.content[:4] == b"%PDF"
    return r.content


# ---------- 1. Defaults & GET ----------
class TestCalibrationDefaults:
    def test_defaults_endpoint_exposes_calibration(self, client):
        r = client.get(f"{API}/defaults", timeout=15)
        assert r.status_code == 200
        cal = r.json()["calibration"]
        assert cal == {
            "vertical_set": 1.0,
            "vertical_actual": 1.0,
            "horizontal_set": 1.0,
            "horizontal_actual": 1.0,
            "vertical_offset": 0.0,
            "horizontal_offset": 0.0,
        }

    def test_get_settings_returns_default_calibration_when_empty(self, client):
        r = client.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        cal = r.json()["calibration"]
        assert cal["vertical_set"] == 1.0
        assert cal["horizontal_actual"] == 1.0
        assert cal["vertical_offset"] == 0.0


# ---------- 2. Backfill ----------
class TestCalibrationBackfill:
    def test_backfill_calibration_for_legacy_doc(self, client):
        client.post(f"{API}/settings/reset", timeout=15)
        legacy = client.get(f"{API}/defaults", timeout=15).json()
        legacy.pop("key", None)
        legacy.pop("calibration", None)  # simulate older saved doc
        save = client.post(f"{API}/settings", json=legacy, timeout=15)
        assert save.status_code == 200, save.text

        fetched = client.get(f"{API}/settings", timeout=15).json()
        assert "calibration" in fetched
        cal = fetched["calibration"]
        assert cal["vertical_set"] == 1.0
        assert cal["vertical_actual"] == 1.0
        assert cal["horizontal_set"] == 1.0
        assert cal["horizontal_actual"] == 1.0
        assert cal["vertical_offset"] == 0.0
        assert cal["horizontal_offset"] == 0.0


# ---------- 3. Round-trip persistence ----------
class TestCalibrationPersistence:
    def test_save_and_get_calibration(self, client):
        defaults = client.get(f"{API}/settings", timeout=15).json()
        defaults.pop("key", None)
        defaults["calibration"] = {
            "vertical_set": 24.5,
            "vertical_actual": 20.4,
            "horizontal_set": 21.0,
            "horizontal_actual": 17.5,
            "vertical_offset": 0.3,
            "horizontal_offset": -0.1,
        }
        r = client.post(f"{API}/settings", json=defaults, timeout=15)
        assert r.status_code == 200, r.text

        fetched = client.get(f"{API}/settings", timeout=15).json()["calibration"]
        assert fetched["vertical_set"] == 24.5
        assert fetched["vertical_actual"] == 20.4
        assert fetched["horizontal_set"] == 21.0
        assert fetched["horizontal_actual"] == 17.5
        assert fetched["vertical_offset"] == 0.3
        assert fetched["horizontal_offset"] == -0.1


# ---------- 4. PDF coordinate verification ----------
class TestCalibrationApplied:
    """Place a test field 'po_no' at top=24.5cm, left=5cm, then verify PDF."""

    BASE_TOP = 24.5
    BASE_LEFT = 5.0
    FIELD_OVERRIDE = {
        "po_no": {
            "label": "PO", "top": BASE_TOP, "left": BASE_LEFT,
            "font_size": 11, "bold": True,
        }
    }

    def test_no_calibration_draws_at_set_coords(self, client):
        cal = {
            "vertical_set": 1.0, "vertical_actual": 1.0,
            "horizontal_set": 1.0, "horizontal_actual": 1.0,
            "vertical_offset": 0.0, "horizontal_offset": 0.0,
        }
        pdf = _post_pdf(client, cal, {"po_no": "X"}, self.FIELD_OVERRIDE)
        x_cm, y_top_cm, text, page_h_pt = _extract_first_char(pdf)
        page_h_cm = page_h_pt * CM_PER_PT
        assert text == "X"
        # baseline drawn at top=24.5cm => glyph top is ~24.5 - ascent(0.3cm) ≈ 24.20cm
        assert abs(x_cm - self.BASE_LEFT) < 0.1
        assert abs(y_top_cm - (self.BASE_TOP - 0.3)) < 0.15, (
            f"y_top_cm={y_top_cm:.3f} expected ≈ {self.BASE_TOP - 0.3:.3f}"
        )
        assert abs(page_h_cm - A4_HEIGHT_CM) < 0.05

    def test_vertical_calibration_24_5_over_20_4(self, client):
        cal = {
            "vertical_set": 24.5, "vertical_actual": 20.4,
            "horizontal_set": 1.0, "horizontal_actual": 1.0,
            "vertical_offset": 0.0, "horizontal_offset": 0.0,
        }
        pdf = _post_pdf(client, cal, {"po_no": "X"}, self.FIELD_OVERRIDE)
        x_cm, y_top_cm, text, _ = _extract_first_char(pdf)
        # baseline = 24.5 * 24.5/20.4 = 29.4240 cm
        # glyph top ≈ baseline - 0.3 = 29.124 cm
        expected_baseline = self.BASE_TOP * (24.5 / 20.4)
        expected_y_top = expected_baseline - 0.3
        assert text == "X"
        assert abs(y_top_cm - expected_y_top) < 0.15, (
            f"y_top_cm={y_top_cm:.3f} expected ≈ {expected_y_top:.3f}"
        )
        # x should be unaffected
        assert abs(x_cm - self.BASE_LEFT) < 0.1

    def test_horizontal_calibration(self, client):
        # field at left=5, h_set=10, h_actual=8 => x=5*10/8=6.25cm
        cal = {
            "vertical_set": 1.0, "vertical_actual": 1.0,
            "horizontal_set": 10.0, "horizontal_actual": 8.0,
            "vertical_offset": 0.0, "horizontal_offset": 0.0,
        }
        pdf = _post_pdf(client, cal, {"po_no": "X"}, self.FIELD_OVERRIDE)
        x_cm, y_top_cm, text, _ = _extract_first_char(pdf)
        expected_x = self.BASE_LEFT * (10.0 / 8.0)
        assert text == "X"
        assert abs(x_cm - expected_x) < 0.05, (
            f"x_cm={x_cm:.3f} expected ≈ {expected_x:.3f}"
        )

    def test_vertical_offset_applied(self, client):
        # use dedicated field at top=10, scale=1, offset=0.5 -> draw at 10.5
        override = {
            "po_no": {
                "label": "PO", "top": 10.0, "left": 5.0,
                "font_size": 11, "bold": True,
            }
        }
        cal = {
            "vertical_set": 1.0, "vertical_actual": 1.0,
            "horizontal_set": 1.0, "horizontal_actual": 1.0,
            "vertical_offset": 0.5, "horizontal_offset": 0.0,
        }
        pdf = _post_pdf(client, cal, {"po_no": "X"}, override)
        _, y_top_cm, text, _ = _extract_first_char(pdf)
        expected_y_top = 10.5 - 0.3
        assert text == "X"
        assert abs(y_top_cm - expected_y_top) < 0.15, (
            f"y_top_cm={y_top_cm:.3f} expected ≈ {expected_y_top:.3f}"
        )

    def test_horizontal_offset_applied(self, client):
        cal = {
            "vertical_set": 1.0, "vertical_actual": 1.0,
            "horizontal_set": 1.0, "horizontal_actual": 1.0,
            "vertical_offset": 0.0, "horizontal_offset": 0.4,
        }
        pdf = _post_pdf(client, cal, {"po_no": "X"}, self.FIELD_OVERRIDE)
        x_cm, _, text, _ = _extract_first_char(pdf)
        expected_x = self.BASE_LEFT + 0.4
        assert text == "X"
        assert abs(x_cm - expected_x) < 0.05
