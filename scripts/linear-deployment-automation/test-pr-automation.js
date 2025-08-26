#!/usr/bin/env node

/**
 * Test script for Linear PR automation logic
 * Tests branch name parsing and Linear ID extraction
 */

// Test cases for branch name patterns
const testCases = [
  // Valid Linear branch formats
  { branch: 'username/LET-123-add-user-auth', expected: 'LET-123', shouldMatch: true },
  { branch: 'john/ABC-456-fix-bug', expected: 'ABC-456', shouldMatch: true },
  { branch: 'jane.doe/XYZ-789-new-feature', expected: 'XYZ-789', shouldMatch: true },
  { branch: 'user_name/PROJ-1234-update-docs', expected: 'PROJ-1234', shouldMatch: true },

  // Edge cases that should work
  { branch: 'u/A-1-test', expected: 'A-1', shouldMatch: true },
  { branch: 'user/ABCD-123456-long-id', expected: 'ABCD-123456', shouldMatch: true },

  // Lowercase Linear IDs that should be converted to uppercase
  { branch: 'username/let-123-add-feature', expected: 'LET-123', shouldMatch: true },
  { branch: 'john/abc-456-fix-bug', expected: 'ABC-456', shouldMatch: true },
  { branch: 'user/proj-789-update', expected: 'PROJ-789', shouldMatch: true },

  // Invalid formats that shouldn't match
  { branch: 'feature/no-linear-id', expected: null, shouldMatch: false },
  { branch: 'main', expected: null, shouldMatch: false },
  { branch: 'user/ABC-abc-letters', expected: null, shouldMatch: false },
  { branch: 'user/TOOLONG-123-too-long', expected: null, shouldMatch: false },
  { branch: 'LET-123-no-username-prefix', expected: null, shouldMatch: false },
];

function extractLinearId(branchName) {
  const regex = /^[^/]+\/([A-Za-z]{1,4}-[0-9]+)/;
  const match = branchName.match(regex);
  return match ? match[1].toUpperCase() : null;
}

function runTests() {
  console.log('🧪 Testing Linear PR automation logic...\n');

  let passed = 0;
  let total = testCases.length;

  testCases.forEach((testCase, index) => {
    const result = extractLinearId(testCase.branch);
    const success = testCase.shouldMatch ?
      (result === testCase.expected) :
      (result === null);

    const status = success ? '✅' : '❌';
    const expectedStr = testCase.shouldMatch ? testCase.expected : 'no match';
    const resultStr = result || 'no match';

    console.log(`${status} Test ${index + 1}: ${testCase.branch}`);
    console.log(`   Expected: ${expectedStr}`);
    console.log(`   Got: ${resultStr}`);

    if (!success) {
      console.log(`   ❌ FAILED`);
    }

    if (success) passed++;
    console.log();
  });

  console.log(`📊 Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Additional test: Simulate the full workflow logic
function simulateWorkflow() {
  console.log('\n🔄 Simulating full workflow logic...\n');

  const exampleBranches = [
    'shub/LET-123-implement-feature',
    'alice/PRO-456-fix-bug',
    'bob/let-789-lowercase-branch',
    'feature/no-linear-id'
  ];

  exampleBranches.forEach(branch => {
    console.log(`Branch: ${branch}`);
    const linearId = extractLinearId(branch);

    if (linearId) {
      console.log(`  ✅ Linear ID found: ${linearId}`);
      console.log(`  📝 Would update PR title with: "${linearId}: [Issue Title]"`);
      console.log(`  📋 Would add Linear section to PR description`);
    } else {
      console.log(`  ℹ️ No Linear ID found, skipping automation`);
    }
    console.log();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
  simulateWorkflow();
}
