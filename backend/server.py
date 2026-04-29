from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ----------------- Defaults -----------------
# All measurements in cm. top = distance from top of page, left = distance from left.
# A4 = 21.0cm x 29.7cm

DEFAULT_SINGLE_FIELDS: Dict[str, Dict[str, Any]] = {
    # Header (left column)
    "po_no":          {"label": "P.O. No",          "top": 7.5,  "left": 5.0,  "font_size": 11, "bold": True},
    "po_date":        {"label": "P.O. Date",        "top": 7.9,  "left": 5.0,  "font_size": 11, "bold": True},
    # Header (right column)
    "invoice_no":     {"label": "Invoice No",       "top": 7.0,  "left": 14.2, "font_size": 11, "bold": True},
    "invoice_date":   {"label": "Invoice Date",     "top": 7.6,  "left": 14.2, "font_size": 11, "bold": True},
    # PAN
    "pan_no_left":    {"label": "PAN No (Bill To)", "top": 13.0, "left": 3.7,  "font_size": 11, "bold": True},
    "pan_no_right":   {"label": "PAN No (Ship To)", "top": 13.0, "left": 13.2, "font_size": 11, "bold": True},
    # Transport - left column
    "week_no":            {"label": "Week No",            "top": 14.0, "left": 4.5,  "font_size": 11, "bold": True},
    "mode_of_transport":  {"label": "Mode of Transport",  "top": 14.5, "left": 4.5,  "font_size": 11, "bold": True},
    "freight":            {"label": "Freight",            "top": 15.0, "left": 4.5,  "font_size": 11, "bold": True},
    # Transport - right column
    "transporter_name":   {"label": "Transporter Name",   "top": 14.0, "left": 14.5, "font_size": 11, "bold": True},
    "lr_no":              {"label": "L.R. No",            "top": 14.5, "left": 14.5, "font_size": 11, "bold": True},
    "vehicle_no":         {"label": "Vehicle No",         "top": 15.0, "left": 14.5, "font_size": 11, "bold": True},
    # Bottom block
    "driver_mobile":  {"label": "Driver Mobile",   "top": 21.5, "left": 4.0,  "font_size": 11, "bold": True},
    "eway_bill_no":   {"label": "EWAY Bill No",    "top": 22.0, "left": 4.0,  "font_size": 11, "bold": True},
    "tpca_code":      {"label": "TPCA Code",       "top": 21.5, "left": 9.5,  "font_size": 11, "bold": True},
    "region":         {"label": "Region",          "top": 22.0, "left": 9.5,  "font_size": 11, "bold": True},
    "destination":    {"label": "Destination",     "top": 22.5, "left": 9.5,  "font_size": 11, "bold": True},
    # Totals (right side)
    "taxable_amount": {"label": "Taxable Amount",  "top": 21.5, "left": 17.5, "font_size": 11, "bold": True},
    "central_tax":    {"label": "Central Tax Amt", "top": 22.0, "left": 17.5, "font_size": 11, "bold": True},
    "state_tax":      {"label": "State/UT Tax Amt","top": 22.5, "left": 17.5, "font_size": 11, "bold": True},
    "sub_total":      {"label": "Sub Total",       "top": 21.0, "left": 17.5, "font_size": 11, "bold": True},
    "grand_total":    {"label": "Grand Total",     "top": 23.0, "left": 17.5, "font_size": 11, "bold": True},
    "total_gst":      {"label": "Total GST",       "top": 24.0, "left": 4.0,  "font_size": 11, "bold": True},
    "bill_amount":    {"label": "Bill Amount",     "top": 24.5, "left": 4.0,  "font_size": 11, "bold": True},
}

DEFAULT_BOX_FIELDS: Dict[str, Dict[str, Any]] = {
    "bill_to": {"label": "Details of Bill To", "top": 9.4, "left": 1.5,  "width": 8.0, "height": 2.6, "font_size": 11, "bold": True, "line_height": 0.5},
    "ship_to": {"label": "Details of Ship To", "top": 9.4, "left": 11.1, "width": 8.0, "height": 2.6, "font_size": 11, "bold": True, "line_height": 0.5},
}

DEFAULT_LINE_ITEMS: Dict[str, Any] = {
    "label": "Line Items (per row)",
    "first_row_top": 17.5,    # top y of row 1 baseline area
    "row_height": 0.6,        # cm between rows
    "max_rows": 8,
    "font_size": 11,
    "bold": True,
    "columns": {
        "mt":         {"label": "MT",         "left": 8.7},
        "no_of_bags": {"label": "No. of Bags","left": 10.5},
        "rate_per_mt":{"label": "Rate Per MT","left": 12.7},
        "amount":     {"label": "Amount",     "left": 16.7},
    },
}

DEFAULT_SETTINGS = {
    "key": "default",
    "single_fields": DEFAULT_SINGLE_FIELDS,
    "box_fields": DEFAULT_BOX_FIELDS,
    "line_items": DEFAULT_LINE_ITEMS,
}


# ----------------- Models -----------------
class SingleFieldCfg(BaseModel):
    model_config = ConfigDict(extra="ignore")
    label: str
    top: float
    left: float
    font_size: float = 11
    bold: bool = True


class BoxFieldCfg(BaseModel):
    model_config = ConfigDict(extra="ignore")
    label: str
    top: float
    left: float
    width: float
    height: float
    font_size: float = 11
    bold: bool = True
    line_height: float = 0.5


