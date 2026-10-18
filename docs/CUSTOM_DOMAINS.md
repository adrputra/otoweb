# Custom Domains

Status: implemented in Phase 14 (F014). Source of intent:
`docs/ROADMAP.md` §56 and `specs/013-custom-domains/`.

Custom domains let a showroom use its own hostname (for example
`showroom.example.com`) on the same deployment as its platform subdomain
(`prima.otoweb.id`). Registration, ownership verification, DNS instructions,
routing, and SSL provisioning are operator-managed from the platform console.
The platform subdomain always remains available as a fallback.

## Lifecycle

```text
register (platform operator)
  -> tenant_domains row: type=custom_domain, status=pending,
     verification_status=pending, ssl_status=none, stable token

DNS instructions
  -> TXT  _otoweb-verify.<hostname> = otoweb-verify=<token>
  -> CNAME <hostname> -> <CUSTOM_DOMAIN_CNAME_TARGET or TENANT_ROOT_DOMAIN>

verify (platform operator, repeatable)
  -> provider.verifyDns(...)
       pending/failed -> record verification state + last_checked_at
       verified       -> verified_at
  -> provider.provisionCertificate(...)
       active  -> ssl_status=active, status=active (routable)
       pending -> ssl_status=pending, status=pending (not routable)
       failed  -> ssl_status=failed,  status=pending (not routable)
```

A custom hostname is routable only when **all** of these are true:

- `tenant_domains.status = 'active'`;
- `verified_at` is set;
- `verification_status = 'verified'`;
- `ssl_status = 'active'`;
- the tenant is `active` or `trial`.

Every other combination fails closed. A pending or failed custom domain never
falls through to wildcard inference, and it never disables the tenant's
platform subdomain.

## Operator workflow

1. Open `/platform/tenants/<tenant-id>`.
2. Under **Domain kustom**, enter the showroom's full hostname and choose
   **Daftarkan domain**.
3. Copy the two DNS records shown in the domain row and give them to the
   showroom owner.
4. After DNS propagation, choose **Verifikasi DNS**.
5. Confirm **Terverifikasi** and **SSL aktif** before announcing the address.
6. The existing **Subdomain** control continues to manage the fallback address.

The platform tenant view shows each domain's type, verification state, SSL
state, last check, and instructions. Owners and staff never see this surface;
authorization is the same explicit `platform_admin` membership used by the rest
of the platform console.

## Validation and conflicts

- Hostnames are trimmed, lowercased, stripped of a numeric port and one trailing
  dot, and must be full DNS names (2+ labels, ≤253 characters).
- A hostname under the platform tenant root (for example `new.otoweb.id`) is
  rejected: those hosts are managed by the **Subdomain** control.
- A hostname already registered to any tenant is a conflict.
- Malformed input and conflicts leave the database unchanged.
- The verification token is stable for the life of the domain; retries reuse the
  same TXT instruction.

## Provider configuration

DNS verification and certificate provisioning go through the server-only
`DomainProvider` interface (`lib/domains/`). The provider contract is documented
in [`specs/013-custom-domains/contracts/domain-provider.md`](../specs/013-custom-domains/contracts/domain-provider.md).

| Variable | Scope | Behavior |
|---|---|---|
| `DOMAIN_PROVIDER` | server-only | `fake` or `http`; unset defaults to `fake` outside production and fails closed in production |
| `DOMAIN_PROVIDER_URL` | server-only | Base URL for the HTTP provisioning service |
| `DOMAIN_PROVIDER_TOKEN` | server-only | Bearer credential; never logged or exposed to the browser |
| `CUSTOM_DOMAIN_CNAME_TARGET` | server-only | CNAME target shown to operators; defaults to `TENANT_ROOT_DOMAIN` |

`scripts/validate-env.mjs` rejects `DOMAIN_PROVIDER=http` without both URL and
token, and rejects `DOMAIN_PROVIDER=fake` in production.

### Development and tests

The deterministic fake provider is the default outside production. It makes no
network calls and returns verified DNS plus an active certificate. Tests inject
pending/failed outcomes to prove fail-closed and retry behavior.

### Production

No DNS, CA, or hosting credentials exist in this repository. A deployment must
provide an adapter service that implements the documented HTTP contract and
configure the three server-only values above. Without them, verification and
certificate provisioning return a failed state with an operator-visible message;
the system never pretends a domain is verified.

The provider calls run outside the database transaction. The final write re-runs
the explicit platform-operator check inside a platform-scoped transaction.

## Routing

`findTenantByHostname` already resolves exact `tenant_domains` rows before
wildcard inference. F014 adds a custom-only guard: an exact custom row must also
be verified with an active certificate. The platform subdomain and
`<slug>.<TENANT_ROOT_DOMAIN>` wildcard path are independent, so a custom-domain
problem cannot take the showroom offline. See
[`SUBDOMAIN_ROUTING.md`](./SUBDOMAIN_ROUTING.md) and [`TENANCY.md`](./TENANCY.md).

## Verification

```bash
npx vitest run tests/unit/domains tests/unit/platform/domain-service.test.ts \
  tests/unit/platform/validation.test.ts tests/unit/tenant/hostname.test.ts \
  tests/unit/public/tenant-resolution.test.ts

npx playwright test --config playwright.platform.config.ts tests/e2e/custom-domains.spec.ts
npm run visual:qa:custom-domains
npx tsc --noEmit
npm test
```

The e2e spec registers and verifies a domain through the real platform UI, then
fetches the custom Host header and the platform subdomain from one server. The
visual script captures desktop 1440×900 and mobile 390×844 evidence under
`.visual-qa/`.

## Boundaries

- No production DNS/CA credential is committed.
- No showroom-owner self-service domain console.
- No domain transfer between tenants.
- No automatic record creation at a third-party registrar.
- The service-role key is not involved.
- Platform subdomain and wildcard routing behavior is not weakened.
- If a tenant isolation, platform authorization, or routing test fails, do not
  proceed.
