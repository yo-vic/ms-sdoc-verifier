FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS python-dependencies

WORKDIR /app

RUN apt-get update \
	&& apt-get install --no-install-recommends -y python3 python3-venv \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
	&& /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
	&& /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
	&& adduser --system --uid 1001 nextjs \
	&& apt-get update \
	&& apt-get install --no-install-recommends -y python3 \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=python-dependencies /opt/venv /opt/venv
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --chown=nextjs:nodejs *.py requirements.txt ./
COPY --chown=nextjs:nodejs inbox ./inbox
COPY --chown=nextjs:nodejs attachments ./attachments

USER nextjs

EXPOSE 3000
# Expose port for FastAPI 
EXPOSE 8000 

CMD ["npm", "run", "start"]
