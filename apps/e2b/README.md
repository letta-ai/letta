# letta-sandbox
This repository manages publishing a custom sandbox template to E2B.

The published sandbox templates can be viewed on the [E2B dashboard](https://e2b.dev/dashboard?tab=templates&team=2f08c5f3-7dea-4d3b-bf14-898907e19621).

To update the template, update the `e2b.Dockerfile`, and run the github action workflow.


## Updating to new versions of Letta
When new versions of letta are published, we should modify the `e2b.Dockerfile` to point to the latest version of letta (default is nightly). To do this:
1. (optional) Modify `e2b.Dockerfile` to point to the your desired version of letta
2. Run the github actions workflow or run `e2b template build` locally
3. Check the ID in: https://e2b.dev/dashboard?team=2f08c5f3-7dea-4d3b-bf14-898907e19621&tab=templates
4. ~~Update `E2B_SANDBOX_TEMPLATE_ID` in deployments and in the main repo~~
