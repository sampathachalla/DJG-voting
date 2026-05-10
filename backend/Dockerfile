FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/

RUN cd backend && npm install

COPY backend ./backend

RUN cd backend && npm run build

WORKDIR /app/backend

ENV NODE_ENV=production
EXPOSE 8081

CMD ["npm", "run", "start"]
