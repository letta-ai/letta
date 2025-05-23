# letta-sandbox
This repository manages publishing a custom sandbox template to E2B.

The published sandbox templates can be viewed on the [E2B dashboard](https://e2b.dev/dashboard?tab=templates&team=2f08c5f3-7dea-4d3b-bf14-898907e19621).

To update the template, follow these steps:
1. `git push` changes to `apps/e2b/e2b.Dockerfile`
2. Run `stage-core` and/or `stage-web` (Note: wait for `stage-e2b` to complete)
3. Validate your change had the desired effect
4. Promote validated template id into production by running `deploy-e2b`
(As of 2025-05-23 this only promotes to dev_ci_E2B_SANDBOX_TEMPLATE_ID, since that's our only kian/secrets-part-1 supporting service, and kian/secrets-part-2 hasn't landed)


## Updating manually [DEPRECATED]
When new versions of letta are published, we should modify the `e2b.Dockerfile` to point to the latest version of letta (default is nightly). To do this:
1. (optional) Modify `e2b.Dockerfile` to point to the your desired version of letta
2. Run the github actions workflow or run `e2b template build` locally
3. Check the ID in: https://e2b.dev/dashboard?team=2f08c5f3-7dea-4d3b-bf14-898907e19621&tab=templates
4. Update `E2B_SANDBOX_TEMPLATE_ID` in deployments and in the main repo
