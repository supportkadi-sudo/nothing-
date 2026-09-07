# NOTHING by KADI

Минимальный рабочий магазин, где можно купить абсолютно ничего.

Проект специально оставлен маленьким: обычный HTML/CSS/JS, FastAPI, PostgreSQL и простой Telegram-бот для уведомлений админу.

## Что работает

- текущий одностраничный фронтенд NOTHING;
- 4 варианта товара;
- создание заказа на 5 минут;
- уникальная сумма `цена + случайный хвост 1..99` среди активных заказов;
- автоматическая проверка статуса заказа с сайта;
- приём банковских сообщений через защищённый internal relay от существующего KADI Telegram Business bridge;
- простой парсер банковского сообщения: только сумма `➕` и время `🕓`;
- матчинг перевода по точной сумме и 5-минутному окну заказа;
- защита от повторной обработки одного события;
- уведомление админу после успешного заказа;
- реальные счётчики на лендинге: количество покупок, общая сумма, максимальная покупка и последние оплаченные заказы;
- PostgreSQL через Docker Compose, SQLite для локальной разработки.

## Прод-домен

`https://nothing.itskadi.uz`

FastAPI опубликован только на `127.0.0.1:8010`. HTTPS обслуживает существующий nginx KADI.

## Формат банковского сообщения

Парсер рассчитан на такой формат:

```text
🎉 Пополнение
➕ 77.000,00 UZS
📍 UB Visa to Humo P2P>
💳 HUMOCARD *1828
🕓 20:26 06.09.2026
💰 77.001,70 UZS
```

Для матчинга используются только:

- `77 000 UZS` из строки `➕`;
- `20:26 06.09.2026` из строки `🕓`.

Последние цифры карты и баланс после операции не участвуют в матчинге.

## Payment relay

Telegram разрешает один подключённый Business-бот на аккаунт, поэтому NOTHING не требует отдельной Business-привязки.

Поток:

```text
Telegram Business -> существующий KADI bot -> KADI backend -> Celery relay -> NOTHING internal API
```

KADI отправляет в NOTHING только `event_id` и исходный текст банковского уведомления. NOTHING сам парсит сумму и банковское время и принимает решение по своему заказу.

Internal endpoint:

```text
POST /api/internal/payment-message
X-Internal-Payment-Secret: <shared secret>
```

Тело:

```json
{
  "event_id": "telegram_business_humo:...",
  "text": "🎉 Пополнение\n➕ 77.000,00 UZS\n..."
}
```

Повторный `event_id` не обрабатывается второй раз.

## Быстрый локальный запуск

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Сайт: `http://127.0.0.1:8000`

Для запуска Telegram-бота во втором терминале:

```bash
python -m app.bot
```

## Настройка `.env`

```env
DATABASE_URL=sqlite:///./nothing.db
PAYMENT_CARD_LABEL=HUMOCARD
PAYMENT_CARD_NUMBER=0000 0000 0000 1828
ORDER_TTL_MINUTES=5
BANK_TIMEZONE=Asia/Tashkent
BOT_TOKEN=123456:telegram-token
ADMIN_TELEGRAM_ID=123456789
INTERNAL_PAYMENT_SECRET=generate_random_string_32_chars_min
```

`PAYMENT_CARD_NUMBER` содержит реквизиты, которые показываются покупателю.

`INTERNAL_PAYMENT_SECRET` должен совпадать с `NOTHING_RELAY_SECRET` в KADI и храниться только в `.env`.

Команда `/whoami` у NOTHING-бота показывает Telegram ID, который можно записать в `ADMIN_TELEGRAM_ID`.

## Docker Compose

Создайте `.env` рядом с `docker-compose.yml`, затем:

```bash
docker compose up -d --build
```

Поднимутся:

- `db` — PostgreSQL;
- `web` — FastAPI + сайт на `127.0.0.1:8010`;
- `bot` — обычный Telegram-бот для `/start`, `/whoami` и административных уведомлений.

## API

- `GET /api/health`
- `GET /api/config`
- `GET /api/products`
- `POST /api/orders`
- `GET /api/orders/{public_id}`
- `GET /api/stats`
- `POST /api/internal/payment-message` — только с internal secret.

Публичного endpoint «подтвердить оплату» нет. Статус `paid` выставляется только после разбора доверенного банковского события и точного совпадения с заказом.

## Проверки

```bash
python -m unittest discover -s tests -v
```

## Статистика

На фронтенде нет тестовых цифр. `GET /api/stats` считает только заказы со статусом `paid` и возвращает:

- реальное количество покупок;
- реально полученную сумму (`exact_amount`);
- максимальный оплаченный заказ;
- последние 4 оплаченных заказа.
