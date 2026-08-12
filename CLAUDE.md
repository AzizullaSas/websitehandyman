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
  «What's Included» (4 карточки — что входит в установку), цены
  (config-driven), гарантия, how-it-works, возражения, зона обслуживания,
  Straight Talk, FAQ (+FAQPage JSON-LD), контакт с повторным квизом,
  липкий мобильный док Call/Text/Quote.

  **Сайт продаёт ТОЛЬКО установку телевизоров** (с 11.08.2026). Мебель и
  картины/зеркала/полки убраны отовсюду — из квиза, карточек, FAQ, JSON-LD,
  футера. До этого так же убрали электрику (04.08.2026), сушку/двери/замки
  и список мелких работ. Возврат любой услуги — это правки в четырёх
  местах сразу: `SERVICES` в quiz.js, шаг квиза, карточка в index.html и
  `hasOfferCatalog` в JSON-LD, иначе воронка и структурированные данные
  разъезжаются.
- `config.js` — ВСЁ редактируемое владельцем: телефоны, часы, гарантия,
  `pricing` (число → "$120", `[low,high]` → диапазон, строка → как есть,
  null → скрыто), ссылки Google, `analytics` (GA4/Meta — грузятся только
  если заданы), адрес Supabase. Долларовые суммы в HTML не хардкодить.
- `js/quiz.js` — квиз-воронка: 4 шага (1 размер TV → 2 стена + кронштейн →
  3 день/окно приезда + район + детали → 4 контакты), общий стейт двух
  инстансов, honeypot, мгновенная оценка цены на thank-you. Выбора услуги
  на шаге 1 больше нет — услуга одна, `service` константа для CRM.
  Пикер даты (лента дней + окна 9–18) конфигурируется в `config.booking`,
  считается в `Pacific/Honolulu`, ничего не бронирует — это пожелание,
  и формулировки на сайте обязаны это говорить.
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

## ⚖️ Юридические правила (Гавайи) — НЕ НАРУШАТЬ

Владелец **не имеет лицензии подрядчика** (подтверждено 04.08.2026).
Ключевая норма — **HRS §444-9.2(a)**: реклама себя как подрядчика без
лицензии — это **misdemeanor**, и норма прямо распространяется на тех,
кто освобождён по §444-2. §444-9.2(c) позволяет по решению суда
**отключить телефон из объявления** — для этого бизнеса это смертельно.

- **Никогда** не писать «Licensed», «Licensed & Insured», «licensed LLC».
  Появится лицензия — вписать номер в `config.contractorLicense`, и он
  отрендерится сам: §444-9.2(b) **обязывает** лицензиата публиковать номер.
- Объём работ — только handyman-исключение (§444-2): труд + материалы
  ≤ `config.handymanJobLimit` ($1,500), без разрешения на строительство,
  **без электрики и сантехники в любом виде**. Замена вентилятора или
  светильника — это электрика; услуга удалена 04.08.2026, не возвращать.
- «Insured» — фактическое утверждение о действующем полисе (Thimble).
  Полис кончился → `config.insured = false`, и claim исчезает везде.
- Гарантия рекламируется → её условия должны быть доступны: блок
  «What the guarantee covers» в секции #guarantee. Меняешь срок —
  меняй и условия.
- Форма собирает телефон → нужны согласие на звонки/SMS (блок
  `.quiz-consent`, TCPA) и `privacy.html`. Privacy policy обязательна
  ещё и по правилам Google Ads, а реклама уже крутится.
- Эти же ограничения действуют **вне сайта**: Google Business Profile,
  Yelp, Thumbtack, Nextdoor, визитки, наклейка на машине — «advertise»
  в §444-9.2 определено широко.

## Правила

- Обещания на сайте (гарантия, время ответа, оплата) — только из config.js
  и только подтверждённые владельцем.
- Никакого фейкового соцдоказательства; рейтинг-чип рендерится только из
  реальных цифр в `config.reviews`.
- Не обещать гарантированный same-day — только «when available».
- Таблица `leads` закрыта от анонимного чтения (миграция
  `revoke_public_read_on_leads`). Не добавлять RLS-политику для `anon`:
  публикуемый ключ лежит в config.js, то есть виден всем.
- Структурированные данные (JSON-LD) статичны в index.html и дублируют
  значения из config.js. `main.js` предупреждает в консоли при
  расхождении — правь оба места.
- Стратегия привлечения клиентов — `STRATEGY.md` (90-дневный план).
