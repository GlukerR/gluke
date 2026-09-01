export default {
  nav: {
    projects: 'Проекты',
    services: 'Услуги',
    process: 'Процесс',
    about: 'О студии',
    ariaPrimary: 'Основная навигация',
    ariaFooter: 'Навигация в подвале',
    ariaMobile: 'Мобильная навигация',
  },
  menu: {
    open: 'Меню',
    close: 'Закрыть',
    contacts: 'Контакты',
  },
  layout: {
    skipToContent: 'Перейти к содержимому',
  },
  themeSwitcher: {
    dark: 'Тёмная тема',
    light: 'Светлая тема',
    switchToDark: 'Включить тёмную тему',
    switchToLight: 'Включить светлую тему',
  },
  localeSwitcher: {
    label: 'Язык',
    switchTo: 'Переключить сайт на {language} ({code})',
    current: 'Текущий язык: {language} ({code})',
  },
  footer: {
    sections: 'Разделы',
    contacts: 'Контакты',
    proof: 'Подтверждения',
  },
  home: {
    stats: {
      srTitle: 'Опыт студии в цифрах',
    },
    projects: {
      eyebrow: 'ПРОЕКТЫ',
      title: 'Техническая визуализация в реальных задачах',
    },
    services: {
      eyebrow: 'УСЛУГИ',
      title: 'Что мы можем сделать для вашего продукта',
      proofLabel: 'Компании:',
    },
    process: {
      eyebrow: 'ПРОЦЕСС',
      title: 'Понятный путь от исходников до результата',
    },
    about: {
      eyebrow: 'О СТУДИИ',
      team: 'Команда',
      audiences: 'Для кого работаем',
      pricing: 'Стоимость',
    },
    contact: {
      title: 'Есть продукция, которую нужно визуализировать?',
    },
  },
  projects: {
    eyebrow: 'ПРОЕКТЫ',
    title: 'Проекты GLUKE',
    card: {
      view: 'Смотреть кейс',
    },
    categories: {
      back: 'Все профили',
      card: {
        view: 'Смотреть кейсы',
      },
      orgtech: {
        title: 'Оргтехника и IT',
        description: 'Сетевое оборудование, ПК и дроны.',
      },
      industrial: {
        title: 'Промышленность',
        description: 'Станки, котлы и сложное оборудование.',
      },
      furniture: {
        title: 'Мебель и интерьеры',
        description: 'Столы, мебель и товары для дома.',
      },
      exteriors: {
        title: 'Экстерьеры',
        description: 'Архитектура и экстерьерные визуализации.',
      },
      cinematics: {
        title: 'Синематики',
        description: 'Трейлеры, ролики и рекламные синематики.',
      },
      gameready: {
        title: 'Гейм-реди модели',
        description: 'Game-ready модели и real-time ассеты.',
      },
    },
  },
  project: {
    back: 'Вернуться к проектам',
    period: 'Период',
    duration: 'Длительность',
    clientLink: 'Перейти на сайт клиента',
    clientLinkAria: 'Перейти на сайт клиента {client}',
    overviewSrTitle: 'Ключевые показатели проекта',
    scopeSrTitle: 'Состав работ по проекту',
    services: 'Услуги',
    deliverables: 'О проекте',
    gallery: 'Материалы проекта',
    media: {
      unsupported: 'Ваш браузер не воспроизводит это видео.',
      openFile: 'Открыть видеофайл',
      rotate: 'Вращайте',
    },
    pager: {
      srTitle: 'Другие кейсы',
      previous: 'Предыдущий кейс',
      next: 'Следующий кейс',
    },
  },
  breadcrumb: {
    home: 'Главная',
    projects: 'Проекты',
  },
  seo: {
    homeTitle: '{site} — {tagline}',
    projectsTitle: 'Проекты — {site}',
    projectsCategoryTitle: '{category} — {site}',
    /* Имя клиента уже входит в заголовок большинства кейсов,
       поэтому в title оно не дублируется. */
    projectTitle: '{title} — {site}',
    projectsDescription: 'Кейсы студии GLUKE: 3D-моделирование, каталожные рендеры, анимации и модели для веб-вьюверов.',
    projectsCategoryDescription: '{category}: {description}',
  },
  errors: {
    siteContentUnavailable: 'Глобальный контент сайта недоступен для текущего языка',
    featuredProjectsMissing: 'Опубликованные избранные проекты не найдены',
    publishedProjectsMissing: 'Опубликованные проекты не найдены',
    projectNotFound: 'Проект не найден',
    projectOrderFailed: 'Не удалось определить порядок кейсов',
  },
}
