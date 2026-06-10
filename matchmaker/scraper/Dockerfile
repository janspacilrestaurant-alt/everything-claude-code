# Headless Chromium + Node 20. mcr.microsoft.com/playwright already ships
# the right Chromium build and OS deps — no apt-install dance required.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
