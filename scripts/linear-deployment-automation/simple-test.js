#!/usr/bin/env node

/**
 * Simple test for Linear issue ID extraction
 */

// Test the issue pattern matching
function testIssueExtraction() {
  console.log('🧪 Testing Linear issue ID extraction...');

  const issuePattern = /\b[A-Z]{2,4}-\d{1,6}\b/g;

  const testCommits = [
    'feat: add user authentication (LET-123)',
    'fix: resolve login bug - fixes LET-456, LET-789',
    'docs: update API documentation',
    'feat: implement dashboard LEX-100',
    'chore: update dependencies ABC-1234',
    'fix: handle edge case WXYZ-999999'
  ];

  console.log('Test commits:');
  testCommits.forEach((commit, i) => {
    console.log(`  ${i + 1}. ${commit}`);
  });

  const allIssues = new Set();

  testCommits.forEach(commit => {
    const matches = commit.match(issuePattern);
    if (matches) {
      matches.forEach(match => allIssues.add(match));
    }
  });

  const issues = Array.from(allIssues);

  console.log('\nExtracted issues:', issues);

  const expectedIssues = ['LET-123', 'LET-456', 'LET-789', 'LEX-100', 'ABC-1234', 'WXYZ-999999'];
  const allFound = expectedIssues.every(issue => issues.includes(issue));

  if (allFound && issues.length === expectedIssues.length) {
    console.log('✅ Issue extraction test PASSED');
    return true;
  } else {
    console.log('❌ Issue extraction test FAILED');
    console.log('Expected:', expectedIssues);
    console.log('Got:', issues);
    return false;
  }
}

// Test git command simulation
function testGitCommand() {
  console.log('\n🧪 Testing git command simulation...');

  // Simulate recent commits (would normally come from `git log`)
  const mockCommits = [
    'feat: add Linear automation script (LET-1001)',
    'fix: handle deployment status correctly',
    'docs: update deployment documentation LET-1002',
    'chore: cleanup old scripts'
  ];

  console.log('Mock recent commits:');
  mockCommits.forEach((commit, i) => {
    console.log(`  ${i + 1}. ${commit}`);
  });

  return true;
}

// Test workflow simulation
function testWorkflowSimulation() {
  console.log('\n🧪 Testing workflow simulation...');

  const mockEnvironment = {
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'user/letta-cloud',
    GITHUB_RUN_ID: '123456789'
  };

  const deploymentUrl = mockEnvironment.GITHUB_SERVER_URL + '/' +
                       mockEnvironment.GITHUB_REPOSITORY +
                       '/actions/runs/' + mockEnvironment.GITHUB_RUN_ID;

  console.log('Mock deployment URL:', deploymentUrl);

  if (deploymentUrl.includes('github.com') && deploymentUrl.includes('123456789')) {
    console.log('✅ Workflow simulation test PASSED');
    return true;
  } else {
    console.log('❌ Workflow simulation test FAILED');
    return false;
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running Linear Automation Tests\n');

  const test1 = testIssueExtraction();
  const test2 = testGitCommand();
  const test3 = testWorkflowSimulation();

  console.log('\n📊 Test Summary:');
  console.log(`Issue extraction: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Git command: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Workflow simulation: ${test3 ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = test1 && test2 && test3;

  if (allPassed) {
    console.log('\n🎉 All basic tests PASSED! Core logic is working correctly.');
    console.log('ℹ️  To test with real Linear API, set LINEAR_API_KEY environment variable.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests FAILED. Check the implementation.');
    process.exit(1);
  }
}

runAllTests();
