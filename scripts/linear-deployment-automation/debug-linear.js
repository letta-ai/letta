#!/usr/bin/env node

/**
 * Debug script to test Linear API connectivity and issue lookup
 */

import { LinearClient } from '@linear/sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function debugLinearAPI() {
  console.log('🔍 Debugging Linear API connection...');

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error('❌ LINEAR_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new LinearClient({ apiKey });

  try {
    // Test 1: Get viewer (current user)
    console.log('\n1. Testing authentication...');
    const viewer = await client.viewer;
    console.log(`✅ Authenticated as: ${viewer.name} (${viewer.email})`);

    // Test 2: List teams
    console.log('\n2. Listing teams...');
    const teams = await client.teams();
    console.log(`✅ Found ${teams.nodes.length} teams:`);
    teams.nodes.forEach(team => {
      console.log(`   - ${team.name} (${team.key})`);
    });

    // Test 3: Search for a specific issue (replace with your issue ID)
    const testIssueId = process.argv[2] || 'LET-123';
    console.log(`\n3. Searching for issue: ${testIssueId}`);

    const issues = await client.issues({
      filter: {
        number: { eq: parseInt(testIssueId.split('-')[1]) },
        team: { key: { eq: testIssueId.split('-')[0].toUpperCase() } }
      }
    });

    if (issues.nodes.length > 0) {
      const issue = issues.nodes[0];
      // Load related fields
      const [team, state] = await Promise.all([
        issue.team,
        issue.state
      ]);

      console.log(`✅ Found issue: ${issue.title}`);
      console.log(`   State: ${state.name} (${state.type})`);
      console.log(`   Team: ${team.name}`);

      // Test 4: Get workflow states for this team
      console.log(`\n4. Getting workflow states for team: ${team.name}`);
      const teamData = await client.team(team.id);
      const states = await teamData.states();

      console.log(`✅ Found ${states.nodes.length} workflow states:`);
      states.nodes.forEach(state => {
        const marker = state.type === 'completed' ? '🎉' :
                      state.type === 'started' ? '🔄' : '📋';
        console.log(`   ${marker} ${state.name} (${state.type})`);
      });

    } else {
      console.log(`⚠️  Issue ${testIssueId} not found`);
      console.log('💡 Try: node debug-linear.js YOUR-ISSUE-ID');
    }

  } catch (error) {
    console.error('❌ Linear API Error:', error.message);
    if (error.type) {
      console.error(`   Error type: ${error.type}`);
    }
  }
}

console.log('🚀 Linear API Debug Tool');
console.log('Usage: node debug-linear.js [ISSUE-ID]');
debugLinearAPI();
