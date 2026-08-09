# Деплой и SEO-настройки окружений

Техническое SEO (canonical, Open Graph, Twitter Cards, sitemap, robots, Schema.org) полностью
зависит от переменных окружения. Ошибка в них ломает индексацию, поэтому проверяйте их до и после деплоя.

## Обязательные переменные окружения

| Переменная | Назначение |
| --- | --- |
| `NUXT_SITE_URL` | Базовый origin сайта. Используется для canonical, `og:url`, `og:image`, sitemap, `@id` в Schema.org и абсолютных `hreflang`. Без неё @nuxtjs/i18n выводит относительные альтернативные ссылки. |
| `NUXT_SITE_NAME` | Имя сайта в Open Graph и Schema.org. |
| `NUXT_SITE_ENV` | Окружение. Управляет индексацией: индексация разрешена только при `production`. |

### Значения по окружениям

| Окружение | `NUXT_SITE_URL` | `NUXT_SITE_NAME` | `NUXT_SITE_ENV` | robots.txt |
| --- | --- | --- | --- | --- |
| Development (локально) | `http://localhost:3000` | `GLUKE` | `development` | `Disallow: /` |
| Vercel Preview | URL preview-деплоя (`https://...`) | `GLUKE` | `staging` | `Disallow: /` |
| Vercel Production | окончательный публичный HTTPS-домен | `GLUKE` | `production` | индексация разрешена, `Disallow: /api/` |

**Внимание:** в Vercel Production `NUXT_SITE_URL` должен быть окончательным публичным HTTPS-доменом.
Временный домен `*.vercel.app` нельзя оставлять как production URL: он попадёт в canonical, sitemap
и Open Graph, и поисковые системы проиндексируют технический адрес.
Production-сборку нельзя выпускать с `localhost` в canonical, sitemap или Open Graph.

### Настройка в Vercel

1. Project Settings → Environment Variables.
2. Добавьте три переменные отдельно для Production и Preview (значения из таблицы выше).
3. Пересоберите проект: переменные читаются в рантайме Nitro, но canonical на прогретых страницах
   стоит перепроверить после первого деплоя.

## Порядок проверки после деплоя

Выполняйте по порядку, подставляя `<PROD_URL>`.

1. **Canonical.** Открыть каждую страницу из списка ниже и убедиться, что `<link rel="canonical">`
   ровно один, абсолютный, начинается с `<PROD_URL>` и не содержит query или hash.
2. **Open Graph и Twitter.** Проверить `og:title`, `og:description`, `og:type`, `og:url`,
   `og:image`, `og:image:alt`, `twitter:card`, `twitter:image`. Все URL должны быть абсолютными.
   `og:type` — `website` для `/` и `/projects`, `article` для страниц кейсов.
3. **Sitemap.** `<PROD_URL>/sitemap.xml` ведёт на `sitemap_index.xml` с двумя дочерними sitemap
   (`en-US`, `ru-RU`). В каждом — шесть URL только на `<PROD_URL>` и `xhtml:link` на второй язык.
4. **Robots.** `<PROD_URL>/robots.txt` должен разрешать публичные страницы, запрещать `/api/`
   и содержать абсолютную ссылку на sitemap.
5. **JSON-LD.** На каждой странице ровно один `<script type="application/ld+json">`;
   содержимое проходит `JSON.parse`; присутствуют `Organization` и `WebSite`;
   на `/projects` — `CollectionPage` и `ItemList`; на кейсе — `CreativeWork` и `BreadcrumbList`.
   `inLanguage` совпадает с языком страницы, а узлы `WebSite` двух языков связаны
   через `translationOfWork`/`workTranslation`.
   Дополнительно можно прогнать страницы через Google Rich Results Test и Schema Markup Validator.
6. **Языковые версии.** На каждой странице есть `hreflang` для `en-US`, `ru-RU` и `x-default`,
   все абсолютные и ведут на 200. `<html lang>` и `og:locale` совпадают с языком страницы,
   canonical не указывает на другой язык.

### URL для ручной проверки

- `<PROD_URL>/` и `<PROD_URL>/ru`
- `<PROD_URL>/projects` и `<PROD_URL>/ru/projects`
- `<PROD_URL>/projects/getic` и `<PROD_URL>/ru/projects/getic`
- `<PROD_URL>/projects/kiparis` и `<PROD_URL>/ru/projects/kiparis`
- `<PROD_URL>/projects/wiederkraft` и `<PROD_URL>/ru/projects/wiederkraft`
- `<PROD_URL>/projects/house-guru` и `<PROD_URL>/ru/projects/house-guru`
- `<PROD_URL>/sitemap_index.xml` — два дочерних sitemap по числу языков
- `<PROD_URL>/robots.txt`
- `<PROD_URL>/en` — должен отдавать 404: английская версия живёт без префикса
- `<PROD_URL>/projects/not-existing` — должен отдавать 404

## Поисковые системы

Добавлять сайт в Google Search Console и Яндекс Вебмастер следует только после того,
как подключён production-домен и проверки выше пройдены. Отправлять на индексацию
preview-деплой нельзя: он закрыт `Disallow: /`.

После подтверждения прав отправьте `<PROD_URL>/sitemap_index.xml` в обе панели:
он содержит обе языковые версии.
