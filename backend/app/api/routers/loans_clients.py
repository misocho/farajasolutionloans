from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

router = APIRouter()

# Schema structures
class LoanCreateRequest(BaseModel):
    client: str
    sector: str
    amount: float

class LoanResponse(BaseModel):
    id: str
    client: str
    sector: str
    amount: float
    date: str
    status: str

# Detailed Client Schemas
class NextOfKinSchema(BaseModel):
    fullName: str
    idNo: str | None = None
    relationship: str
    phone: str
    address: str | None = None

class PropertyItemSchema(BaseModel):
    description: str
    makeModel: str | None = None
    serialNo: str | None = None
    estValue: str

class ClientCreateRequest(BaseModel):
    name: str
    phone: str
    email: str | None = None
    id_no: str | None = None
    pin: str | None = None
    gender: str | None = "Male"
    marital_status: str | None = "Single"
    occupation: str | None = None
    address: str | None = None
    period_years: str | None = None
    accommodation: str | None = "Family"
    landmark: str | None = None
    
    # Spouse details
    spouse_name: str | None = None
    spouse_id: str | None = None
    spouse_phone: str | None = None
    spouse_occupation: str | None = None
    
    # Dependants
    dependants_count: str | None = None
    dependants_ages: str | None = None
    school_going_count: str | None = None
    school_details: str | None = None
    
    # Next of kin (Multi-entry list)
    next_of_kin_list: list[NextOfKinSchema] = []
    
    # Business
    business_name: str | None = None
    business_type: str = "Retail"
    business_landmark: str | None = None
    business_years: str | None = None
    business_location: str | None = None
    
    # Guarantor
    guarantor_surname: str | None = None
    guarantor_first_name: str | None = None
    guarantor_middle_name: str | None = None
    guarantor_phone: str | None = None
    guarantor_relationship: str | None = None
    guarantor_address: str | None = None
    guarantor_occupation: str | None = None
    guarantor_period_known: str | None = None
    
    # Properties list
    properties_list: list[PropertyItemSchema] = []

class ClientResponse(ClientCreateRequest):
    id: str
    date_registered: str

# In-Memory Database Storage
MOCK_LOANS: list[dict] = [
    {
        "id": "LN-2026-901",
        "client": "Zawadi Enterprises Ltd",
        "sector": "Retail",
        "amount": 450000.0,
        "date": "2026-07-18",
        "status": "Pending",
    },
    {
        "id": "LN-2026-894",
        "client": "Baraka Agro-Supplies",
        "sector": "Agriculture",
        "amount": 1200000.0,
        "date": "2026-07-16",
        "status": "Disbursed",
    },
    {
        "id": "LN-2026-882",
        "client": "Pwani Logistics Co.",
        "sector": "Transport",
        "amount": 800000.0,
        "date": "2026-07-15",
        "status": "Approved",
    },
]

