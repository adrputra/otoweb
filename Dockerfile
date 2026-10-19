# Production image for the OtoWeb Next.js application.
#
# Build from the repository root:
#   docker build \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://otoweb.alatbantu.online \
#     --build-arg TENANT_ROOT_DOMAIN=alatbantu.online \
#     -t otoweb:latest .
#
# Runtime secrets (DATABASE_URL, Supabase keys, Cloudinary) are injected with
# an env file and are never baked into the image.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public values are inlined by Next at build time. They must match the runtime
# env file because client bundles cannot read server-only environment values.
ARG NEXT_PUBLIC_SITE_URL=https://otoweb.alatbantu.online
ARG NEXT_PUBLIC_SHOWROOM_SLUG=prima-auto-gallery
ARG TENANT_ROOT_DOMAIN=alatbantu.online
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_SHOWROOM_SLUG=${NEXT_PUBLIC_SHOWROOM_SLUG}
ENV TENANT_ROOT_DOMAIN=${TENANT_ROOT_DOMAIN}

RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The full dependency tree is kept so operational commands such as
# `pnpm db:migrate` and `pnpm db:seed` can run against the same image.
COPY --from=builder /app ./

EXPOSE 3000
CMD ["pnpm", "start"]
