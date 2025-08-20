import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

import { defineConfig } from 'cypress';
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

config({ path: resolve(__dirname, '.env') });

// Cache file path for storing test data across runs
const CACHE_DIR = join(__dirname, 'cypress', '.cache');
const CACHE_FILE = join(CACHE_DIR, 'test-cache.json');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

// Cache utilities
function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('Failed to load cache:', error);
  }
  return {
    projects: {},
    projectIds: {},
    templates: {},
    agents: {},
  };
};

interface CacheData {
  projects: Record<string, string>;
  projectIds: Record<string, string>;
  templates: Record<string, string>;
  agents: Record<string, string>;
}

function saveCache(cache: CacheData) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
};

export default defineConfig({
  projectId: process.env.CYPRESS_PROJECT_KEY || '7kya1h',
  retries: {
    runMode: 2,
    openMode: 0,
  },
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'cypress', bundler: 'vite' }),
    baseUrl: 'http://localhost:3000',

    // Performance optimizations - adjusted for Next.js dev mode
    defaultCommandTimeout:
      process.env.NODE_ENV === 'development' ? 20000 : 10000,
    requestTimeout: process.env.NODE_ENV === 'development' ? 30000 : 15000,
    responseTimeout: process.env.NODE_ENV === 'development' ? 30000 : 15000,
    pageLoadTimeout: process.env.NODE_ENV === 'development' ? 120000 : 60000,

    // Memory and resource optimization
    numTestsKeptInMemory: 0,

    // Video and screenshot settings for faster runs
    video: false,
    screenshotOnRunFailure: true,

    // Viewport optimization
    viewportWidth: 1280,
    viewportHeight: 720,

    // Test isolation
    testIsolation: true,

    // Reduce noise in test output
    chromeWebSecurity: false,

    // Setup node events for tasks
    setupNodeEvents(on, config) {
      // Add custom tasks for database seeding/cleanup
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },

        // Project caching tasks
        getProjectSlug(projectName: string) {
          const cache = loadCache();
          return cache.projects[projectName] || null;
        },

        setProjectSlug({ name, slug, id }: { name: string; slug: string; id?: string }) {
          const cache = loadCache();
          cache.projects[name] = slug;
          if (id) {
            cache.projectIds[name] = id;
          }
          saveCache(cache);
          return null;
        },

        getProjectId(projectName: string) {
          const cache = loadCache();
          return cache.projectIds[projectName] || null;
        },

        clearProjectSlug(projectName: string) {
          const cache = loadCache();
          const { [projectName]: _, ...restProjects } = cache.projects;
          const { [projectName]: __, ...restProjectIds } = cache.projectIds;
          saveCache({ ...cache, projects: restProjects, projectIds: restProjectIds });
          return null;
        },

        // Template caching tasks
        getTemplateSlug(templateName: string) {
          const cache = loadCache();
          return cache.templates[templateName] || null;
        },

        setTemplateSlug({ name, slug }: { name: string; slug: string }) {
          const cache = loadCache();
          cache.templates[name] = slug;
          saveCache(cache);
          return null;
        },

        clearTemplateSlug(templateName: string) {
          const cache = loadCache();
          const { [templateName]: _, ...restTemplates } = cache.templates;
          saveCache({ ...cache, templates: restTemplates });
          return null;
        },

        // Agent caching tasks
        getAgentId(agentName: string) {
          const cache = loadCache();
          return cache.agents[agentName] || null;
        },

        setAgentId({ name, id }: { name: string; id: string }) {
          const cache = loadCache();
          cache.agents[name] = id;
          saveCache(cache);
          return null;
        },

        clearAgentId(agentName: string) {
          const cache = loadCache();
          const { [agentName]: _, ...restAgents } = cache.agents;
          saveCache({ ...cache, agents: restAgents });
          return null;
        },

        // Clear all cache
        clearAllCache() {
          const cache = {
            projects: {},
            projectIds: {},
            templates: {},
            agents: {},
          };
          saveCache(cache);
          return null;
        },
      });

      return config;
    },

    // Experiment settings for better performance
    experimentalSessionAndOrigin: true,
    experimentalMemoryManagement: true,
  },
  env: {
    googleRefreshToken: process.env.CYPRESS_GOOGLE_REFRESH_TOKEN,
    googleClientId: process.env.CYPRESS_GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.CYPRESS_GOOGLE_CLIENT_SECRET,

    // Test environment settings
    testDataFile: 'test-data.json',
    isDevMode: process.env.NODE_ENV === 'development',
  },

  // Component testing configuration (if needed in future)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
});
