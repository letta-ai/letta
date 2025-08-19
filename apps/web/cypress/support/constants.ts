/**
 * Test constants for Cypress E2E tests
 *
 * This file contains static names for test data to ensure:
 * - Predictable test data creation and cleanup
 * - No conflicts between test runs
 * - Easy identification of test data in the system
 *
 * All test data names use the 'cy_test_' prefix for easy identification.
 */

// Test constants for agent testing
export const TEST_CONSTANTS = {
  // Data source names
  DATA_SOURCES: {
    BASIC: 'cy_test_datasource_basic',
    AGENT_DATA: 'cy_test_datasource_agent_data',
    PERSISTENT: 'cy_test_datasource_persistent',
    TEMPLATE: 'cy_test_datasource_template',
    DUPLICATE: 'cy_test_datasource_duplicate',
  },

  // Tool names
  TOOLS: {
    BASIC: 'cy_test_tool_basic',
    ROLL_D20: 'cy_test_tool_roll_d20',
    AGENT_TOOL: 'cy_test_tool_agent_tool',
    FOR_TEMPLATE: 'cy_test_tool_for_template',
    PERSISTENT: 'cy_test_tool_persistent',
    INVALID: 'cy_test_tool_invalid@name#special',
  },

  // Project and agent names
  PROJECT: {
    DEFAULT: 'CYDOGGTestProject',
  },

  AGENT: {
    DEFAULT: 'CYDOGGTestAgent',
  },
} as const;

// Export individual constants for convenience
export const { DATA_SOURCES, TOOLS, PROJECT, AGENT } = TEST_CONSTANTS;