MOCK_CLIENTS: list[dict] = [
    {
        "id": "CL-001",
        "name": "Zawadi Enterprises Ltd",
        "phone": "+254 711 000 111",
        "email": "zawadi@gmail.com",
        "id_no": "29100200",
        "pin": "A001928374Z",
        "gender": "Female",
        "marital_status": "Married",
        "occupation": "Businesswoman",
        "address": "Miritini Estate, Mombasa",
        "period_years": "8",
        "accommodation": "Own",
        "landmark": "Near Miritini Primary School",
        "spouse_name": "Samuel Mwangi",
        "spouse_id": "28192839",
        "spouse_phone": "+254 711 999 888",
        "spouse_occupation": "Transporter",
        "dependants_count": "3",
        "dependants_ages": "12, 10, 6",
        "school_going_count": "2",
        "school_details": "Mombasa Academy",
        "next_of_kin_list": [
            {
                "fullName": "Grace Mwangi",
                "idNo": "34928394",
                "relationship": "Daughter",
                "phone": "+254 712 345 678",
                "address": "Miritini, House 14"
            }
        ],
        "business_name": "Zawadi Groceries & Wholesalers",
        "business_type": "Retail",
        "business_landmark": "Opposite Caltex Petrol Station",
        "business_years": "5",
        "business_location": "Shimanzi Road, Mombasa",
        "guarantor_surname": "Njuguna",
        "guarantor_first_name": "Kamau",
        "guarantor_middle_name": "John",
        "guarantor_phone": "+254 722 555 444",
        "guarantor_relationship": "Trade Partner",
        "guarantor_address": "Majengo, Mombasa",
        "guarantor_occupation": "Hardware Owner",
        "properties_list": [
            {
                "description": "Double Door Refrigerator",
                "makeModel": "LG Linear",
                "serialNo": "LG-99283-F",
                "estValue": "120000"
            },
            {
                "description": "Toyota Probox Courier Car",
                "makeModel": "Toyota Probox 2014",
                "serialNo": "KCD 123X",
                "estValue": "850000"
            }
        ],
        "date_registered": "2026-06-12",
    },
    {
        "id": "CL-002",
        "name": "Baraka Agro-Supplies",
        "phone": "+254 722 000 222",
        "email": "baraka@gmail.com",
        "id_no": "20993849",
        "pin": "A002049384B",
        "gender": "Male",
        "marital_status": "Married",
        "occupation": "Agro-dealer",
        "address": "Mazeras Town",
        "period_years": "12",
        "accommodation": "Own",
        "landmark": "Mazeras Junction",
        "spouse_name": "Lucy Kemunto",
        "spouse_id": "24930293",
        "spouse_phone": "+254 722 888 111",
        "spouse_occupation": "Teacher",
        "dependants_count": "2",
        "dependants_ages": "16, 14",
        "school_going_count": "2",
        "school_details": "Shimo La Tewa High",
        "next_of_kin_list": [
            {
                "fullName": "Peter Njoroge",
                "idNo": "32094859",
                "relationship": "Son",
                "phone": "+254 734 909 090",
                "address": "Mazeras"
            }
        ],
        "business_name": "Baraka Seeds & Fertilizers",
        "business_type": "Agriculture",
        "business_landmark": "Next to KCB Agent",
        "business_years": "7",
        "business_location": "Mazeras Main Road",
        "guarantor_surname": "Kuria",
        "guarantor_first_name": "David",
        "guarantor_middle_name": "Mutua",
        "guarantor_phone": "+254 733 444 555",
        "guarantor_relationship": "Neighbor",
        "guarantor_address": "Mazeras",
        "guarantor_occupation": "Farmer",
        "properties_list": [
            {
                "description": "Store Warehouse Stock",
                "makeModel": "DAP/CAN Seeds",
                "serialNo": "N/A",
                "estValue": "500000"
            }
        ],
        "date_registered": "2026-06-14",
    },
]

@router.get("/loans", response_model=list[LoanResponse])
def get_loans():
    return MOCK_LOANS

@router.post("/loans", response_model=LoanResponse, status_code=status.HTTP_201_CREATED)
def create_loan(request: LoanCreateRequest):
    new_id = f"LN-2026-{len(MOCK_LOANS) + 900}"
    new_loan = {
        "id": new_id,
        "client": request.client,
        "sector": request.sector,
        "amount": request.amount,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "status": "Pending",
    }
    MOCK_LOANS.insert(0, new_loan)
    return new_loan

@router.get("/clients", response_model=list[ClientResponse])
def get_clients():
    return MOCK_CLIENTS

@router.post("/clients", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(request: ClientCreateRequest):
    new_id = f"CL-{len(MOCK_CLIENTS) + 1:03d}"
    new_client = request.model_dump()
    new_client["id"] = new_id
    new_client["date_registered"] = datetime.now().strftime("%Y-%m-%d")
    MOCK_CLIENTS.insert(0, new_client)
    return new_client
