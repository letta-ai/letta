const githubRef = process.env.TAG;
const statusUrl = `/repos/letta-ai/letta-web/commits/${githubRef}/check-runs`;
const baseUrl = 'https://api.github.com';

async function checkStatus() {
  try {
    const data = await fetch(`${baseUrl}${statusUrl}`, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_READ_STATUS_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).then(response => {
      if (!response.ok) {
        console.error(response);
        throw new Error('Failed to fetch data');
      }

      return response.json();
    })

    if (!data.check_runs) {
      console.error(data);
      throw new Error('Failed to fetch data');
    }

    const isCypressComplete = data.check_runs.every(checkRun => {
      if (checkRun.name.toLowerCase().includes('cypress')) {
        return checkRun.status === 'completed';
      }

      return true;
    });

    if (!isCypressComplete) {
      console.log('Status not completed');

      setTimeout(() => {
        checkStatus();
      }, 10 * 1000); // 10 seconds
      return;
    }

    const isCypressSuccess = data.check_runs.every(checkRun => {
      if (checkRun.name.toLowerCase().includes('cypress')) {
        return ['skipped', 'success'].includes(checkRun.conclusion);
      }

      return true;
    });

    if (isCypressSuccess) {
      console.log('Status is success');

      fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({ text: 'Cypress test suceeded' }),
      })

      process.exit(0);
    }

    throw new Error('Cypress tests failed');
  } catch (error) {
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ text: 'Cypress tests failed - check them out here (https://cloud.cypress.io/projects/7kya1h/runs)' }),
    })

    console.error(error);
    process.exit(1);
  }
}


void checkStatus();
