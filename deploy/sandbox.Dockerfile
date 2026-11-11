# Image for one preview sandbox: a generated project runs here.
#
#   docker build -t webai-sandbox:latest -f deploy/sandbox.Dockerfile .
#
# The project itself is bind-mounted at /app at run time, so the image only
# carries the runtime and its dependencies.
FROM node:22-bookworm-slim

WORKDIR /opt

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server --include-workspace-root \
 && npm cache clean --force

# react / react-dom / vite are needed by the preview runtime.
RUN npm install --no-save --prefix /opt react@^18.3.1 react-dom@^18.3.1 vite@^6.0.5

COPY server/src/sandbox /sandbox

ENV SANDBOX_DIR=/app SANDBOX_PORT=5173 SANDBOX_ROOT=/opt
EXPOSE 5173

CMD ["node", "/sandbox/runtime.js"]
