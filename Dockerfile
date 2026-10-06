FROM node:20-alpine

WORKDIR /app

# Install build dependencies for sharp and native libraries
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose web server port
EXPOSE 8081

# Environment
ENV NODE_ENV=production

# Start application server
CMD ["node", "server.js"]