class LineColumnCfg(BaseModel):
    model_config = ConfigDict(extra="ignore")
    label: str
    left: float


class LineItemsCfg(BaseModel):
    model_config = ConfigDict(extra="ignore")
    label: str = "Line Items (per row)"
    first_row_top: float
    row_height: float
    max_rows: int = 8
    font_size: float = 11
    bold: bool = True
    columns: Dict[str, LineColumnCfg]


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    single_fields: Dict[str, SingleFieldCfg]
    box_fields: Dict[str, BoxFieldCfg]
    line_items: LineItemsCfg


class LineItemRow(BaseModel):
    model_config = ConfigDict(extra="ignore")
    mt: Optional[str] = ""
    no_of_bags: Optional[str] = ""
    rate_per_mt: Optional[str] = ""
    amount: Optional[str] = ""


class InvoiceData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    single_values: Dict[str, str] = {}
    bill_to: str = ""
    ship_to: str = ""
    line_items: List[LineItemRow] = []


class GeneratePdfRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data: InvoiceData
    settings: Optional[Settings] = None


# ----------------- Routes -----------------
@api_router.get("/")
async def root():
    return {"message": "Invoice Overlay Printer API"}


@api_router.get("/settings")
async def get_settings():
    doc = await db.invoice_settings.find_one({"key": "default"}, {"_id": 0})
    if not doc:
        return DEFAULT_SETTINGS
    return doc


@api_router.post("/settings")
async def save_settings(settings: Settings):
    payload = settings.model_dump()
    payload["key"] = "default"
    await db.invoice_settings.update_one(
        {"key": "default"},
        {"$set": payload},
        upsert=True,
    )
    return {"status": "ok"}


@api_router.post("/settings/reset")
async def reset_settings():
    await db.invoice_settings.delete_one({"key": "default"})
    return DEFAULT_SETTINGS


def _font_name(bold: bool) -> str:
    return "Courier-Bold" if bold else "Courier"


def _draw_text(c: canvas.Canvas, text: str, top_cm: float, left_cm: float, font_size: float, bold: bool):
    if text is None:
        return
    text = str(text)
    if text == "":
        return
    page_h = A4[1]
    c.setFont(_font_name(bold), font_size)
    x = left_cm * cm
    y = page_h - (top_cm * cm)
    c.drawString(x, y, text)


def _draw_box_text(c: canvas.Canvas, text: str, cfg: Dict[str, Any]):
    if not text:
        return
    page_h = A4[1]
    font_size = cfg.get("font_size", 11)
    bold = cfg.get("bold", True)
    line_height_cm = cfg.get("line_height", 0.5)
    c.setFont(_font_name(bold), font_size)
    x = cfg["left"] * cm
    top_cm_val = cfg["top"]
    max_h_cm = cfg["height"]
    lines = str(text).split("\n")
    for i, line in enumerate(lines):
        line_top = top_cm_val + (i * line_height_cm)
        if (line_top - top_cm_val) > max_h_cm:
            break
        y = page_h - (line_top * cm)
        c.drawString(x, y, line)


@api_router.post("/generate-pdf")
async def generate_pdf(req: GeneratePdfRequest):
    # use settings from DB unless override is passed
    if req.settings is not None:
        settings_dict = req.settings.model_dump()
    else:
        doc = await db.invoice_settings.find_one({"key": "default"}, {"_id": 0})
        settings_dict = doc if doc else DEFAULT_SETTINGS

    single_fields = settings_dict.get("single_fields", {})
    box_fields = settings_dict.get("box_fields", {})
    line_items_cfg = settings_dict.get("line_items", {})

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    # Single-line fields
    for key, value in (req.data.single_values or {}).items():
        cfg = single_fields.get(key)
        if not cfg:
            continue
        _draw_text(
            c,
            value,
            top_cm=cfg["top"],
            left_cm=cfg["left"],
            font_size=cfg.get("font_size", 11),
            bold=cfg.get("bold", True),
        )

    # Box fields (Bill To / Ship To)
    if "bill_to" in box_fields and req.data.bill_to:
        _draw_box_text(c, req.data.bill_to, box_fields["bill_to"])
    if "ship_to" in box_fields and req.data.ship_to:
        _draw_box_text(c, req.data.ship_to, box_fields["ship_to"])

    # Line items
    if line_items_cfg and req.data.line_items:
        first_row_top = line_items_cfg.get("first_row_top", 17.5)
        row_height = line_items_cfg.get("row_height", 0.6)
        font_size = line_items_cfg.get("font_size", 11)
        bold = line_items_cfg.get("bold", True)
        columns = line_items_cfg.get("columns", {})
        for idx, row in enumerate(req.data.line_items):
            row_top = first_row_top + idx * row_height
            row_dict = row.model_dump() if hasattr(row, "model_dump") else dict(row)
            for col_key, col_cfg in columns.items():
                value = row_dict.get(col_key, "") or ""
                if value == "":
                    continue
                _draw_text(c, value, top_cm=row_top, left_cm=col_cfg["left"],
                           font_size=font_size, bold=bold)

    c.showPage()
    c.save()
    pdf_bytes = buf.getvalue()
    buf.close()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="invoice_overlay.pdf"'},
    )


@api_router.get("/defaults")
async def get_defaults():
    """Returns hard-coded default settings (for Reset preview on frontend)."""
    return DEFAULT_SETTINGS


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
