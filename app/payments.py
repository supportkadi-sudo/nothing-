import random
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Order, PaymentMessage, Product
from .settings import BANK_TIMEZONE, ORDER_TTL_MINUTES


@dataclass(frozen=True)
class ParsedPayment:
    amount: int
    paid_at: datetime  # UTC, naive for DB portability


_AMOUNT_RE = re.compile(r'^\s*➕\s*([\d.\s]+),(\d{2})\s*UZS\s*$', re.MULTILINE | re.IGNORECASE)
_TIME_RE = re.compile(r'^\s*🕓\s*(\d{2}:\d{2})\s+(\d{2}\.\d{2}\.\d{4})\s*$', re.MULTILINE)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_payment_message(text: str) -> ParsedPayment | None:
    amount_match = _AMOUNT_RE.search(text or '')
    time_match = _TIME_RE.search(text or '')
    if not amount_match or not time_match:
        return None

    integer_part = re.sub(r'\D', '', amount_match.group(1))
    if not integer_part:
        return None

    amount = int(integer_part)
    local_time = datetime.strptime(
        f'{time_match.group(1)} {time_match.group(2)}',
        '%H:%M %d.%m.%Y',
    ).replace(tzinfo=ZoneInfo(BANK_TIMEZONE))
    paid_at = local_time.astimezone(timezone.utc).replace(tzinfo=None)
    return ParsedPayment(amount=amount, paid_at=paid_at)


def expire_stale_orders(db: Session, now: datetime | None = None) -> int:
    now = now or utcnow()
    stale = list(db.scalars(select(Order).where(Order.status == 'pending', Order.expires_at < now)))
    for order in stale:
        order.status = 'expired'
    if stale:
        db.commit()
    return len(stale)


def create_order(db: Session, product: Product) -> Order:
    now = utcnow()
    expires_at = now + timedelta(minutes=ORDER_TTL_MINUTES)
    expire_stale_orders(db, now)

    used_amounts = set(db.scalars(
        select(Order.exact_amount).where(
            Order.status == 'pending',
            Order.expires_at >= now,
            Order.price == product.price,
        )
    ))
    suffixes = list(range(1, 100))
    random.shuffle(suffixes)
    exact_amount = next((product.price + suffix for suffix in suffixes if product.price + suffix not in used_amounts), None)
    if exact_amount is None:
        raise RuntimeError('No payment amount is currently available')

    order = Order(
        public_id=secrets.token_hex(4).upper(),
        product_code=product.code,
        product_name=product.name,
        price=product.price,
        exact_amount=exact_amount,
        status='pending',
        created_at=now,
        expires_at=expires_at,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def match_payment(
    db: Session,
    *,
    event_key: str,
    raw_text: str,
    parsed: ParsedPayment,
) -> Order | None:
    existing = db.scalar(select(PaymentMessage).where(PaymentMessage.event_key == event_key))
    if existing:
        return db.get(Order, existing.order_id) if existing.order_id else None

    candidates = list(db.scalars(
        select(Order).where(
            Order.exact_amount == parsed.amount,
            Order.created_at <= parsed.paid_at,
            Order.expires_at >= parsed.paid_at,
            Order.status.in_(('pending', 'expired')),
        )
    ))

    payment = PaymentMessage(
        event_key=event_key,
        amount=parsed.amount,
        bank_paid_at=parsed.paid_at,
        raw_text=raw_text,
    )
    db.add(payment)

    if len(candidates) != 1:
        payment.status = 'ambiguous' if len(candidates) > 1 else 'unmatched'
        db.commit()
        return None

    order = candidates[0]
    order.status = 'paid'
    order.paid_at = parsed.paid_at
    order.payment_message_id = event_key
    payment.status = 'matched'
    payment.order_id = order.id
    db.commit()
    db.refresh(order)
    return order
