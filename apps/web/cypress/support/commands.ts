import '@testing-library/cypress/add-commands';
import 'cypress-wait-until';
import { DATA_SOURCES, TOOLS } from './constants';

Cypress.Commands.add('googleLogin', () => {
  cy.log('Logging in to Google');
  cy.request({
    method: 'POST',
    url: 'https://www.googleapis.com/oauth2/v4/token',
    body: {
      grant_type: 'refresh_token',
      client_id: Cypress.env('googleClientId'),
      client_secret: Cypress.env('googleClientSecret'),
      refresh_token: Cypress.env('googleRefreshToken'),
    },
  }).then(({ body }) => {
    const { id_token } = body;

    cy.visit(`/auth/google/atl?id_token=${id_token}`);

    // complete onboarding if needed
    cy.get('body').then(($btn) => {
      if ($btn.find('[data-testid=complete-onboarding]').length) {
        cy.get('[data-testid=complete-onboarding]').click({ force: true });
      }
    });
  });
});

Cypress.Commands.add('googleLoginWithSession', () => {
  cy.session(
    'googleAuth',
    () => {
      cy.googleLogin();
    },
    {
      validate: () => {
        // Validate session is still active
        cy.request('/api/user/self').its('status').should('eq', 200);
      },
      cacheAcrossSpecs: true,
    },
  );
});

