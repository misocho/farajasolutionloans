"""PDF generation for client KYC records (E1) — GET /clients/{id}/pdf."""

from __future__ import annotations

import base64
import binascii
import io
import re
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from reportlab.lib import colors  # type: ignore
from reportlab.lib.enums import TA_CENTER  # type: ignore
from reportlab.lib.pagesizes import A4  # type: ignore
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore
from reportlab.lib.units import inch  # type: ignore
from reportlab.platypus import (  # type: ignore
    Flowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.models.client import Client
from app.models.loan import Loan

BRAND = colors.HexColor("#0D44A2")
MUTED = colors.HexColor("#6B7280")

_MEDIA_RE = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,")


def _kes(value: Decimal | None) -> str:
    if value is None:
        return "-"
    return f"KES {value:,.2f}"


def _date(value: datetime | None) -> str:
    if value is None:
        return "-"
    return value.astimezone(ZoneInfo(settings.DEFAULT_TIMEZONE)).strftime("%d %b %Y")


def _decode_image(value: str | None) -> io.BytesIO | None:
    if not value:
        return None
    raw = _MEDIA_RE.sub("", value)
    try:
        return io.BytesIO(base64.b64decode(raw))
    except (ValueError, binascii.Error):
        return None


def _kv(label: str, value: object) -> list[str]:
    return [label, "-" if value in (None, "", []) else str(value)]


def _section(rows: list[list[str]]) -> Table:
    label = ParagraphStyle(
        "label", parent=getSampleStyleSheet()["Normal"], fontSize=8.5, textColor=MUTED
    )
    value = ParagraphStyle(
        "value", parent=getSampleStyleSheet()["Normal"], fontSize=9.5, leading=13
    )
    data = [[Paragraph(r[0], label), Paragraph(r[1], value)] for r in rows]
    table = Table(data, colWidths=[2.1 * inch, 4.4 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F7F8FA")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _heading(text: str) -> Paragraph:
    style = ParagraphStyle(
        "h2",
        parent=getSampleStyleSheet()["Heading2"],
        fontSize=11,
        textColor=BRAND,
        spaceBefore=12,
        spaceAfter=5,
        fontName="Helvetica-Bold",
    )
    return Paragraph(text, style)


def build_client_pdf(client: Client, loans: list[Loan] | None = None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=0.7 * inch, bottomMargin=0.7 * inch)

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "title",
        parent=styles["Title"],
        fontSize=17,
        textColor=BRAND,
        alignment=TA_CENTER,
        spaceAfter=2,
        fontName="Helvetica-Bold",
    )
    subtitle = ParagraphStyle(
        "subtitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=MUTED,
        alignment=TA_CENTER,
        spaceAfter=2,
    )

    now = datetime.now(ZoneInfo(settings.DEFAULT_TIMEZONE)).strftime("%d %b %Y %H:%M")
    branch = client.branch.name if client.branch else "-"
    story: list[Flowable] = [
        Paragraph("FARAJASOLUTIONLOANS", title),
        Paragraph("Client KYC Record", subtitle),
        Paragraph(
            f"Client: {client.client_number} · Generated: {now} · Branch: {branch}", subtitle
        ),
        Spacer(1, 10),
    ]

    # ── Personal ────────────────────────────────────────────────────────────────
    story.append(_heading("Personal Details"))
    story.append(
        _section(
            [
                _kv("Full Name", client.name),
                _kv("Phone", client.phone),
                _kv("Email", client.email),
                _kv("National ID", client.id_no),
                _kv("KRA PIN", client.pin),
                _kv("Gender", client.gender),
                _kv("Marital Status", client.marital_status),
                _kv("Occupation", client.occupation),
                _kv("Address", client.address),
                _kv("Residence Period", client.period_years),
                _kv("Accommodation", client.accommodation),
                _kv("Landmark", client.landmark),
                _kv("Residential Maps", client.residential_maps_link),
                _kv("Business Maps", client.business_maps_link),
            ]
        )
    )

    # ── Spouse ──────────────────────────────────────────────────────────────────
    if client.spouse_name or client.spouse_id:
        story.append(_heading("Spouse"))
        story.append(
            _section(
                [
                    _kv("Name", client.spouse_name),
                    _kv("National ID", client.spouse_id),
                    _kv("Phone", client.spouse_phone),
                    _kv("Occupation", client.spouse_occupation),
                    _kv("Address", client.spouse_address),
                ]
            )
        )

    # ── Dependants ──────────────────────────────────────────────────────────────
    if client.dependants_count or client.school_details:
        story.append(_heading("Dependants"))
        story.append(
            _section(
                [
                    _kv("Count", client.dependants_count),
                    _kv("Ages", client.dependants_ages),
                    _kv("School-going Count", client.school_going_count),
                    _kv("School Details", client.school_details),
                ]
            )
        )

    # ── Business ────────────────────────────────────────────────────────────────
    if client.business_name:
        story.append(_heading("Business"))
        story.append(
            _section(
                [
                    _kv("Business Name", client.business_name),
                    _kv("Business Type", client.business_type),
                    _kv("Sector", client.business_sector_custom),
                    _kv("Location", client.business_location),
                    _kv("Landmark", client.business_landmark),
                    _kv("Years in Operation", client.business_years),
                    _kv("Estimated Asset Value", _kes(client.estimated_asset_value)),
                ]
            )
        )

    # ── Next of Kin ─────────────────────────────────────────────────────────────
    if client.next_of_kin_list:
        story.append(_heading("Next of Kin"))
        kin_rows: list[list[str]] = []
        for kin in client.next_of_kin_list:
            if isinstance(kin, dict):
                kin_rows.append(_kv("Name", kin.get("fullName") or kin.get("full_name")))
                kin_rows.append(_kv("Relationship", kin.get("relationship")))
                kin_rows.append(_kv("Phone", kin.get("phone")))
                kin_rows.append(_kv("Address", kin.get("address")))
        if kin_rows:
            story.append(_section(kin_rows))

    # ── Guarantor ───────────────────────────────────────────────────────────────
    if client.guarantor_surname or client.guarantor_first_name:
        story.append(_heading("Guarantor"))
        guarantor_name = (
            f"{client.guarantor_first_name or ''} {client.guarantor_middle_name or ''} "
            f"{client.guarantor_surname or ''}".strip()
        )
        story.append(
            _section(
                [
                    _kv("Name", guarantor_name),
                    _kv("National ID", client.guarantor_id_no),
                    _kv("Phone", client.guarantor_phone),
                    _kv("Relationship", client.guarantor_relationship),
                    _kv("Address", client.guarantor_address),
                    _kv("Occupation", client.guarantor_occupation),
                    _kv("Known For", client.guarantor_period_known),
                ]
            )
        )

    # ── Properties ──────────────────────────────────────────────────────────────
    if client.properties_list:
        story.append(_heading("Properties"))
        prop_rows: list[list[str]] = []
        for prop in client.properties_list:
            if isinstance(prop, dict):
                ptype = prop.get("type") or prop.get("property_type") or "-"
                location = prop.get("location") or "-"
                pvalue = prop.get("value")
                value_txt = _kes(Decimal(pvalue)) if pvalue is not None else "-"
                prop_rows.append([ptype, f"{location} — {value_txt}"])
        if prop_rows:
            table = Table(prop_rows, colWidths=[2.1 * inch, 4.4 * inch], hAlign="LEFT")
            table.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                        (
                            "ROWBACKGROUNDS",
                            (0, 0),
                            (-1, -1),
                            [colors.white, colors.HexColor("#F7F8FA")],
                        ),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(table)

    # ── Loans ───────────────────────────────────────────────────────────────────
    active_loans = [
        loan for loan in (loans or []) if loan.status.value in ("Pending", "Approved", "Disbursed")
    ]
    if active_loans:
        story.append(_heading("Loans"))
        head = ParagraphStyle(
            "th",
            parent=styles["Normal"],
            fontSize=8.5,
            textColor=colors.white,
            fontName="Helvetica-Bold",
        )
        cell = ParagraphStyle("td", parent=styles["Normal"], fontSize=8.5, leading=11)
        loan_data = [
            [
                Paragraph(h, head)
                for h in [
                    "Loan #",
                    "Product",
                    "Amount",
                    "Interest",
                    "Disbursed",
                    "Due",
                    "Repayable",
                    "Status",
                ]
            ]
        ]
        for loan in active_loans:
            rate = f"{loan.interest_amount / loan.amount * 100:.0f}%" if loan.amount else "-"
            loan_data.append(
                [
                    Paragraph(str(loan.loan_number), cell),
                    Paragraph(str(loan.loan_product.name if loan.loan_product else "-"), cell),
                    Paragraph(_kes(loan.amount), cell),
                    Paragraph(rate, cell),
                    Paragraph(_date(loan.disbursed_date), cell),
                    Paragraph(_date(loan.due_date), cell),
                    Paragraph(_kes(loan.total_repayable), cell),
                    Paragraph(str(loan.status.value), cell),
                ]
            )
        widths = [
            0.95 * inch,
            1.25 * inch,
            0.95 * inch,
            0.7 * inch,
            0.85 * inch,
            0.85 * inch,
            0.95 * inch,
            0.6 * inch,
        ]
        loan_table = Table(loan_data, colWidths=widths, repeatRows=1)
        loan_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), BRAND),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#F7F8FA")],
                    ),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(loan_table)

    # ── Photos & Signatures ─────────────────────────────────────────────────────
    media = [
        ("Applicant ID Photo", client.applicant_id_photo),
        ("Applicant Passport Photo", client.applicant_passport_photo),
        ("Business Photo", client.business_photo),
        ("Guarantor ID Photo", client.guarantor_id_photo),
        ("Guarantor Passport Photo", client.guarantor_passport_photo),
        ("Applicant Signature", client.applicant_signature),
        ("Guarantor Signature", client.guarantor_signature),
    ]
    images = [
        (label, img)
        for label, img in ((label, _decode_image(raw)) for label, raw in media)
        if img is not None
    ]
    if images:
        story.append(_heading("Photos & Signatures"))
        cap_style = ParagraphStyle(
            "cap", parent=styles["Normal"], fontSize=8, textColor=MUTED, alignment=TA_CENTER
        )
        img_cells: list[list[object]] = []
        for label, img in images:
            try:
                pic: object = Image(img, width=1.55 * inch, height=1.55 * inch)
            except Exception:
                continue
            img_cells.append([pic, Paragraph(label, cap_style)])
        for start in range(0, len(img_cells), 2):
            row = img_cells[start : start + 2]
            while len(row) < 2:
                row.append([Paragraph("", cap_style)])
            media_table = Table(row, colWidths=[2.1 * inch, 2.1 * inch], hAlign="LEFT")
            media_table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.append(media_table)

    doc.build(story)
    return buf.getvalue()
