# Contract: Domain Provider

**Feature**: `013-custom-domains` | **Date**: 2026-10-19

## Interface

```ts
interface DomainProvider {
  verifyDns(input: DnsVerificationRequest): Promise<DnsVerificationResult>
  provisionCertificate(input: SslProvisioningRequest): Promise<SslProvisioningResult>
}

interface DnsVerificationRequest {
  hostname: string
  token: string
  recordName: string   // _otoweb-verify.<hostname>
  recordValue: string  // otoweb-verify=<token>
}

type DnsVerificationResult =
  | { status: 'verified'; message?: string }
  | { status: 'pending'; message?: string }
  | { status: 'failed'; message?: string }

interface SslProvisioningRequest {
  hostname: string
}

type SslProvisioningResult =
  | { status: 'active'; certificateId?: string; message?: string }
  | { status: 'pending'; message?: string }
  | { status: 'failed'; message?: string }
```

## Selection

| Variable | Scope | Required | Behavior |
|---|---|---|---|
| `DOMAIN_PROVIDER` | server-only | no | `fake` or `http`; unset = fake in development/test, fail-closed in production |
| `DOMAIN_PROVIDER_URL` | server-only | with `http` | Base URL of the DNS/SSL provisioning service |
| `DOMAIN_PROVIDER_TOKEN` | server-only | with `http` | Bearer credential; never logged or exposed |
| `CUSTOM_DOMAIN_CNAME_TARGET` | server-only | no | CNAME target; defaults to `TENANT_ROOT_DOMAIN` |

Environment validation rejects `DOMAIN_PROVIDER=http` without both URL and
token, and rejects `DOMAIN_PROVIDER=fake` in production.

## Fake provider

Deterministic, in-memory, no network. Default outcome is verified + active.
Tests may inject `dns` / `ssl` outcomes or per-host maps to exercise pending,
failure, and retry paths. It records call arguments for assertions.

## HTTP adapter

Configured service contract:

```text
POST <DOMAIN_PROVIDER_URL>/verify-dns
Authorization: Bearer <DOMAIN_PROVIDER_TOKEN>
Content-Type: application/json
{ "hostname": "...", "token": "...", "recordName": "...", "recordValue": "..." }

200 { "status": "verified" | "pending" | "failed", "message": "..." }

POST <DOMAIN_PROVIDER_URL>/certificates
Authorization: Bearer <DOMAIN_PROVIDER_TOKEN>
Content-Type: application/json
{ "hostname": "..." }

200 { "status": "active" | "pending" | "failed", "certificateId": "...", "message": "..." }
```

Non-2xx, malformed JSON, unknown status, or a 10-second timeout produces a
`failed` result with a safe message. The adapter never includes the token in a
response or log line.

## Fail-closed default

When `NODE_ENV=production` and no provider is configured, both operations return
`failed` with: "No domain provider is configured. Set DOMAIN_PROVIDER and its
server-only credentials before verifying custom domains." Registration and DNS
instructions still work; verification does not pretend to succeed.
