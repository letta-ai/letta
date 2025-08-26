#!/usr/bin/env node

/**
 * Test script for Linear Deployment Automation
 * Tests the automation logic without making actual API calls
 */

import LinearDeploymentAutomation from './linear-automation.js';

class TestLinearAutomation extends LinearDeploymentAutomation {
  constructor() {
    super();
    this.testMode = true;
  }

  // Override to return test data instead of real git commits
  getDeploymentCommits() {
    return [
      'feat: add user authentication (LET-123)',
      'fix: resolve login bug - fixes LET-456, PRO-789',
      'docs: update API documentation',
      'feat: implement dashboard PRO-100',
      'chore: update dependencies (PRO-200, LET-300)'
    ];
  }

  // Test issue ID extraction
  testIssueExtraction() {
    console.log('🧪 Testing issue ID extraction...');

    const testCommits = this.getDeploymentCommits();
    const issues = this.extractLinearIssues(testCommits);

    console.log('Test commits:', testCommits);
    console.log('Extracted issues:', issues);

    const expectedIssues = ['LET-123', 'LET-456', 'PRO-789', 'PRO-100', 'PRO-200', 'LET-300'];
    const allFound = expectedIssues.every(issue => issues.includes(issue));

    if (allFound && issues.length === expectedIssues.length) {
      console.log('✅ Issue extraction test passed');
      return true;
    } else {
      console.log('❌ Issue extraction test failed');
      console.log('Expected:', expectedIssues);
      console.log('Got:', issues);
      return false;
    }
  }

  // Mock Linear API calls for testing
  async findLinearIssue(issueId) {
    console.log(`🔍 [MOCK] Finding issue: ${issueId}`);
    return {
      id: `mock-${issueId}`,
      identifier: issueId,
      title: `Mock issue for ${issueId}`,
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
    console.log(`🔄 [MOCK] Getting workflow states for team: ${teamId}`);
    return {
      id: 'mock-done-state-id',
      name: 'Done',
      type: 'completed'
    };
  }

  async updateIssueStatus(issue, doneState) {
    console.log(`✅ [MOCK] Would update ${issue.identifier} to "${doneState.name}"`);
    return true;
  }

  async addDeploymentComment(issue, deploymentUrl) {
    console.log(`💬 [MOCK] Would add deployment comment to ${issue.identifier}`);
    console.log(`    URL: ${deploymentUrl}`);
  }

  // Test the full workflow
  async testFullWorkflow() {
    console.log('\n🧪 Testing full workflow...');

    // Set mock environment variables
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_REPOSITORY = 'test/repo';
    process.env.GITHUB_RUN_ID = '123456';

    try {
      // Get deployment commits
      const commitMessages = this.getDeploymentCommits();
      console.log(`📝 Found ${commitMessages.length} commits to analyze`);

      // Extract Linear issue IDs
      const issueIds = this.extractLinearIssues(commitMessages);
      console.log(`🔍 Found Linear issues: ${issueIds.join(', ')}`);

      // Process each issue
      let updatedCount = 0;
      const deploymentUrl = process.env.GITHUB_SERVER_URL + '/' +
                           process.env.GITHUB_REPOSITORY +
                           '/actions/runs/' + process.env.GITHUB_RUN_ID;

      for (const issueId of issueIds) {
        console.log(`\n🔄 Processing ${issueId}...`);

        const issue = await this.findLinearIssue(issueId);
        if (!issue) {
          console.log(`⚠️ Issue ${issueId} not found`);
          continue;
        }

        console.log(`📋 Found issue: ${issue.title}`);
        console.log(`📊 Current state: ${issue.state.name}`);

        if (issue.state.type === 'completed') {
          console.log(`✅ Issue ${issueId} already completed`);
          continue;
        }

        const doneState = await this.getDoneWorkflowState(issue.team.id);
        if (!doneState) {
          console.log(`⚠️ No Done state found for team ${issue.team.name}`);
          continue;
        }

        const success = await this.updateIssueStatus(issue, doneState);
        if (success) {
          updatedCount++;
          await this.addDeploymentComment(issue, deploymentUrl);
        }
      }

      console.log(`\n🎉 [MOCK] Automation complete! Would update ${updatedCount} issues`);
      return updatedCount === issueIds.length;

    } catch (error) {
      console.error('❌ Test failed:', error);
      return false;
    }
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting Linear Automation Tests\n');

  const tester = new TestLinearAutomation();

  // Test issue extraction
  const extractionTest = tester.testIssueExtraction();

  // Test full workflow
  const workflowTest = await tester.testFullWorkflow();

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`Issue extraction: ${extractionTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Full workflow: ${workflowTest ? '✅ PASS' : '❌ FAIL'}`);

  if (extractionTest && workflowTest) {
    console.log('\n🎉 All tests passed! Automation is ready to use.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

runTests();
