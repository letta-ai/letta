#!/usr/bin/env node

/**
 * Test with real git commits but mock Linear API calls
 */

import LinearDeploymentAutomation from './linear-automation.js';

class GitTestAutomation extends LinearDeploymentAutomation {
  constructor() {
    super();
    console.log('🧪 Testing with REAL git commits but MOCK Linear API');
  }

  // Use real git commits but mock Linear API calls
  async findLinearIssue(issueId) {
    console.log(`🔍 [MOCK] Would search Linear for: ${issueId}`);
    return {
      id: `mock-${issueId}`,
      identifier: issueId,
      title: `Mock issue for ${issueId}`,
      state: { name: 'In Progress', type: 'started' },
      team: { id: 'mock-team', name: 'Engineering' }
    };
  }

  async getDoneWorkflowState(teamId) {
    console.log(`🔄 [MOCK] Would get Done state for team: ${teamId}`);
    return { id: 'mock-done', name: 'Done', type: 'completed' };
  }

  async updateIssueStatus(issue, doneState) {
    console.log(`✅ [MOCK] Would update ${issue.identifier} to "${doneState.name}"`);
    return true;
  }

  async addDeploymentComment(issue, deploymentUrl) {
    console.log(`💬 [MOCK] Would add deployment comment to ${issue.identifier}`);
  }
}

const gitTest = new GitTestAutomation();
gitTest.run();
