# Aliyun Backend Deployment Roadmap

## Target

Deploy FlowChain backend APIs on Aliyun with managed persistence, controlled secrets, observability, and a clear path away from local JSON persistence.

## Phase 1: API Stabilization

- Keep Node HTTP service packaging simple.
- Freeze read/write route boundaries.
- Add route smoke tests for procurement, inventory, search, and AI deterministic branches.
- Remove assumptions that seed JSON is the only source of truth.

## Phase 2: Persistence

- Introduce a repository interface for read and write commands.
- Add database migrations for supplier, item, PR, RFQ, PO, GRN, invoice, inventory movement, audit, and AI event tables.
- Backfill from current JSON seed data into managed database tables.
- Keep JSON seed import as a development-only bootstrap path.

## Phase 3: Runtime Deployment

- Run the API service in ECS or ACK depending on operational preference.
- Use RDS for transactional data.
- Use OSS for exports and attachments when document files are introduced.
- Use KMS/Secrets Manager for provider keys and database credentials.
- Put SLB/API Gateway in front of the Node service.

## Phase 4: Observability And Operations

- Add structured request logs with route, method, status, elapsed time, and request ID.
- Add AI chat elapsed logs without provider or model details in customer UI.
- Add database slow-query logging and audit event dashboards.
- Add health checks for API, database, and optional external signal fetches.

## Phase 5: Release Controls

- Separate development, staging, and production configuration.
- Run typecheck, test, build, migration dry-run, and smoke tests before release.
- Keep destructive data operations behind explicit admin scripts and backups.
