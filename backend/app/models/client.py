from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Client(BaseModel):
    __tablename__ = "clients"

    # Auto-generated client number e.g. CL-2026-001
    client_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)

    # ── Personal ──────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    id_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    marital_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    period_years: Mapped[str | None] = mapped_column(String(20), nullable=True)
    accommodation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    landmark: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Location (Google Maps links)
    residential_maps_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    business_maps_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Spouse ────────────────────────────────────────────────────────────────
    spouse_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    spouse_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    spouse_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    spouse_occupation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    spouse_address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Dependants (JSON arrays) ───────────────────────────────────────────────
    applicant_dependants: Mapped[list | None] = mapped_column(JSON, nullable=True)
    spouse_dependants: Mapped[list | None] = mapped_column(JSON, nullable=True)
    dependants_count: Mapped[str | None] = mapped_column(String(10), nullable=True)
    dependants_ages: Mapped[str | None] = mapped_column(String(100), nullable=True)
    school_going_count: Mapped[str | None] = mapped_column(String(10), nullable=True)
    school_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Next of Kin (JSON array) ──────────────────────────────────────────────
    next_of_kin_list: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # ── Business ──────────────────────────────────────────────────────────────
    business_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    business_sector_custom: Mapped[str | None] = mapped_column(String(150), nullable=True)
    business_landmark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_years: Mapped[str | None] = mapped_column(String(20), nullable=True)
    business_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    estimated_asset_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    # ── Guarantor ─────────────────────────────────────────────────────────────
    guarantor_surname: Mapped[str | None] = mapped_column(String(100), nullable=True)
    guarantor_first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    guarantor_middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    guarantor_id_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    guarantor_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    guarantor_relationship: Mapped[str | None] = mapped_column(String(100), nullable=True)
    guarantor_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guarantor_occupation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    guarantor_period_known: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Properties ────────────────────────────────────────────────────────────
    properties_list: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # ── Photos & Signatures (S3 URLs) ─────────────────────────────────────────
    applicant_id_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    applicant_passport_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    guarantor_id_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    guarantor_passport_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    applicant_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    guarantor_signature: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Fees ──────────────────────────────────────────────────────────────────
    registration_fee: Mapped[float | None] = mapped_column(nullable=True)
    application_fee: Mapped[float | None] = mapped_column(nullable=True)

    # ── Branch & Officer ──────────────────────────────────────────────────────
    branch_id: Mapped[UUID | None] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    registered_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    branch: Mapped["Branch | None"] = relationship("Branch", foreign_keys=[branch_id], lazy="joined")  # type: ignore
    registered_by: Mapped["User | None"] = relationship("User", foreign_keys=[registered_by_id], lazy="joined")  # type: ignore
    loans: Mapped[list["Loan"]] = relationship("Loan", back_populates="client", lazy="select")

    def __repr__(self) -> str:
        return f"<Client(number='{self.client_number}', name='{self.name}')>"
