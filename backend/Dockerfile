FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/uploads/receipts /app/uploads/media /app/data

EXPOSE 3000

CMD ["npm", "start"]
