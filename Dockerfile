FROM node:24.21.0-bookworm-slim AS base
RUN npm install --global pnpm@11.19.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS api
RUN pnpm --filter api build
ENV NODE_ENV=production HOST=0.0.0.0
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start:prod"]

FROM base AS web-build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm --filter web build

FROM web-build AS web
ENV NODE_ENV=production
RUN chown -R node:node /app/apps/web/.next
USER node
EXPOSE 4000
CMD ["pnpm", "--filter", "web", "start", "--hostname", "0.0.0.0"]
