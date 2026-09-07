import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import Order, PaymentMessage
from app.payments import match_payment, parse_payment_message


BANK_MESSAGE = '''🎉 Пополнение
➕ 77.000,00 UZS
📍 UB Visa to Humo P2P>
💳 HUMOCARD *1828
🕓 20:26 06.09.2026
💰 77.001,70 UZS'''


class PaymentMatchingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_parser_uses_credit_amount_and_bank_time(self):
        parsed = parse_payment_message(BANK_MESSAGE)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.amount, 77000)
        self.assertEqual(parsed.paid_at, datetime(2026, 9, 6, 15, 26))

    def test_matching_is_idempotent_by_event_key(self):
        parsed = parse_payment_message(BANK_MESSAGE)
        self.assertIsNotNone(parsed)

        with self.Session() as db:
            order = Order(
                public_id='TEST0001',
                product_code='plus',
                product_name='NOTHING+',
                price=76950,
                exact_amount=77000,
                status='pending',
                created_at=parsed.paid_at - timedelta(minutes=2),
                expires_at=parsed.paid_at + timedelta(minutes=3),
            )
            db.add(order)
            db.commit()

            first = match_payment(
                db,
                event_key='kadi:test:1',
                raw_text=BANK_MESSAGE,
                parsed=parsed,
            )
            second = match_payment(
                db,
                event_key='kadi:test:1',
                raw_text=BANK_MESSAGE,
                parsed=parsed,
            )

            self.assertIsNotNone(first)
            self.assertEqual(first.id, second.id)
            self.assertEqual(first.status, 'paid')
            self.assertEqual(
                db.scalar(select(func.count(PaymentMessage.id))),
                1,
            )


if __name__ == '__main__':
    unittest.main()
