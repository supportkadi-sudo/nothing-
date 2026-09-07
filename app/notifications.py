import logging
from datetime import timezone
from zoneinfo import ZoneInfo

from aiogram import Bot

from .models import Order
from .settings import ADMIN_TELEGRAM_ID, BANK_TIMEZONE, BOT_TOKEN

logger = logging.getLogger(__name__)


def money(value: int) -> str:
    return f'{value:,}'.replace(',', ' ') + ' сум'


async def notify_paid_order(order: Order) -> bool:
    if not BOT_TOKEN or not ADMIN_TELEGRAM_ID:
        return False

    paid_time = (
        order.paid_at.replace(tzinfo=timezone.utc)
        .astimezone(ZoneInfo(BANK_TIMEZONE))
        .strftime('%H:%M')
        if order.paid_at
        else '—'
    )
    bot = Bot(BOT_TOKEN)
    try:
        await bot.send_message(
            ADMIN_TELEGRAM_ID,
            '✅ NOTHING продано\n\n'
            f'{order.product_name}\n'
            f'Цена: {money(order.price)}\n'
            f'Получено: {money(order.exact_amount)}\n'
            f'Заказ: #{order.receipt_number}\n'
            f'Оплачено: {paid_time}\n\n'
            'Человек успешно получил ничего.',
        )
        return True
    except Exception as exc:
        logger.warning('Failed to send NOTHING paid order notification: %s', exc)
        return False
    finally:
        await bot.session.close()
