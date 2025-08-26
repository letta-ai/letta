#!/usr/bin/env node

/**
 * Local testing script - safe to run without affecting real Linear issues
 */

import LinearDeploymentAutomation from './linear-automation.js';

class LocalTestAutomation extends LinearDeploymentAutomation {
  constructor() {
    super();
    console.log('🧪 Running in LOCAL TEST MODE - no real Linear updates');
  }

  // Override to use test commits instead of real git history
  getDeploymentCommits() {
    console.log('📝 Using test commits instead of git log');
    return [
      'feat: add Linear automation script (LET-123)',
      'fix: resolve deployment bug - fixes LET-456',
      'docs: update Linear integration docs LET-789',
      'chore: cleanup old deployment scripts'
    ];
  }

  // Override to prevent real Linear API calls
  async findLinearIssue(issueId) {
    console.log(`🔍 [TEST] Would search for issue: ${issueId}`);

    // Return mock issue data
    return {
      id: `mock-${issueId}`,
      identifier: issueId,
      title: `Test issue for ${issueId}`,
      state: {
        name: 'In Progress',
        type: 'started'
      },
      team: {
        id: 'mock-team-id',
        name: 'Engineering'
      }
    };
  }

  async getDoneWorkflowState(teamId) {
    console.log(`🔄 [TEST] Would get workflow states for team: ${teamId}`);
    return {
      id: 'mock-done-state',
      name: 'Done',
      type: 'completed'
    };
  }

  async updateIssueStatus(issue, doneState) {
    console.log(`✅ [TEST] Would update ${issue.identifier} to "${doneState.name}"`);
    return true;
  }

  async addDeploymentComment(issue, deploymentUrl) {
    console.log(`💬 [TEST] Would add comment to ${issue.identifier}:`);
    console.log(`    "🚀 This issue has been deployed to production."`);
    console.log(`    "Deployment: ${deploymentUrl}"`);
  }
}

// Set up test environment
process.env.GITHUB_SERVER_URL = 'https://github.com';
process.env.GITHUB_REPOSITORY = 'test/letta-cloud';
process.env.GITHUB_RUN_ID = '987654321';

// Run local test
const localTest = new LocalTestAutomation();
localTest.run();
