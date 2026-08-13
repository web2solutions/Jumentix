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
    metadataBase: new URL('https://jumentix-website.vercel.app/'),
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
    icons: {
      icon: '/brand/jumentix-icon.png',
      shortcut: '/brand/jumentix-icon.png',
      apple: '/brand/jumentix-icon.png'
    },
    openGraph: {
      // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
      url: './',
      siteName: 'Jumentix',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: '/brand/jumentix-mascot.png',
          width: 300,
          height: 300,
          alt: 'Jumentix mascot inspired by the Brazilian jegue'
        }
      ]
    },
    other: {
      'msapplication-TileColor': '#fff'
    },
    twitter: {
      site: 'https://jumentix-website.vercel.app/',
      card: 'summary_large_image',
      images: ['/brand/jumentix-mascot.png']
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
      'https://github.com/XpertMinds/Jumentix/tree/dev/apps/jumentix-website',
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
    repo: 'XpertMinds/Jumentix',
    apiUrl: 'https://api.github.com',
    releasesUrl: 'https://api.github.com/repos/XpertMinds/Jumentix/releases',
    commitsUrl: 'https://api.github.com/repos/XpertMinds/Jumentix/commits',
    defaultBranch: 'dev'
  },

  /**
   * Release notes configuration
   * This is used to link the release notes in the app.
   */
  releaseNotes: {
    url: 'https://github.com/XpertMinds/Jumentix/releases',
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
