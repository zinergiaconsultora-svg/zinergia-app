---
description: Professional and security-first workflow for client software delivery. Use this to analyze, plan, implement, verify, and document client work with explicit review gates.
---

# /client-secure-delivery

## Step 0 — Initialize task control
Create and maintain a task list (`task.md`) that separates:
- research
- architecture and planning
- implementation
- verification
- documentation
- final handoff

Do not treat implementation as complete until verification and documentation are complete.

## Step 1 — Intake, scope, and assumptions
Read the user request and inspect the current workspace before proposing solutions.

Build a concise but rigorous project brief that includes:
- business objective
- requested feature / bug / deliverable
- in-scope and out-of-scope items
- stack and runtime assumptions
- delivery risks
- data sensitivity
- external integrations
- deadline or urgency assumptions
- acceptance criteria
- explicit unknowns

**Output artifact:** `01 - Project Brief and Assumptions`

**Rules:**
- If key information is missing, infer the safest conservative assumptions and label them.
- If the request is high-risk or ambiguous, stop for review after this step.

## Step 2 — Repository preflight audit
Inspect the repository and environment posture.

Review at minimum:
- app structure and module boundaries
- package manifests and lockfiles
- environment variable usage
- auth and permission model
- API boundaries
- migrations and data model
- logging and error handling
- CI/CD or automation
- test coverage and test strategy
- deployment config
- third-party dependencies
- obvious security smells

Specifically flag:
- hardcoded secrets
- missing lockfiles
- outdated or suspicious dependencies
- permissive CORS or admin exposure
- unsafe input handling
- direct string-built queries
- no tests around critical logic
- risky production assumptions
- unclear rollback path

**Output artifact:** `02 - Repo Audit and Risk Register`

## Step 3 — Architecture and implementation plan
Before writing major code, produce a technical plan.

The plan must include:
- current-state summary
- proposed architecture or change strategy
- files/modules likely to change
- dependency changes and justification
- API, schema, or contract impact
- security implications
- compatibility or migration concerns
- rollout strategy
- rollback strategy
- verification plan
- residual risks

**Output artifact:** `03 - Implementation Plan`

**Rules:**
- Do not begin major implementation until this plan exists.
- If the plan touches auth, payments, PII, schema, infra, or production deployment, stop for review.

## Step 4 — Safe implementation
Implement changes in the smallest logical increments possible.

**Implementation rules:**
- prefer local, reversible changes
- preserve repository conventions unless unsafe
- use modular boundaries and clear naming
- avoid speculative abstractions
- avoid broad refactors unless explicitly justified
- keep security controls intact or improve them
- add or update tests together with code
- do not insert real secrets
- use `.env.example`, mocks, or placeholders where needed
- document any change in dependency surface area

For risky work, narrate what changed and why before moving to the next increment.

## Step 5 — Verification and evidence
Verify the work with actual evidence, not claims.

Run whatever is appropriate and available:
- install / dependency resolution if required
- lint
- type checking
- unit tests
- integration tests
- e2e tests
- build
- targeted manual checks
- security or static analysis if tooling exists in the repo

For UI work:
- use the browser tool for validation
- capture recordings when useful

**Output artifact:** `04 - Verification Report`

The report must include: commands run, results, pass/fail status, unresolved failures, what could not be validated, and manual verification instructions where automation is missing. 
Never state “done” if verification is incomplete without clearly marking residual risk.

## Step 6 — Documentation and handoff package
Update or create the minimum necessary handoff documentation.

Where relevant, update: README, architecture notes, setup instructions, env documentation, migration notes, deployment notes, rollback notes, security notes, changelog.

**Output artifact:** `05 - Delivery Handoff`

The handoff must include: executive summary, technical summary, files changed, architectural decisions, validation evidence, known risks and limitations, deployment/rollback impact, and next recommended actions in priority order.

## Step 7 — Final release gate
Before concluding, perform a final gate. Ask:
- Is the scope completed?
- Is the implementation plan satisfied?
- Was verification actually executed?
- Are documentation and run instructions sufficient for handoff?
- Are there open security or reliability risks?
- Would a senior engineer be comfortable owning this in production?

If the answer is “no” to any of the above, do not present the work as production-ready.

## Step 8 — Communication standard for all outputs
Every meaningful response must distinguish:
- confirmed facts
- assumptions
- risks
- decisions made
- evidence of verification
- recommended next action

Do not pad. Do not hide uncertainty. Do not optimize for speed at the expense of delivery quality.
