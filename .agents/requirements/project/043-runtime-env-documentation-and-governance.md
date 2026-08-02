# 043 - Runtime Env Documentation and Governance

## Requirement

Runtime environment behavior must remain explicitly documented and aligned with implementation.

## Mandatory Documentation

Whenever runtime keys, startup adapters, or PM2 process orchestration change, the following must be updated in the same change scope:

- `README.md`
- `documentation/md/SETUP-RUNTIME-AND-API.md`
- `documentation/md/SERVICE-MANAGEMENT-APPLICATION.md`
- `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
- `servicemangement/README.md`

## Runtime Keys in Scope

- `JUMENTIX_HTTP_FRAMEWORK`
- `JUMENTIX_REALTIME_API`
- `JUMENTIX_REALTIME_API_PROTOCOL`
- `JUMENTIX_REALTIME_API_DATABASE_DRIVER`

## Governance Guardrails

- Docs must define:
  - supported values
  - defaults
  - impacted startup entrypoints
  - operational examples
- Service Management runtime env API must be described with request/response examples.
