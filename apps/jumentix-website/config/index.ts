export default {
  /**
   * Nextra metadata configuration
   * @see https://nextra.vercel.app/docs/metadata
   */
  metadata: {
    title: {
      default: 'Jumentix | Enterprise Software Factory',
      template: '%s | Jumentix'
    },
    description:
      'Jumentix accelerates enterprise software delivery with contract-first architecture, reusable adapters, and production governance.',
    metadataBase: new URL('https://jumentix.vercel.app/'),
    keywords: [
      'Jumentix',
      'Enterprise SaaS',
      'Software Factory',
      'DDD',
      'Hexagonal Architecture',
      'Event Driven',
      'REST API',
      'Realtime API',
      'Microservices'
    ],
    generator: 'Next.js',
    applicationName: 'Jumentix',
    appleWebApp: {
      title: 'Jumentix'
    },
    openGraph: {
      // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
      url: './',
      siteName: 'Jumentix',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: '/mantine+nextjs+nextra-template.png',
          width: 1200,
          height: 630,
          alt: 'Jumentix Enterprise Software Factory'
        }
      ]
    },
    other: {
      'msapplication-TileColor': '#fff'
    },
    twitter: {
      site: 'https://jumentix.vercel.app/',
      card: 'summary_large_image',
      images: ['/mantine+nextjs+nextra-template.png']
    },
    alternates: {
      // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
      canonical: './'
    }
  },
  /**
   * Nextra Layout component configuration
   */
  nextraLayout: {
    docsRepositoryBase:
      'https://github.com/web2solutions/aaa-typescript-boilerplate/tree/dev/apps/jumentix-website',
    sidebar: {
      defaultMenuCollapseLevel: 1
    }
  },
  /**
   * Main Layout head configuration
   */
  head: {
    mantine: {
      defaultColorScheme: 'dark',
      nonce: '8IBTHwOdqNKAWeKl7plt8g=='
    }
  },
  /**
   * GitHub API configuration
   * @see https://docs.github.com/en/rest/reference/repos#releases
   *
   * The GitHub API token is optional for rate limiting.
   * If you want to use it, create a personal access token with the `repo` scope.
   *
   * This information is used to fetch the releases from the GitHub API.
   */
  gitHub: {
    repo: 'web2solutions/aaa-typescript-boilerplate',
    apiUrl: 'https://api.github.com',
    releasesUrl: 'https://api.github.com/repos/web2solutions/aaa-typescript-boilerplate/releases'
  },

  /**
   * Release notes configuration
   * This is used to link the release notes in the app.
   */
  releaseNotes: {
    url: 'https://github.com/web2solutions/aaa-typescript-boilerplate/releases',
    maxReleases: 10
  },

  /**
   * Search configuration (for pagefind)
   * This is used to configure the search engine API.
   * @see /app/api/search/route.ts
   */
  search: {
    queryKeyword: 'q',
    minQueryLength: 3,
    limitKeyword: 'limit',
    defaultMaxResults: 5,
    excerptLengthKeyword: 'excerptLength',
    defaultExcerptLength: 30,
    defaultLanguage: 'en'
  }
} as const;
