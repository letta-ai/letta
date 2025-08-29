import os
import time

import jwt
import requests
from google.cloud import compute_v1, secretmanager

GCP_PROJECT = os.getenv("PROJECT_ID", "memgpt-428419")
GCP_ZONE = os.getenv("ZONE", "us-central1-a")


# working
def get_secret(secret_name):
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{GCP_PROJECT}/secrets/{secret_name}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")


# working
def generate_github_token():
    # Get GitHub App credentials from Secret Manager
    print("Generating GitHub token...")
    private_key = get_secret("dev_ci_gh-app-private-key")
    app_id = get_secret("dev_ci_gh-app-id")

    # Create a JWT for GitHub App authentication
    now = int(time.time())
    payload = {
        "iat": now,
        "exp": now + 600,  # 10 minute expiration
        "iss": app_id,
    }

    # Create JWT token
    token = jwt.encode(payload, private_key, algorithm="RS256")
    print("JWT token generated.")

    # Get an installation token
    installation_url = "https://api.github.com/app/installations"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GCP Runners Manager",
    }

    # Get the first installation ID (assuming single installation)
    response = requests.get(installation_url, headers=headers)
    installation_id = response.json()[0]["id"]

    print("Installation ID retrieved.")
    # Get an access token for this installation
    token_url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    response = requests.post(token_url, headers=headers)
    print("Access token retrieved.")
    return response.json()["token"]


# Configuration
GITHUB_ORG = os.getenv("GITHUB_ORG", "letta-ai")
GITHUB_REPO = os.getenv("GITHUB_REPO", "letta-cloud")
MIG_NAME = os.getenv("INSTANCE_GROUP", "ci-runner-manager-dev")
MIN_RUNNERS = int(os.getenv("MIN_RUNNERS", 1))
MAX_RUNNERS = int(os.getenv("MAX_RUNNERS", 10))
MAX_JOBS_PER_RUNNER = 1


def autoscale_github_runners(token):
    """Basic autoscaling function"""

    # 1. Get all individual jobs (not just workflows)
    jobs = get_github_jobs(token, ["queued", "in_progress"])

    # 2. Count jobs by status
    queued_jobs_count = len([j for j in jobs if j["status"] == "queued"])
    running_jobs_count = len([j for j in jobs if j["status"] == "in_progress"])

    # 3. Get current runner information
    runners = get_github_runners(token)
    busy_runners = [r for r in runners if r["busy"]]
    idle_runners = [r for r in runners if not r["busy"]]

    print(
        f"Current state: {queued_jobs_count} queued jobs, {running_jobs_count} running jobs, "
        + f"{len(busy_runners)} busy runners, {len(idle_runners)} idle runners"
    )

    # 4. Calculate needed runners based on all jobs
    needed_runners = min(
        MAX_RUNNERS,
        max(
            MIN_RUNNERS,
            ((queued_jobs_count + running_jobs_count) + MAX_JOBS_PER_RUNNER - 1) // MAX_JOBS_PER_RUNNER,
        ),
    )
    print(f"Needed runners: {needed_runners}")

    # 5. Get current MIG size
    current_size = get_gcp_mig_size()

    # 6. Determine if resize is needed
    if needed_runners > current_size:
        print(f"Scaling up: {current_size} -> {needed_runners}")
        resize_gcp_mig(needed_runners)
    elif needed_runners < current_size:
        # Resizing to scale down as jobs were completed was killing off busy runners
        # waiting for all jobs to complete before scaling down as a compromise
        if queued_jobs_count + running_jobs_count == 0:
            print(f"Scaling down: {current_size} -> {needed_runners}")
            resize_gcp_mig(needed_runners)
    else:
        print(f"No resize needed: current={current_size}, target={needed_runners}")


