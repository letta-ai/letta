# Setting Up Deployment with Github Actions
We use Google

First we need to setup workflow identify federation with gcloud

```
gcloud iam workload-identity-pools create "github" \
  --project="memgpt-428419" \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

Then get the full ID of the pool

```
gcloud iam workload-identity-pools delete "github" \
  --project="memgpt-428419" \
  --location="global" \
  --format="value(name)"
```

Then create a service account

```
gcloud iam workload-identity-pools providers create-oidc "letta-web" \
  --project="memgpt-428419" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="My GitHub repo Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == 'letta-ai'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

Extract the Workload Identity Provider resource name:

```
gcloud iam workload-identity-pools providers describe "letta-web" \
  --project="memgpt-428419" \
  --location="global" \
  --workload-identity-pool="github"
```

Then use the value 
