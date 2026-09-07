from pathlib import Path
from secrets import compare_digest

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine, get_db
from .models import Order, PaymentMessage, Product
from .notifications import notify_paid_order
from .payments import create_order as create_order_record
from .payments import expire_stale_orders, match_payment, parse_payment_message
from .schemas import (
    InternalPaymentMessageIn,
    InternalPaymentMessageOut,
    OrderCreate,
    OrderOut,
    ProductOut,
    PublicConfigOut,
    RecentOrderOut,
    StatsOut,
)
from .settings import (
    INTERNAL_PAYMENT_SECRET,
    ORDER_TTL_MINUTES,
    PAYMENT_CARD_LABEL,
    PAYMENT_CARD_NUMBER,
)

app = FastAPI(title='NOTHING by KADI', version='1.0.0')
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / 'static'

PRODUCTS = [
    ('basic', 'NOTHING BASIC', 1000, 'Немного ничего'),
    ('plus', 'NOTHING+', 4900, 'Почти столько же ничего'),
    ('pro', 'NOTHING PRO', 9900, 'Премиальное ничего'),
    ('absolute', 'ABSOLUTELY NOTHING', 49900, 'Совершенно неоправданное ничего'),
]


@app.on_event('startup')
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        existing = {p.code: p for p in db.scalars(select(Product))}
        for code, name, price, description in PRODUCTS:
            product = existing.get(code)
            if product:
                product.name = name
                product.price = price
                product.description = description
            else:
                db.add(Product(code=code, name=name, price=price, description=description))
        db.commit()


@app.get('/api/health')
def health():
    return {'ok': True}


@app.get('/api/config', response_model=PublicConfigOut)
def public_config():
    return PublicConfigOut(
        payment_card_number=PAYMENT_CARD_NUMBER,
        payment_card_label=PAYMENT_CARD_LABEL,
        order_ttl_minutes=ORDER_TTL_MINUTES,
    )


@app.get('/api/products', response_model=list[ProductOut])
def products(db: Session = Depends(get_db)):
    return list(db.scalars(select(Product).order_by(Product.price)))


@app.post('/api/orders', response_model=OrderOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.code == payload.product_code))
    if not product:
        raise HTTPException(404, 'Product not found')
    try:
        return create_order_record(db, product)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get('/api/orders/{public_id}', response_model=OrderOut)
def get_order(public_id: str, db: Session = Depends(get_db)):
    expire_stale_orders(db)
    order = db.scalar(select(Order).where(Order.public_id == public_id))
    if not order:
        raise HTTPException(404, 'Order not found')
    return order


@app.post('/api/internal/payment-message', response_model=InternalPaymentMessageOut)
async def receive_internal_payment_message(
    payload: InternalPaymentMessageIn,
    x_internal_payment_secret: str = Header('', alias='X-Internal-Payment-Secret'),
    db: Session = Depends(get_db),
):
    if not INTERNAL_PAYMENT_SECRET:
        raise HTTPException(503, 'Internal payment relay is not configured')
    if not compare_digest(x_internal_payment_secret, INTERNAL_PAYMENT_SECRET):
        raise HTTPException(401, 'Invalid internal payment secret')

    existing = db.scalar(
        select(PaymentMessage).where(PaymentMessage.event_key == payload.event_id)
    )
    if existing:
        order = db.get(Order, existing.order_id) if existing.order_id else None
        return InternalPaymentMessageOut(
            status='duplicate',
            order_public_id=order.public_id if order else None,
        )

    parsed = parse_payment_message(payload.text)
    if not parsed:
        raise HTTPException(422, 'Unsupported payment message')

    order = match_payment(
        db,
        event_key=payload.event_id,
        raw_text=payload.text,
        parsed=parsed,
    )
    payment = db.scalar(
        select(PaymentMessage).where(PaymentMessage.event_key == payload.event_id)
    )
    status = payment.status if payment else 'unmatched'

    if order:
        await notify_paid_order(order)

    return InternalPaymentMessageOut(
        status=status,
        order_public_id=order.public_id if order else None,
    )


@app.get('/api/stats', response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    paid_filter = Order.status == 'paid'
    count, total, maximum = db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.exact_amount), 0),
            func.coalesce(func.max(Order.exact_amount), 0),
        ).where(paid_filter)
    ).one()
    recent_orders = list(db.scalars(
        select(Order).where(paid_filter).order_by(Order.paid_at.desc()).limit(4)
    ))
    return StatsOut(
        count=int(count or 0),
        total=int(total or 0),
        max=int(maximum or 0),
        recent=[
            RecentOrderOut(
                receipt_number=o.receipt_number,
                product_name=o.product_name,
                amount=o.exact_amount,
                paid_at=o.paid_at,
            )
            for o in recent_orders
            if o.paid_at is not None
        ],
    )


app.mount('/static', StaticFiles(directory=STATIC_DIR), name='static')


@app.get('/')
def index():
    return FileResponse(STATIC_DIR / 'index.html')