Cypress.Commands.add('importModels', () => {
  cy.request({
    method: 'POST',
    url: '/aia/import-models',
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

Cypress.Commands.add('clearPointerEventLock', () => {
  cy.get('body').invoke('css', 'user-select', 'auto');
  cy.get('body').invoke('css', 'cursor', 'auto');
  cy.get('body').invoke('css', 'pointer-events', 'auto');
});

Cypress.Commands.add('grantAdminAccess', () => {
  cy.request({
    method: 'POST',
    url: '/aia/grant-admin-access',
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

Cypress.Commands.add('deleteProjectsWithName', (name: string) => {
  cy.request({
    method: 'POST',
    url: '/aia/clean-projects-by-name',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      name,
    },
  });
});

Cypress.Commands.add('deleteApiKeyWithName', (name: string) => {
  cy.request({
    method: 'POST',
    url: '/aia/clean-api-keys-by-name',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      name,
    },
  });
});

Cypress.Commands.add('revokeAllClientSideAccessTokens', () => {
  cy.request({
    method: 'POST',
    url: '/aia/revoke-all-client-side-access-tokens',
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

Cypress.Commands.add('createProject', (projectName: string) => {
  cy.visit('/projects');
  cy.findAllByTestId('create-project-button').first().click();
  cy.findByTestId('project-name-input').type(projectName);
  cy.findByTestId('create-project-dialog-confirm-button').click();
  cy.location('pathname', { timeout: 50000 }).should(
    'match',
    /\/projects\/(.+)/,
  );
});

Cypress.Commands.add('seedTestData', () => {
  cy.request({
    method: 'POST',
    url: '/aia/seed-test-data',
    body: {
      projects: ['CYDOGGTestProject', 'DEPLOYMENTEST'],
      models: true,
      credits: 1000,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

Cypress.Commands.add('cleanupTestData', () => {
  cy.request({
    method: 'POST',
    url: '/aia/cleanup-test-data',
    body: {
      dataSources: Object.values(DATA_SOURCES),
      tools: Object.values(TOOLS),
    },
    headers: {
      'Content-Type': 'application/json',
    },
    failOnStatusCode: false,
  });
});

Cypress.Commands.add(
  'ensureDefaultProject',
  (projectName = 'CYDOGGTestProject') => {
    // Use Cypress task to check/store project slug persistently
    cy.task('getProjectSlug', projectName).then((cachedSlug) => {
      if (cachedSlug) {
        // Project already exists, just navigate to it
        cy.visitWithDevDelay(`/projects/${cachedSlug}`);
        cy.get('h1', { timeout: 30000 }).should('exist'); // Verify page loads
      } else {
        // Create project once and store the slug
        cy.visitWithDevDelay('/projects');
        cy.get('h1').contains(/Projects/);

        cy.findAllByTestId('create-project-button').first().click();
        cy.findByTestId('project-name-input').type(projectName);
        cy.findByTestId('create-project-dialog-confirm-button').click();

        cy.location('pathname', { timeout: 50000 })
          .should('match', /\/projects\/(.+)/)
          .then((pathname) => {
            const projectSlug = pathname.split('/')[2];
            cy.task('setProjectSlug', { name: projectName, slug: projectSlug });
          });
      }
    });
  },
);

Cypress.Commands.add('useDefaultProject', () => {
  cy.task('getProjectSlug', 'CYDOGGTestProject').then((projectSlug) => {
    if (projectSlug) {
      cy.visitWithDevDelay(`/projects/${projectSlug}`);
    } else {
      // Fallback to ensuring default project exists
      cy.ensureDefaultProject();
    }
  });
});

Cypress.Commands.add('clearDefaultProject', () => {
  cy.task('clearProjectSlug', 'CYDOGGTestProject');
});

Cypress.Commands.add(
  'ensureDefaultAgentTemplate',
  (templateType = 'Customer support', agentName = 'CYDOGGTestAgent') => {
    cy.task('getTemplateSlug', agentName).then((cachedSlug) => {
      if (cachedSlug) {
        // Template already exists, navigate to it
        cy.useDefaultProject();
        cy.task('getProjectSlug', 'CYDOGGTestProject').then((projectSlug) => {
          cy.visitWithDevDelay(
            `/projects/${projectSlug}/templates/${cachedSlug}`,
          );
          cy.location('pathname', { timeout: 50000 }).should(
            'match',
            new RegExp(`/projects/(.+)/templates/${cachedSlug}`),
          );
        });
      } else {
        // Create agent template once and store the slug
        cy.useDefaultProject();
        // visit default project
        cy.task('getProjectSlug', 'CYDOGGTestProject').then((projectSlug) => {
          cy.visitWithDevDelay(
            `/projects/${projectSlug}`,
          );
        });

        cy.findAllByTestId('create-agent-template-button', {
          timeout: 50000,
        })
          .first()
          .click();

        cy.findByTestId(`image-card:${templateType}`).click();

        cy.location('pathname', { timeout: 50000 }).should(
          'match',
          /\/projects\/(.+)\/templates\/(.+)/,
        );

        cy.findByTestId('update-agent-name-button', {
          timeout: 50000,
        }).click();
        cy.findByTestId('update-name-dialog-update-name').invoke('val', '');
        cy.findByTestId('update-name-dialog-update-name').type(agentName);
        cy.findByTestId('update-name-dialog-confirm-button').click();

        cy.location('pathname', { timeout: 50000 })
          .should('match', new RegExp(`/projects/(.+)/templates/${agentName}`))
          .then((pathname) => {
            const templateSlug = pathname.split('/')[4];
            cy.task('setTemplateSlug', { name: agentName, slug: templateSlug });
          });
      }
    });
  },
);

Cypress.Commands.add('useDefaultAgentTemplate', () => {
  cy.task('getProjectSlug', 'CYDOGGTestProject').then((projectSlug) => {
    cy.task('getTemplateSlug', 'CYDOGGTestAgent').then((templateSlug) => {
      if (projectSlug && templateSlug) {
        cy.visitWithDevDelay(
          `/projects/${projectSlug}/templates/${templateSlug}`,
        );
      } else {
        // Fallback to ensuring default template exists
        cy.ensureDefaultAgentTemplate();
      }
    });
  });
});

Cypress.Commands.add('clearDefaultAgentTemplate', () => {
  cy.task('clearTemplateSlug', 'CYDOGGTestAgent');
});

Cypress.Commands.add('ensureDefaultAgent', () => {
  cy.task('getAgentId', 'CYDOGGTestAgent').then((cachedAgentId) => {
    if (cachedAgentId) {
      // Agent already exists, navigate to it
      cy.task('getProjectSlug', 'CYDOGGTestProject').then((projectSlug) => {
        cy.visitWithDevDelay(
          `/projects/${projectSlug}/agents/${cachedAgentId}`,
        );

        cy.location('pathname', { timeout: 50000 }).should(
          'match',
          new RegExp(`/projects/(.+)/templates/${cachedAgentId}`),
        );
      });
    } else {
      // Create agent from template (like createAgent command)
      cy.useDefaultProject();
      cy.findAllByTestId('nav-button-agents', { timeout: 50000 })
        .first()
        .click();
      cy.findAllByTestId('deploy-agent-dialog-start', { timeout: 50000 })
        .first()
        .click();

      cy.findByTestId('image-card:Customer support').click();

      cy.location('pathname', { timeout: 50000 })
        .should('match', /\/projects\/(.+)\/agents\/(.+)/)
        .then((pathname) => {
          const agentId = pathname.split('/')[4];
          cy.task('setAgentId', { name: 'CYDOGGTestAgent', id: agentId });
        });
    }
  });
});

Cypress.Commands.add('useDefaultAgent', () => {
  cy.task('getProjectSlug', 'CYDOGGTestProject').then((projectSlug) => {
    cy.task('getAgentId', 'CYDOGGTestAgent').then((agentId) => {
      if (projectSlug && agentId) {
        cy.visitWithDevDelay(`/projects/${projectSlug}/agents/${agentId}`);
      } else {
        // Fallback to ensuring default agent exists
        cy.ensureDefaultAgent();
      }
    });
  });
});

Cypress.Commands.add('clearDefaultAgent', () => {
  cy.task('clearAgentId', 'CYDOGGTestAgent');
});

Cypress.Commands.add(
  'seedDefaultProject',
  (projectName = 'CYDOGGTestProject') => {
    // Use caching like ensureDefaultProject but via API
    cy.task('getProjectSlug', projectName).then((cachedSlug) => {
      if (cachedSlug) {
        // Project already exists in cache, no need to create
        cy.log(`Using cached project: ${projectName} (${cachedSlug})`);
      } else {
        // Create project via API and cache the result
        cy.request({
          method: 'POST',
          url: '/api/projects',
          body: {
            name: projectName,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        }).then((response) => {
          expect(response.status).to.eq(201);
          const projectSlug = response.body.slug;
          const projectId = response.body.id;
          // Cache the project ID for future use
          cy.task('setProjectSlug', { name: projectName, slug: projectSlug, id: projectId });
          cy.log(`Created and cached project: ${projectName} (${projectId})`);
        });
      }
    });
  },
);

Cypress.Commands.add(
  'seedDefaultAgentTemplate',
  (templateType = 'Customer support', agentName = 'CYDOGGTestAgent') => {
    // Use caching like ensureDefaultAgentTemplate but via API
    cy.task('getTemplateSlug', agentName).then((cachedSlug) => {
      if (cachedSlug) {
        // Template already exists in cache, no need to create
        cy.log(`Using cached template: ${agentName} (${cachedSlug})`);
      } else {
        // Get the project ID first
        cy.task('getProjectId', 'CYDOGGTestProject').then((projectId) => {
          if (!projectId) {
            throw new Error('Project must be seeded before template');
          }

          // Map template type to starter kit ID
          const starterKitMap = {
            'Customer support': 'customerSupport',
            'Personal assistant': 'personalAssistant',
            'Companion': 'companion',
            'Character roleplay': 'characterRoleplay',
            'Internet chatbot': 'internetChatbot',
            'Scratch': 'scratch',
          };

          const starterKitId = starterKitMap[templateType] || 'customerSupport';

          // Create template via starter kit API
          cy.request({
            method: 'POST',
            url: `/api/starter-kits/${starterKitId}/templates`,
            body: {
              projectId: projectId,
            },
            headers: {
              'Content-Type': 'application/json',
            },
          }).then((response) => {
            expect(response.status).to.eq(201);
            const templateName = response.body.templateName;
            // Cache the template name for future use
            cy.task('setTemplateSlug', { name: agentName, slug: templateName });
            cy.log(`Created and cached template: ${agentName} (${templateName})`);
          });
        });
      }
    });
  },
);

Cypress.Commands.add('waitForInteractiveElement', (selector: string) => {
  cy.get(selector, { timeout: 30000 })
    .should('be.visible')
    .should('not.have.attr', 'disabled')
    .should('not.have.class', 'loading')
    .should('not.have.class', 'disabled')
    .should('not.have.attr', 'aria-disabled', 'true');
});

Cypress.Commands.add('waitForEditableElement', (selector: string) => {
  cy.get(selector, { timeout: 30000 })
    .should('be.visible')
    .should('not.be.disabled')
    .should('not.have.attr', 'readonly')
    .should('not.have.class', 'loading');
});

Cypress.Commands.add('waitForMemoryBlockReady', () => {
  // Wait for the memory block to be loaded and interactive
  cy.get('[data-testid="edit-memory-block-human-content"]', { timeout: 30000 })
    .should('exist')
    .should('be.visible')
    .should('not.have.class', 'loading')
    .should('not.have.class', 'skeleton')
    .should('not.have.attr', 'disabled');

  // Wait for any skeleton loaders or loading states to disappear
  cy.get('body').then(($body) => {
    if ($body.find('.skeleton, .loading').length) {
      cy.get('.skeleton, .loading', { timeout: 10000 }).should('not.exist');
    }
  });

  // Ensure the element content is loaded (not just placeholder)
  cy.get('[data-testid="edit-memory-block-human-content"]')
    .should('not.contain', 'Loading...')
    .should('not.contain', '...');
});

Cypress.Commands.add('visitWithDevDelay', (path: string) => {
  if (Cypress.env('isDevMode')) {
    // Wait for Next.js dev server to be ready
    cy.request({
      url: '/_next/static/chunks/webpack.js',
      failOnStatusCode: false,
      timeout: 60000,
      retryOnStatusCodeFailure: true,
    });
  }
  cy.visit(path);
  if (Cypress.env('isDevMode')) {
    // Extra wait for page compilation in dev mode
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(2000);
  }
});

Cypress.Commands.add('testStep', (stepName: string, fn: () => void) => {
  cy.log(`🔄 ${stepName}`);
  cy.then(() => {
    const start = Date.now();
    fn();
    cy.then(() => {
      const duration = Date.now() - start;
      cy.log(`✅ ${stepName} (${duration}ms)`);
    });
  });
});

Cypress.Commands.add(
  'createIdentity',
  (identityName: string, uniqueIdentifier: string) => {
    cy.findAllByTestId('start-create-identity', { timeout: 50000 })
      .first()
      .click();
    cy.findByTestId('identity-name-input').type(identityName);
    cy.findByTestId('unique-identifier-input').type(uniqueIdentifier);
    cy.findByTestId('create-identity-dialog-confirm-button').click();
  },
);

Cypress.Commands.add(
  'createAgentTemplate',
  (templateType: string, agentName: string) => {
    cy.findAllByTestId('create-agent-template-button', { timeout: 50000 })
      .first()
      .click();
    cy.findByTestId(`image-card:${templateType}`).click();
    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      /\/projects\/(.+)\/templates\/(.+)/,
    );

    cy.findByTestId('update-agent-name-button', {
      timeout: 50000,
    }).click();
    cy.findByTestId('update-name-dialog-update-name').invoke('val', '');
    cy.findByTestId('update-name-dialog-update-name').type(agentName);
    cy.findByTestId('update-name-dialog-confirm-button').click();
    cy.location('pathname', { timeout: 50000 }).should(
      'match',
      new RegExp(`/projects/(.+)/templates/${agentName}`),
    );
  },
);

Cypress.Commands.add('createAgent', () => {
  cy.findAllByTestId('nav-button-agents', { timeout: 50000 }).first().click();
  cy.findAllByTestId('deploy-agent-dialog-start', { timeout: 50000 })
    .first()
    .click();
  cy.findByTestId('image-card:Customer support').click();
  cy.location('pathname', { timeout: 50000 }).should(
    'match',
    /\/projects\/(.+)\/agents\/(.+)/,
  );
});

Cypress.Commands.add('editMemoryBlock', (content: string) => {
  cy.findByTestId('edit-memory-block-human-content', {
    timeout: 50000,
  }).dblclick();
  cy.findByTestId('edit-memory-block-human-content', { timeout: 50000 }).type(
    content,
    { parseSpecialCharSequences: false },
  );
  cy.findByTestId('edit-memory-block-human-content-save').click();
  cy.findByTestId('edit-memory-block-human-content-lock', {
    timeout: 5000,
  }).click();
  // Wait for save indicator instead of arbitrary wait
  cy.waitForMemoryBlockSaved();
});

Cypress.Commands.add('waitForMemoryBlockSaved', () => {
  // Wait for the save button to disappear, indicating save is complete
  cy.findByTestId('edit-memory-block-human-content-save').should('not.exist');
  // Or wait for a save indicator if available
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="save-indicator"]').length) {
      cy.findByTestId('save-indicator').should('contain', 'Saved');
    }
  });
});

Cypress.Commands.add('stageAndDeployAgent', () => {
  cy.clearPointerEventLock();
  cy.findByTestId('stage-new-version-button', { timeout: 50000 }).click({
    force: true,
  });
  cy.findByTestId('version-agent-dialog-migrate-checkbox').click();
  cy.findByTestId('deploy-agent-dialog-trigger', { timeout: 50000 }).click();
  // Wait for deployment to complete instead of arbitrary wait
  cy.waitForDeploymentComplete();
});

Cypress.Commands.add('clearAllCachedData', () => {
  cy.task('clearAllCache');
});

Cypress.Commands.add('freshTestStart', () => {
  cy.log('🔄 Starting fresh test environment');
  cy.clearAllCachedData();
  cy.cleanupTestData();
  cy.seedTestData();
});

Cypress.Commands.add('waitForDeploymentComplete', () => {
  // check if URL contains /distribution
  cy.url().should('include', '/distribution', {
    timeout: 60000,
  });
});

Cypress.Commands.add('createEntitiesFromTemplate', (options: {
  templateVersion: string;
  agentName: string;
  tags?: string[];
  memoryVariables?: Record<string, string>;
  toolVariables?: Record<string, string>;
  identityIds?: string[];
}) => {
  const {
    templateVersion,
    agentName,
    tags = [],
    memoryVariables = {},
    toolVariables = {},
    identityIds = [],
  } = options;

  // Extract project and template_version from templateVersion (format: project_slug/template_name:version)
  const [projectAndTemplate, version = 'latest'] = templateVersion.split(':');
  const [project, templateName] = projectAndTemplate.split('/');

  if (!project || !templateName) {
    throw new Error('Invalid template version format. Expected: project_slug/template_name:version');
  }

  cy.request({
    method: 'POST',
    url: `/v1/templates/${project}/${templateName}:${version}/agents`,
    body: {
      agent_name: agentName,
      tags,
      memory_variables: memoryVariables,
      tool_variables: toolVariables,
      identity_ids: identityIds,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => {
    expect(response.status).to.eq(201);
    expect(response.body).to.have.property('agents');
    expect(response.body.agents).to.be.an('array');
    expect(response.body.agents[0]).to.have.property('id');
    expect(response.body.agents[0]).to.have.property('name', agentName);

    if (tags.length > 0) {
      expect(response.body.agents[0].tags).to.include.members(tags);
    }

    return response.body;
  });
});

Cypress.Commands.add('getTemplateSnapshot', (templateVersion: string) => {
  // Extract project and template_version from templateVersion (format: project_slug/template_name:version)
  const [projectAndTemplate, version = 'latest'] = templateVersion.split(':');
  const [project, templateName] = projectAndTemplate.split('/');

  if (!project || !templateName) {
    throw new Error('Invalid template version format. Expected: project_slug/template_name:version');
  }

  return cy.request({
    method: 'GET',
    url: `/v1/templates/${project}/${templateName}:${version}/snapshot`,
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('agents');
    expect(response.body).to.have.property('blocks');
    expect(response.body).to.have.property('configuration');
    expect(response.body).to.have.property('type');
    expect(response.body).to.have.property('version');
    expect(response.body.agents).to.be.an('array');
    expect(response.body.blocks).to.be.an('array');

    return response.body;
  });
});

Cypress.Commands.add('getCurrentTemplateFromUrl', () => {
  return cy.url().then((url) => {
    // Match pattern: /projects/{projectSlug}/templates/{templateName}
    const match = url.match(/\/projects\/([^\/]+)\/templates\/([^\/\?]+)/);

    if (!match) {
      throw new Error('Current URL is not a template page. Expected format: /projects/{projectSlug}/templates/{templateName}');
    }

    const [, projectSlug, templateName] = match;

    return {
      projectSlug,
      templateName,
      templateVersion: `${projectSlug}/${templateName}:current`,
      fullTemplateVersion: `${projectSlug}/${templateName}:latest`
    };
  });
});
