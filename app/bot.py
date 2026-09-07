import asyncio
import logging
from datetime import timezone
from zoneinfo import ZoneInfo

from aiogram import Bot, Dispatcher, Router
from aiogram.filters import Command
from aiogram.types import Message

from .db import Base, SessionLocal, engine
from .payments import match_payment, parse_payment_message
from .settings import ADMIN_TELEGRAM_ID, BANK_TIMEZONE, BOT_TOKEN

logging.basicConfig(level=logging.INFO)
router = Router()


def money(value: int) -> str:
    return f'{value:,}'.replace(',', ' ') + ' сум'


@router.message(Command('start'))
async def start(message: Message) -> None:
    if ADMIN_TELEGRAM_ID and message.from_user and message.from_user.id != ADMIN_TELEGRAM_ID:
        await message.answer('Этот бот занят важным делом: фиксирует продажи ничего.')
        return
    await message.answer('NOTHING payment bot запущен.\nУведомления об оплаченных заказах придут сюда.')


@router.message(Command('whoami'))
async def whoami(message: Message) -> None:
    if message.from_user:
        await message.answer(f'Ваш Telegram ID: {message.from_user.id}')


@router.business_message()
async def business_payment(message: Message, bot: Bot) -> None:
    text = message.text or message.caption or ''
    parsed = parse_payment_message(text)
    if not parsed:
        return

    connection_id = message.business_connection_id or 'business'
    event_key = f'{connection_id}:{message.chat.id}:{message.message_id}'
    with SessionLocal() as db:
        order = match_payment(db, event_key=event_key, raw_text=text, parsed=parsed)

    if not order or not ADMIN_TELEGRAM_ID:
        return

    paid_time = (order.paid_at.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(BANK_TIMEZONE)).strftime('%H:%M') if order.paid_at else '—')
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


async def main() -> None:
    if not BOT_TOKEN:
        raise RuntimeError('BOT_TOKEN is not set')
    Base.metadata.create_all(bind=engine)
    bot = Bot(BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == '__main__':
    asyncio.run(main())
