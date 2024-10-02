# Cypress Documentation
We use cypress to validate functionality of the application. 

## Automation (CI/CD and PRs)
We have a github action that runs the cypress tests on every PR. And also on every push to the main branch.

There's a script caled `check-github-status` that checks the status of the cypress tests on main, if cypress fails on main,
we do not deploy the application. (Cloudbuild will fail)

### Environment Variables
PULLER_TOKEN= is a github token used to pull code from letta-agents, it needs the scope `repo` to be able to pull code from letta-ai/letta-agents
CYPRESS_RECORD_KEY= is the key given from cypress.io to record the tests on their dashboard.
CYPRESS_GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN= are setup from here https://docs.cypress.io/guides/end-to-end-testing/google-authentication so we can do google authentication in the tests.
