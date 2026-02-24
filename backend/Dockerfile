# backend/Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (leverage Docker layer cache)
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Prisma client if schema exists (won't fail build if prisma isn't set up yet)
RUN npx prisma generate || true

# Expose backend port
EXPOSE 5000

# Default to development server command
ENV NODE_ENV=development
CMD ["npm", "run", "start"]
