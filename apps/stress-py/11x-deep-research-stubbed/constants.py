import os
from pathlib import Path

# api configuration
BASE_URL = "https://api-dev.letta.com"
TOKEN = os.environ.get("LETTA_STAGING_API_TOKEN")
TIMEOUT = 15000

# agent configuration
AGENT_FILE_PATH = Path(__file__).parent / "stubbed_research_agent.json"
PROJECT_NAME = "default-project"

# load test configuration
N = 1
BATCH_SIZE = 250
BATCH_DELAY = 0.1
MAX_CONCURRENCY = 250

# webhook configuration
CALLBACK_URL = "https://webhook.site/67177677-797b-414e-ae74-60471dbca4da"

# mock user content
MOCK_USER_CONTENT = """
    Lead Name: Geoff Detgen
    Lead Title: Senior Coordinator Product Compliance And Safety
    Lead LinkedIn URL: https://www.linkedin.com/in/geoff-detgen-122a883b
    Company Name: Fanatics
    Company Domain: fanaticsinc.com
    Company Industry: null

**Research Instructions**
<p>qualify whether this company is a good fit for Avetta, it should ask questions that uncover:</p><p>1. Regulatory Pressure
 "Has the organization recently undergone — or is preparing for — regulatory audits (OSHA, CMS, Joint Commission)?"
 (Signals if compliance automation/streamlining is an urgent need.)</p><p></p><p>2. Vendor / Supplier Complexity
 👉 "How large and complex is their third-party vendor/supplier network, and do they mention challenges with compliance or credentialing?"
 (Avetta's core value shines when supplier/vendor ecosystems are fragmented.)</p><p></p><p>3. Safety & Compliance Initiatives
 👉 "Are they investing in patient safety, workforce safety, or compliance initiatives (e.g., press releases, budget allocations, new hires)?"
 (Confirms alignment with Avetta's safety/compliance positioning.)</p><p></p><p>4. Implementation Fatigue
 👉 "Have they reported issues with previous compliance tools or technology rollouts being too slow or disruptive?"
 (Avetta's high customer ratings for ease of implementation directly address this pain.)</p><p></p><p>5. Financial & ROI Signals
 👉 "Are execs (CFO, COO, Compliance heads) publicly talking about ROI, cost control, or efficiency in compliance programs?"
 (Helps validate Avetta's high-ROI angle for healthcare buyers.)</p>
""".strip()
