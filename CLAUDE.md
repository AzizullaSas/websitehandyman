# HandyMan website — CLAUDE.md

Лендинг-воронка **happymaxhandymanservice.com** (HappyMax Handyman Service LLC,
Гонолулу). Статический сайт: HTML + CSS + vanilla JS, без сборки.
Деплой: push в `main` → GitHub Pages (repo `AzizullaSas/websitehandyman`).

## ⚠️ Связанные проекты — НЕ ЛОМАТЬ ДРУГ ДРУГА

Три папки в `…\HappyMax AND XOXO PASTRY AND ANGELINA BELLY DANCE\` — один продакшн:

| Папка | Что это | Где живёт |
|---|---|---|
| **HandyMan website** (эта) | Сайт-воронка, квиз, форма заявок | GitHub Pages |
| **AI AGENT FOR TG** | Голосовой Telegram-агент учёта заказов (Groq STT + Claude → Google Sheets) | Edge Function `telegram-bot` в Supabase `fujjzktpumaxnyofsszy` |
| **CRM for HandyMAN** | Отдельная Next.js CRM (handyman-bot, gmail-poller) — старая система, НЕ задеплоена в общий проект | — |

**Общий бэкенд — Supabase проект CRM `fujjzktpumaxnyofsszy`** (аккаунт happymaxhandyman):
- Таблица `leads` — ОБЩАЯ: сюда пишут `submit-lead` (форма этого сайта,
  `source='website'`, `business_ref='b_handy'`) и `crm-inbound`
  (Quo/Thumbtack/Yelp/Telegram). Схему не менять без проверки всех писателей.
- Таблица `app_config` — общий конфиг (`telegram_bot_token`, `group_chat_id`,
  `topic_id`, `website_leads_topic_id`, ключи API…). Ключи не переименовывать
  и не удалять: их читают `telegram-bot` И `submit-lead`.
- Один Telegram-бот и одна группа HAPPY MAX HANDYMAN SERVICE LLC
  (`group_chat_id` в app_config) на все системы. Webhook бота смотрит в
  `telegram-bot` — не перенастраивать.
- Edge Functions проекта: `telegram-bot`, `crm-inbound`, `submit-lead`
  (исходники первых двух и актуального submit-lead — в репо AI AGENT FOR TG).

## Архитектура сайта

- `index.html` — одна страница: hero с квизом, SMS-полоса, TV-флагман,
  6 услуг, цены (config-driven), гарантия, how-it-works, возражения,
  зона обслуживания, Straight Talk, FAQ (+FAQPage JSON-LD), контакт с
  повторным квизом, липкий мобильный док Call/Text/Quote.
- `config.js` — ВСЁ редактируемое владельцем: телефоны, часы, гарантия,
  `pricing` (число → "$120", `[low,high]` → диапазон, строка → как есть,
  null → скрыто), ссылки Google, `analytics` (GA4/Meta — грузятся только
  если заданы), адрес Supabase. Долларовые суммы в HTML не хардкодить.
- `js/quiz.js` — квиз-воронка (4 шага, ветвление по услуге, общий стейт
  двух инстансов, honeypot, мгновенная оценка цены на thank-you).
- `js/form.js` — `window.HappyMaxLead`: валидация (имя ≥2 букв, телефон США
  10/11 цифр, не повторяющиеся) + отправка в `submit-lead`.
- `js/main.js` — меню, reveal, open-now пилюля, рендер цен, док, трекинг
  (`quiz_start/step`, `generate_lead`, `call_click`, `sms_click`…).

## Поток заявки

```
Квиз → POST fujjzktpumaxnyofsszy/functions/v1/submit-lead
  (валидация, honeypot, 5/IP/час) → INSERT leads → карточка в Telegram-группу
  (топик = app_config.website_leads_topic_id, иначе General)
```

## Legacy

Папка `supabase/` описывает СТАРЫЙ автономный проект `hfnuudllnfnunvodreao`
(запаркован, отключён) — оставлена для справки, НЕ деплоить. Актуальный
`submit-lead` лежит в `AI AGENT FOR TG/supabase/functions/submit-lead/`.

## Правила

- Обещания на сайте (гарантия, время ответа, оплата) — только из config.js
  и только подтверждённые владельцем.
- Никакого фейкового соцдоказательства; рейтинг-чип рендерится только из
  реальных цифр в `config.reviews`.
- Не обещать гарантированный same-day — только «when available».
- Не писать «electrical work / plumbing» (лицензируемые работы в Гавайях).
- Стратегия привлечения клиентов — `STRATEGY.md` (90-дневный план).
