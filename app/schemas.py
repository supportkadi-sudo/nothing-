from datetime import datetime

from pydantic import BaseModel


class ProductOut(BaseModel):
    code: str
    name: str
    price: int
    description: str
    model_config = {'from_attributes': True}


class OrderCreate(BaseModel):
    product_code: str


class OrderOut(BaseModel):
    public_id: str
    receipt_number: str
    product_code: str
    product_name: str
    price: int
    exact_amount: int
    status: str
    created_at: datetime
    expires_at: datetime
    paid_at: datetime | None = None
    model_config = {'from_attributes': True}


class RecentOrderOut(BaseModel):
    receipt_number: str
    product_name: str
    amount: int
    paid_at: datetime


class StatsOut(BaseModel):
    count: int
    total: int
    max: int
    recent: list[RecentOrderOut]


class PublicConfigOut(BaseModel):
    payment_card_number: str
    payment_card_label: str
    order_ttl_minutes: int
