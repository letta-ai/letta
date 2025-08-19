// Cypress Test Utilities - Common patterns for improved testing

/**
 * Safe element interaction with proper waiting
 */
export function safeClick(
  selector: string,
  options: { timeout?: number; force?: boolean } = {},
) {
  const { timeout = 30000, force = false } = options;

  cy.get(selector, { timeout })
    .should('be.visible')
    .should('not.be.disabled')
    .should('not.have.class', 'loading')
    .click({ force });
}

/**
 * Safe typing with proper element state checking
 */
export function safeType(
  selector: string,
  text: string,
  options: { clear?: boolean; timeout?: number } = {},
) {
  const { clear = true, timeout = 30000 } = options;

  cy.get(selector, { timeout })
    .should('be.visible')
    .should('not.be.disabled')
    .should('not.have.attr', 'readonly');

  if (clear) {
    // Split the chain for cypress safety
    cy.get(selector).clear();
    cy.get(selector).type(text);
  } else {
    cy.get(selector).type(text);
  }
}

/**
 * Wait for element to be in ready state for interaction
 */
export function waitForReady(selector: string, timeout = 30000) {
  cy.get(selector, { timeout })
    .should('exist')
    .should('be.visible')
    .should('not.have.class', 'loading')
    .should('not.have.class', 'disabled')
    .should('not.have.class', 'skeleton')
    .should('not.have.attr', 'disabled')
    .should('not.have.attr', 'aria-disabled', 'true');
}

/**
 * Conditional element interaction - only act if element exists
 */
export function ifExists(selector: string, callback: () => void) {
  cy.get('body').then(($body) => {
    if ($body.find(selector).length > 0) {
      callback();
    }
  });
}

/**
 * Wait for loading states to complete
 */
export function waitForLoadingComplete(
  selectors = ['.loading', '.skeleton', '[data-loading="true"]'],
) {
  selectors.forEach((selector) => {
    cy.get('body').then(($body) => {
      if ($body.find(selector).length) {
        cy.get(selector, { timeout: 15000 }).should('not.exist');
      }
    });
  });
}

/**
 * Smart navigation with dev mode support
 */
export function smartVisit(path: string) {
  if (Cypress.env('isDevMode')) {
    cy.visitWithDevDelay(path);
  } else {
    cy.visit(path);
  }

  waitForLoadingComplete();
}

/**
 * Verify page loaded correctly
 */
export function verifyPageLoaded(expectedTitle?: string, expectedPath?: RegExp) {
  if (expectedTitle) {
    cy.get('h1', { timeout: 30000 }).should('contain', expectedTitle);
  }

  if (expectedPath) {
    cy.location('pathname').should('match', expectedPath);
  }

  waitForLoadingComplete();
}

/**
 * Fill form field with validation
 */
export function fillField(
  fieldSelector: string,
  value: string,
  options: { validate?: boolean } = {},
) {
  const { validate = true } = options;

  waitForReady(fieldSelector);
  safeType(fieldSelector, value);

  if (validate) {
    cy.get(fieldSelector).should('have.value', value);
  }
}

/**
 * Submit form with proper waiting
 */
export function submitForm(
  submitSelector: string,
  options: { waitForNavigation?: boolean } = {},
) {
  const { waitForNavigation = true } = options;

  safeClick(submitSelector);

  if (waitForNavigation) {
    cy.location('pathname', { timeout: 30000 }).should(
      'not.eq',
      Cypress.currentUrl,
    );
  }
}

/**
 * Select dropdown option safely
 */
export function selectOption(dropdownSelector: string, optionText: string) {
  safeClick(dropdownSelector);
  cy.contains(optionText).click();
  cy.get(dropdownSelector).should('contain', optionText);
}

/**
 * Make authenticated API request
 */
