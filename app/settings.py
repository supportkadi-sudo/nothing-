import os

ORDER_TTL_MINUTES = int(os.getenv('ORDER_TTL_MINUTES', '5'))
BANK_TIMEZONE = os.getenv('BANK_TIMEZONE', 'Asia/Tashkent')
BOT_TOKEN = os.getenv('BOT_TOKEN', '').strip()
ADMIN_TELEGRAM_ID = int(os.getenv('ADMIN_TELEGRAM_ID', '0') or 0)
PAYMENT_CARD_NUMBER = os.getenv('PAYMENT_CARD_NUMBER', '').strip()
PAYMENT_CARD_LABEL = os.getenv('PAYMENT_CARD_LABEL', 'HUMOCARD').strip() or 'HUMOCARD'