# working
def get_github_jobs(token, statuses):
    """Get GitHub Actions jobs with specified statuses"""
    all_jobs = []
    for status in statuses:
        url = f"https://api.github.com/repos/{GITHUB_ORG}/{GITHUB_REPO}/actions/runs?status={status}"

        response = requests.get(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )

        if response.status_code != 200:
            print(f"GitHub API error: {response.json()}")
            raise Exception(f"GitHub API error: {response.status_code}")

        data = response.json()
        # For each workflow run, get the individual jobs
        for run in data.get("workflow_runs", []):
            run_id = run["id"]
            jobs_url = f"https://api.github.com/repos/{GITHUB_ORG}/{run['repository']['name']}/actions/runs/{run_id}/jobs"

            jobs_response = requests.get(
                jobs_url,
                headers={
                    "Authorization": f"token {token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "GCP Runners Manager",
                },
            )

            if jobs_response.status_code == 200:
                jobs_in_workflow = jobs_response.json().get("jobs", [])
                all_jobs.extend([job for job in jobs_in_workflow if any([label == "self-hosted" for label in job.get("labels")])])

    return all_jobs


# working
def get_github_runners(token):
    """Get all GitHub self-hosted runners with pagination support"""
    url = f"https://api.github.com/orgs/{GITHUB_ORG}/actions/runners?per_page=100"
    all_runners = []

    while url:
        print(f"Fetching runners from: {url}")
        response = requests.get(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )

        if response.status_code != 200:
            raise Exception(f"GitHub API error: {response.status_code}")

        # Add runners from current page
        page_runners = response.json().get("runners", [])
        all_runners.extend(page_runners)
        print(f"Fetched {len(page_runners)} runners from current page")

        # Check for next page in pagination Links header
        url = None
        if "Link" in response.headers:
            links = response.headers["Link"].split(",")
            for link in links:
                # Find the "next" link
                if 'rel="next"' in link:
                    url = link.split(";")[0].strip(" <>")

        # Alternative approach using requests built-in link parsing
        # url = response.links.get("next", {}).get("url")

    print(f"Total runners fetched: {len(all_runners)}")

    # Filter out offline runners
    online_runners = [runner for runner in all_runners if runner["status"] != "offline"]
    print(f"Online runners: {len(online_runners)}")

    return online_runners


# working
def get_gcp_mig_size():
    """Get the current size of the managed instance group"""
    client = compute_v1.InstanceGroupManagersClient()

    # Format: projects/{project}/zones/{zone}/instanceGroupManagers/{instance_group_manager}
    request = compute_v1.GetInstanceGroupManagerRequest(project=GCP_PROJECT, zone=GCP_ZONE, instance_group_manager=MIG_NAME)

    try:
        response = client.get(request)
        print(f"Current MIG size: {response.target_size}")
        return response.target_size
    except Exception as e:
        print(f"Error getting MIG size: {str(e)}")
        raise


# working
def resize_gcp_mig(target_size):
    """Resize the managed instance group to the target size"""
    client = compute_v1.InstanceGroupManagersClient()

    request = compute_v1.ResizeInstanceGroupManagerRequest(
        project=GCP_PROJECT,
        zone=GCP_ZONE,
        instance_group_manager=MIG_NAME,
        size=target_size,
    )

    try:
        operation = client.resize(request)
        print(f"Resizing MIG to {target_size}, operation: {operation.name}")
        return operation
    except Exception as e:
        print(f"Error resizing MIG: {str(e)}")
        raise


# Cloud Run function entry point
def webhook_handler(request):
    """Entry point for GitHub webhook events"""

    try:
        event = request.headers.get("X-GitHub-Event")
        payload = request.get_json()
        # Check if the job is intended for self-hosted runners
        if event == "workflow_job" and payload.get("workflow_job", {}).get("labels", []):
            labels = payload.get("workflow_job", {}).get("labels", [])
            if "self-hosted" in labels:
                print(f"Event is for self-hosted runner with labels: {labels}")
                action = payload.get("action")
                print(f"Received workflow_job webhook with action {action}")
                if action in ["queued", "completed"]:
                    print(f"Received workflow_job webhook with action {action}")
                    token = generate_github_token()
                    autoscale_github_runners(token)
                return {"status": "success"}

        return {
            "status": "ignored",
            "event": event,
            "message": "Event is probably not for self-hosted runner",
        }
    except Exception as e:
        print(f"Error handling webhook: {str(e)}")
        return {"status": "error", "message": str(e)}, 500


if __name__ == "__main__":
    token = generate_github_token()
    print(get_github_jobs(token, ["queued", "in_progress"]))
    print(get_github_runners(token))
    print(get_gcp_mig_size())
    # print(autoscale_github_runners(token))
    # print(resize_gcp_mig(10))