export function authenticatedRequest(
  method: 'DELETE' | 'GET' | 'POST' | 'PUT',
  url: string,
  body?: unknown,
) {
  return cy.request({
    method,
    url,
    body,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Wait for API call to complete
 */
export function waitForAPI(alias: string, expectedStatus = 200) {
  cy.wait(alias).then((interception) => {
    expect(interception.response?.statusCode).to.eq(expectedStatus);
  });
}

/**
 * Setup common API interceptors
 */
export function setupInterceptors() {
  cy.intercept('GET', '/api/user/self').as('getUserSelf');
  cy.intercept('GET', '/v1/projects*').as('getProjects');
  cy.intercept('POST', '/v1/projects*').as('createProject');
  cy.intercept('GET', '/v1/agents*').as('getAgents');
  cy.intercept('POST', '/v1/agents*').as('createAgent');
  cy.intercept('GET', '/v1/models*').as('getModels');
}

/**
 * Generate unique test data
 */
export function generateTestData(prefix = 'test') {
  const timestamp = Date.now();
  return {
    projectName: `${prefix}-project-${timestamp}`,
    agentName: `${prefix}-agent-${timestamp}`,
    apiKeyName: `${prefix}-key-${timestamp}`,
    identityName: `${prefix}-identity-${timestamp}`,
  };
}

/**
 * Clean up test data by pattern
 */
export function cleanupByPattern(pattern: string) {
  cy.request({
    method: 'POST',
    url: '/aia/cleanup-test-data',
    body: { pattern },
    failOnStatusCode: false,
  });
}

/**
 * Setup test environment with caching
 */
export function setupTestEnvironment(options: { useCache?: boolean } = {}) {
  const { useCache = true } = options;

  cy.googleLoginWithSession();

  if (!useCache) {
    cy.freshTestStart();
  } else {
    cy.seedTestData();
  }

  setupInterceptors();
}

/**
 * Setup with cached project and template
 */
export function setupWithDefaults(
  projectName = 'CYDOGGTestProject',
  templateName = 'CYDOGGTestAgent',
) {
  cy.googleLoginWithSession();
  cy.seedTestData();
  cy.ensureDefaultProject(projectName);
  cy.ensureDefaultAgentTemplate('Customer support', templateName);
  setupInterceptors();
}

/**
 * Setup with cached project, template, and agent
 */
export function setupWithAgent(
  projectName = 'CYDOGGTestProject',
  templateName = 'CYDOGGTestAgent',
  _agentName = 'CYDOGGTestAgent',
) {
  cy.googleLoginWithSession();
  cy.seedTestData();
  cy.ensureDefaultProject(projectName);
  cy.ensureDefaultAgentTemplate('Customer support', templateName);
  cy.ensureDefaultAgent();
  setupInterceptors();
}

/**
 * Teardown test environment
 */
export function teardownTestEnvironment() {
  cy.cleanupTestData();
}

/**
 * Force fresh start by clearing cache
 */
export function forceFreshStart() {
  cy.clearAllCachedData();
  cy.cleanupTestData();
  cy.seedTestData();
}

/**
 * Edit memory block content safely
 */
export function editMemoryContent(content: string) {
  cy.waitForMemoryBlockReady();

  safeClick('[data-testid="edit-memory-block-human-content"]');

  cy.waitForEditableElement(
    '[data-testid="edit-memory-block-human-content"]',
  );

  // Split the chain for cypress safety
  cy.findByTestId('edit-memory-block-human-content')
    .should('have.prop', 'tagName', 'TEXTAREA')
    .clear();
  cy.findByTestId('edit-memory-block-human-content')
    .type(content, { parseSpecialCharSequences: false });
}

/**
 * Save memory block changes
 */
export function saveMemoryChanges() {
  safeClick('[data-testid="edit-memory-block-human-content-save"]');
  cy.waitForMemoryBlockSaved();
  safeClick('[data-testid="edit-memory-block-human-content-lock"]');
}

/**
 * Complete memory block edit workflow
 */
export function completeMemoryEdit(content: string) {
  editMemoryContent(content);
  saveMemoryChanges();
}

/**
 * Verify memory block content
 */
export function verifyMemoryContent(expectedContent: string) {
  cy.findByTestId('edit-memory-block-human-content').should(
    'contain',
    expectedContent,
  );
}

/**
 * Create agent template with common setup
 */
export function createTemplate(templateType: string, agentName: string) {
  cy.findAllByTestId('create-agent-template-button', { timeout: 30000 })
    .first()
    .click();

  cy.findByTestId(`image-card:${templateType}`).click();

  cy.location('pathname', { timeout: 30000 }).should(
    'match',
    /\/projects\/(.+)\/templates\/(.+)/,
  );

  if (agentName) {
    safeClick('[data-testid="update-agent-name-button"]');
    safeType(
      '[data-testid="update-name-dialog-update-name"]',
      agentName,
    );
    safeClick('[data-testid="update-name-dialog-confirm-button"]');
  }
}

/**
 * Deploy agent template
 */
export function deployTemplate() {
  safeClick('[data-testid="stage-new-version-button"]');
  safeClick(
    '[data-testid="version-agent-dialog-migrate-checkbox"]',
  );
  safeClick('[data-testid="deploy-agent-dialog-trigger"]');
  cy.waitForDeploymentComplete();
}

/**
 * Set memory variables
 */
export function setMemoryVariable(index: number | string, value: string) {
  safeClick('[data-testid="toggle-variables-button"]');
  safeType(
    `[data-testid="key-value-editor-value-${index}"]`,
    value,
  );
  safeClick('[data-testid="save-variables-button"]');
}

/**
 * Test step wrapper with timing
 */
export function testStep(stepName: string, fn: () => void) {
  cy.testStep(stepName, fn);
}
