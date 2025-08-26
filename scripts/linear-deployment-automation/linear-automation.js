#!/usr/bin/env node

/**
 * Linear Deployment Automation Script
 *
 * This script checks commits from a web deployment and moves corresponding
 * Linear tickets to "Done" status when the deployment is successful.
 */

import { LinearClient } from '@linear/sdk';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Mock Linear API key for testing
const testApiKey = process.env.LINEAR_API_KEY || 'mock-api-key-for-testing';

class LinearDeploymentAutomation {
  constructor() {
    this.linearClient = new LinearClient({
      apiKey: testApiKey
    });

    // Pattern to match Linear issue IDs (e.g., LET-123, LEX-456)
    this.issuePattern = /\b[A-Za-z]{2,4}-\d{1,6}\b/g;
  }

  /**
   * Extract Linear issue IDs from commit messages
   */
  extractLinearIssues(commitMessages) {
    const issues = new Set();

    commitMessages.forEach(message => {
      const matches = message.match(this.issuePattern);
      if (matches) {
        matches.forEach(match => issues.add(match));
      }
    });

    return Array.from(issues);
  }

  /**
   * Get commits from the deployment
   */
  getDeploymentCommits() {
    try {
      // Get commits from the last deployment tag to HEAD
      const command = `git log --pretty=format:"%s" --since="1 day ago"`;
      const output = execSync(command, { encoding: 'utf8' });

      return output.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('Error getting deployment commits:', error);
      return [];
    }
  }

  /**
   * Find Linear issue by identifier
   */
  async findLinearIssue(issueId) {
    try {
      const [teamKey, issueNumber] = issueId.split('-');
      const issues = await this.linearClient.issues({
        filter: {
          number: { eq: parseInt(issueNumber) },
          team: { key: { eq: teamKey.toUpperCase() } }
        },
        includeArchived: true
      });

      if (issues.nodes.length > 0) {
        const issue = issues.nodes[0];
        // Ensure team and state are loaded
        await Promise.all([
          issue.team,
          issue.state
        ]);
        return issue;
      }
      return null;
    } catch (error) {
      console.error(`Error finding issue ${issueId}:`, error);
      return null;
    }
  }

  /**
   * Get the "Done" workflow state for a team
   */
  async getDoneWorkflowState(teamId) {
    try {
      const team = await this.linearClient.team(teamId);
      const states = await team.states();

      // Look for "Done", "Completed", or similar states
      const doneState = states.nodes.find(state =>
        state.name.toLowerCase().includes('done') ||
        state.name.toLowerCase().includes('completed') ||
        state.type === 'completed'
      );

      return doneState;
    } catch (error) {
      console.error(`Error getting workflow states for team ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Update Linear issue status to Done
   */
  async updateIssueStatus(issue, doneState) {
    try {
      await this.linearClient.updateIssue(issue.id, {
        stateId: doneState.id
      });

      console.log(`✅ Updated ${issue.identifier} to "${doneState.name}"`);
      return true;
    } catch (error) {
      console.error(`Error updating issue ${issue.identifier}:`, error);
      return false;
    }
  }

  /**
   * Add deployment comment to Linear issue
   */
  async addDeploymentComment(issue, deploymentUrl) {
    try {
      await this.linearClient.createComment({
        issueId: issue.id,
        body: `🚀 This issue has been deployed to production.\n\nDeployment: ${deploymentUrl}`
      });

      console.log(`💬 Added deployment comment to ${issue.identifier}`);
    } catch (error) {
      console.error(`Error adding comment to ${issue.identifier}:`, error);
    }
  }

  /**
   * Main automation workflow
   */
  async run() {
    console.log('🔄 Starting Linear deployment automation...');

    // Validate environment
    if (!process.env.LINEAR_API_KEY) {
      console.error('❌ LINEAR_API_KEY environment variable is required');
      process.exit(1);
    }

    try {
      // Get deployment commits
      const commitMessages = this.getDeploymentCommits();
      console.log(`📝 Found ${commitMessages.length} commits to analyze`);

      // Extract Linear issue IDs
      const issueIds = this.extractLinearIssues(commitMessages);
      console.log(`🔍 Found Linear issues: ${issueIds.join(', ')}`);

      if (issueIds.length === 0) {
        console.log('ℹ️ No Linear issues found in deployment commits');
        return;
      }

      // Process each issue
      let updatedCount = 0;
      const deploymentUrl = process.env.GITHUB_SERVER_URL + '/' +
                           process.env.GITHUB_REPOSITORY +
                           '/actions/runs/' + process.env.GITHUB_RUN_ID;

      for (const issueId of issueIds) {
        console.log(`\n🔄 Processing ${issueId}...`);

        // Find the issue in Linear
        const issue = await this.findLinearIssue(issueId);
        if (!issue) {
          console.log(`⚠️ Issue ${issueId} not found in Linear`);
          continue;
        }

        console.log(`📋 Found issue: ${issue.title}`);

        // Load state and team data
        const [state, team] = await Promise.all([
          issue.state,
          issue.team
        ]);

        console.log(`📊 Current state: ${state.name}`);

        // Skip if already in a completed state
        if (state.type === 'completed') {
          console.log(`✅ Issue ${issueId} already in completed state`);
          continue;
        }

        // Get the "Done" workflow state for this team
        const doneState = await this.getDoneWorkflowState(team.id);
        if (!doneState) {
          console.log(`⚠️ No "Done" state found for team ${team.name}`);
          continue;
        }

        // Update issue status
        const success = await this.updateIssueStatus(issue, doneState);
        if (success) {
          updatedCount++;

          // Add deployment comment
          await this.addDeploymentComment(issue, deploymentUrl);
        }
      }

      console.log(`\n🎉 Automation complete! Updated ${updatedCount} issues`);

    } catch (error) {
      console.error('❌ Automation failed:', error);
      process.exit(1);
    }
  }
}

// Run the automation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const automation = new LinearDeploymentAutomation();
  automation.run();
}

export default LinearDeploymentAutomation;
