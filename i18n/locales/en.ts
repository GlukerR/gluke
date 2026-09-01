export default {
  nav: {
    projects: 'Projects',
    services: 'Services',
    process: 'Process',
    about: 'Studio',
    ariaPrimary: 'Main navigation',
    ariaFooter: 'Footer navigation',
    ariaMobile: 'Mobile navigation',
  },
  menu: {
    open: 'Menu',
    close: 'Close',
    contacts: 'Contacts',
  },
  layout: {
    skipToContent: 'Skip to content',
  },
  themeSwitcher: {
    dark: 'Dark theme',
    light: 'Light theme',
    switchToDark: 'Switch to dark theme',
    switchToLight: 'Switch to light theme',
  },
  localeSwitcher: {
    label: 'Language',
    switchTo: 'Switch the site to {language} ({code})',
    current: 'Current language: {language} ({code})',
  },
  footer: {
    sections: 'Sections',
    contacts: 'Contacts',
    proof: 'Proof',
  },
  home: {
    stats: {
      srTitle: 'Studio experience in numbers',
    },
    projects: {
      eyebrow: 'PROJECTS',
      title: 'Technical visualization in real production tasks',
    },
    services: {
      eyebrow: 'SERVICES',
      title: 'What we can do for your product',
      proofLabel: 'Companies:',
    },
    process: {
      eyebrow: 'PROCESS',
      title: 'Clear path from source files to the result',
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Frequently asked questions about 3D visualization',
      casesLabel: 'Cases:',
    },
    about: {
      eyebrow: 'STUDIO',
      team: 'Team',
      audiences: 'Who we work with',
      pricing: 'Pricing',
    },
    contact: {
      title: 'Have products you need visualized?',
    },
  },
  projects: {
    eyebrow: 'PROJECTS',
    title: 'GLUKE projects',
    card: {
      view: 'View case',
    },
    categories: {
      back: 'All profiles',
      card: {
        view: 'View cases',
      },
      orgtech: {
        title: 'IT & office equipment',
        description: 'Networking hardware, computers and drones.',
      },
      industrial: {
        title: 'Industrial',
        description: 'Machine tools, boilers and complex equipment.',
      },
      furniture: {
        title: 'Furniture & interiors',
        description: 'Tables, furniture and home goods.',
      },
      exteriors: {
        title: 'Exteriors',
        description: 'Architecture and exterior visualizations.',
      },
      cinematics: {
        title: 'Cinematics',
        description: 'Trailers, videos and advertising cinematics.',
      },
      gameready: {
        title: 'Game-ready models',
        description: 'Game-ready models and real-time assets.',
      },
    },
  },
  project: {
    back: 'Back to projects',
    period: 'Period',
    duration: 'Duration',
    clientLink: 'Visit the client website',
    clientLinkAria: 'Visit the {client} website',
    overviewSrTitle: 'Key project figures',
    scopeSrTitle: 'Scope of work on the project',
    storySrTitle: 'The project in detail',
    services: 'Services',
    deliverables: 'About the project',
    gallery: 'Project materials',
    media: {
      unsupported: 'Your browser cannot play this video.',
      openFile: 'Open the video file',
      rotate: 'Rotate',
    },
    pager: {
      srTitle: 'Other cases',
      previous: 'Previous case',
      next: 'Next case',
    },
  },
  breadcrumb: {
    home: 'Home',
    projects: 'Projects',
  },
  seo: {
    homeTitle: '{site} — {tagline}',
    projectsTitle: 'Projects — {site}',
    projectsCategoryTitle: '{category} — {site}',
    /* The client name is already part of most case titles,
       so it is not repeated in the title. */
    projectTitle: '{title} — {site}',
    projectsDescription: 'GLUKE case archive: 3D modeling, catalogue renders, animations and web-ready 3D models.',
    projectsCategoryDescription: '{category}: {description}',
  },
  errors: {
    siteContentUnavailable: 'Site content is unavailable for the current language',
    featuredProjectsMissing: 'No published featured projects were found',
    publishedProjectsMissing: 'No published projects were found',
    projectNotFound: 'Project not found',
    projectOrderFailed: 'Could not determine the case order',
  },
}
