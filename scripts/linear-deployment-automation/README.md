# Linear Deployment Automation

This automation script automatically updates Linear ticket status to "Done" when commits containing Linear issue IDs are successfully deployed to production.

## How It Works

1. **Deployment Trigger**: Runs after successful web deployment in GitHub Actions
2. **Commit Analysis**: Scans recent commits for Linear issue IDs (e.g., LET-123, LEX-456)
3. **Status Update**: Moves found issues to "Done" status in their respective Linear workflows
4. **Deployment Comment**: Adds a comment with deployment link to each updated issue

## Setup Instructions

### 1. Linear API Key

1. Go to Linear Settings → API → Create Personal API Key
2. Add the API key to GitHub repository secrets as `LINEAR_API_KEY`

### 2. Issue ID Format

The script recognizes Linear issue IDs in commit messages using the pattern:
- `LET-123` - Standard Linear format
- `LEX-456` - Custom team prefixes
- `ABC-789` - Any 2-4 letter prefix with 1-6 digits

### 3. Commit Message Examples

```bash
git commit -m "feat: add user authentication (LET-123)"
git commit -m "fix: resolve login bug - fixes LET-456"
git commit -m "docs: update API docs for LET-789 and LET-790"
```

## Configuration

### Environment Variables

- `LINEAR_API_KEY` (required): Linear API key for authentication
- `GITHUB_SERVER_URL`: GitHub server URL (auto-provided in Actions)
- `GITHUB_REPOSITORY`: Repository name (auto-provided in Actions)
- `GITHUB_RUN_ID`: Action run ID (auto-provided in Actions)

### Workflow States

The script automatically finds "Done" or "Completed" states in each team's workflow. It:
- Searches for states with names containing "done" or "completed"
- Falls back to states with type "completed"
- Skips issues already in completed states

## Local Testing

### 1. Setup

```bash
# Install dependencies
npm install

# Copy environment file and add your Linear API key
cp .env.example .env
# Edit .env and add your LINEAR_API_KEY
```

### 2. Available Test Commands

```bash
# Basic logic test (no API calls)
npm test

# Local simulation test (no Linear API calls)
npm run test:local

# Test with real git commits but mock Linear API
npm run test:git

# Debug Linear API connection
npm run debug [ISSUE-ID]

# Run all safe tests
npm run test:all

# Run full automation (requires LINEAR_API_KEY)
npm start
```

## Features

- ✅ Automatic Linear issue detection in commit messages
- ✅ Smart "Done" state detection per team
- ✅ Deployment comment with GitHub Actions link
- ✅ Skip already completed issues
- ✅ Error handling and logging
- ✅ Support for multiple issue IDs per commit

## Logs Example

```
🔄 Starting Linear deployment automation...
📝 Found 5 commits to analyze
🔍 Found Linear issues: LET-123, LET-456

🔄 Processing LET-123...
📋 Found issue: Add user authentication
📊 Current state: In Progress
✅ Updated LET-123 to "Done"
💬 Added deployment comment to LET-123

🎉 Automation complete! Updated 2 issues
```

## Troubleshooting

### Common Issues

1. **Issue not found**: Verify the issue ID exists and is accessible with your API key
2. **No Done state**: Ensure teams have a "Done", "Completed", or similar workflow state
3. **API errors**: Check LINEAR_API_KEY is valid and has appropriate permissions

### Debug Mode

Add console logging by modifying the script or checking GitHub Actions logs for detailed execution information.
