# NOTHING by KADI

Минимальный рабочий магазин, где можно купить абсолютно ничего.

Проект специально оставлен маленьким: обычный HTML/CSS/JS, FastAPI, PostgreSQL и один Telegram Business-бот для подтверждения переводов.

## Что работает

- текущий одностраничный фронтенд NOTHING;
- 4 варианта товара;
- создание заказа на 5 минут;
- уникальная сумма `цена + случайный хвост 1..99` среди активных заказов;
- автоматическая проверка статуса заказа с сайта;
- Telegram Business обработчик банковских уведомлений;
- простой парсер банковского сообщения: только сумма `➕` и время `🕓`;
- матчинг перевода по точной сумме и 5-минутному окну заказа;
- защита от повторной обработки одного Telegram-сообщения;
- уведомление админу после успешного заказа;
- реальные счётчики на лендинге: количество покупок, общая сумма, максимальная покупка и последние оплаченные заказы;
- PostgreSQL через Docker Compose, SQLite для локальной разработки.

## Прод-домен

`https://nothing.itskadi.uz`

Готовый nginx-конфиг лежит в `deploy/nginx.conf`. Docker публикует FastAPI только на `127.0.0.1:8000`, поэтому наружу приложение должно идти через nginx.

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
```

`PAYMENT_CARD_NUMBER` должен содержать настоящие реквизиты, которые будут показаны покупателю.

Команда `/whoami` у бота показывает Telegram ID, который можно записать в `ADMIN_TELEGRAM_ID`.

## Telegram Business

Бот должен быть подключён к Telegram Business аккаунту. В Bot API такие сообщения приходят как `business_message`; приложение пытается разобрать только сообщения, похожие на банковское пополнение. Остальной чат бот игнорирует.

После совпадения бот отправляет `ADMIN_TELEGRAM_ID` короткое уведомление о продаже.

## Docker Compose

Создайте `.env` рядом с `docker-compose.yml`, затем:

```bash
docker compose up -d --build
```

Поднимутся:

- `db` — PostgreSQL;
- `web` — FastAPI + сайт на `127.0.0.1:8000`;
- `bot` — Telegram Business обработчик.

## Прод-деплой на nothing.itskadi.uz

Сначала DNS A-запись `nothing.itskadi.uz` должна указывать на IP VPS.

```bash
cd /opt
git clone git@github.com:supportkadi-sudo/nothing-.git nothing
cd /opt/nothing
cp .env.example .env
nano .env
```

После заполнения `.env`:

```bash
docker compose up -d --build
sudo cp deploy/nginx.conf /etc/nginx/sites-available/nothing.itskadi.uz
sudo ln -sfn /etc/nginx/sites-available/nothing.itskadi.uz /etc/nginx/sites-enabled/nothing.itskadi.uz
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d nothing.itskadi.uz
```

Проверка:

```bash
curl http://127.0.0.1:8000/api/health
curl -I https://nothing.itskadi.uz
```

## API

- `GET /api/health`
- `GET /api/config`
- `GET /api/products`
- `POST /api/orders`
- `GET /api/orders/{public_id}`
- `GET /api/stats`

Публичного endpoint «подтвердить оплату» нет. Статус `paid` выставляет только обработчик Telegram Business после совпадения банковского сообщения с заказом.

## Статистика

На фронтенде нет тестовых цифр. `GET /api/stats` считает только заказы со статусом `paid` и возвращает:

- реальное количество покупок;
- реально полученную сумму (`exact_amount`);
- максимальный оплаченный заказ;
- последние 4 оплаченных заказа.
