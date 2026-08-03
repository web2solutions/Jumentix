# Spec Security and Compliance Practices

This specification defines mandatory security and compliance practices for Jumentix.

It is a binding Spec Development Driven artifact and applies to all apps/packages.

## 1) Security-by-Spec Principle

1. Security controls must be defined as specifications before implementation.
2. Any change impacting auth, secrets, data exposure, tenancy, or transport must update spec artifacts in the same delivery cycle.
3. Security controls are not optional best-effort tasks; they are release gates.

## 2) Identity, Access, and Tenancy

1. Domain models and domain security policies are the source of truth for RBAC and
   tenant scope; OpenAPI, adapters, fixtures, and documentation are derived contracts.
2. Protected resources require authenticated identity context.
3. Privileged operations require auditable authorization paths.
4. Superadmin/admin/user role behavior must stay aligned with domain and API contracts.
5. Tenant authorization decisions are defined by
   `TENANT-RBAC-AUTHORIZATION-CONTRACT.md`.

## 3) Sensitive Data and Secret Handling

1. Secrets (password/salt/token internals/secret keys) must never be exposed in service outputs.
2. DTO shaping/sanitization must be centralized and test-covered.
3. Environment secrets must be sourced from runtime configuration, never hardcoded.
4. Changelog, docs, and examples must not leak secrets.

## 4) Error Exposure Policy

1. `dev` and `staging`: internal error details may be exposed for diagnostics.
2. `production`: internal implementation details must be masked.
3. Error contracts must remain stable and documented.

## 5) Contract and Input Validation

1. HTTP handlers must validate requests against OpenAPI 3.1 contracts.
2. Realtime handlers must follow AsyncAPI/message contract expectations.
3. Domain models must enforce invariants independent of transport adapters.
4. Validation failures must produce contract-compliant responses.

## 6) Build, Dependency, and CI Security Gates

1. Lint/test/coverage gates are mandatory before merge.
2. Security scanners and compliance checks must be green for merge readiness.
3. Push/merge bypass patterns (`--no-verify`, fake tests) are prohibited by policy.
4. Node/runtime versions and package manager policies must remain enforced.

## 7) Auditability and Evidence

1. Security-sensitive changes must include evidence in PR:
   - tests
   - coverage impact
   - gate outputs
   - requirement IDs
2. Issue -> Project -> PR traceability is mandatory for compliance auditability.
3. Security runbook and remediation docs must stay synchronized with actual controls.

## 8) Primary References

1. `documentation/md/SECURITY-RUNBOOK-PCI.md`
2. `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
3. `documentation/md/TESTING-CI-AND-QUALITY.md`
4. `.agents/requirements/software/044-pci-security-compliance-hardening.md`
5. `.agents/requirements/project/065-commit-push-integrity-and-real-ci-enforcement.md`
