
# 1) Build
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Runtime
FROM node:20-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=builder /usr/src/app .
EXPOSE 3000
CMD ["npm", "run", "start"]
