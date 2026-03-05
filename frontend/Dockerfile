
FROM node:18-alpine




WORKDIR /app




COPY package.json package-lock.json* ./

RUN npm install




COPY . .




EXPOSE 5173




ENV NODE_ENV=development

CMD ["npm", "run", "dev"]

