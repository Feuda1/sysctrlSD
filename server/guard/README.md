# sd-guard

Маленький сервис для sysctrlSD: видит, кто держит приложение открытым, и умеет
принудительно забанить (человек не сможет зайти, пока не разбанят) или кикнуть
(разово выкинуть, зайти обратно можно сразу же) конкретного пользователя.

Никакой базы данных - `data/state.json`, атомарная перезапись при каждом
изменении. Рассчитано на десяток пользователей, не больше.

## Протокол

- `POST /api/heartbeat` (клиент, раз в 25 сек) - заголовок `X-App-Key`, тело
  `{ userId, email, name }` → `{ banned, kicked }`.
- `GET /api/admin/users`, `POST /api/admin/{ban,unban,kick}` (приложение от
  имени админа) - заголовки `X-App-Key` + `X-User-Id` (id должен быть в
  `ADMIN_ZAMMAD_USER_IDS`).

Ключ `X-App-Key` доказывает лишь то, что запрос от настоящего приложения, а не
что угодно из интернета. Список админов - это доверие внутри маленькой
команды, а не защита от того, кто разберёт exe и достанет из него ключ.

## Деплой на VPS (сделано вручную, повторяет `kk23bonus.service`)

```bash
# 1. отдельный пользователь
useradd -r -s /usr/sbin/nologin sdguard

# 2. код
mkdir -p /opt/sd-guard
cp server.js package.json /opt/sd-guard/
cd /opt/sd-guard && npm install --omit=dev
cp .env.example .env   # и заполнить APP_SHARED_KEY тем же значением,
                        # что MAIN_VITE_APP_SHARED_KEY в корневом .env репозитория
chown -R sdguard:sdguard /opt/sd-guard

# 3. systemd
cp sd-guard.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sd-guard

# 4. nginx + TLS - см. sd.sysctrl.ru.nginx.conf, повторяет new.sysctrl.ru
cp sd.sysctrl.ru.nginx.conf /etc/nginx/sites-available/sd.sysctrl.ru
ln -s /etc/nginx/sites-available/sd.sysctrl.ru /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d sd.sysctrl.ru

# проверка
curl https://sd.sysctrl.ru/api/health
```
