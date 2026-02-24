# frontend/Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose frontend port
EXPOSE 3000

# Use Next.js dev server by default for fast development with volumes
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]
