# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Set as environment variables for the build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app (Vite will embed the env vars)
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure all files are readable by nginx
RUN chmod -R 644 /usr/share/nginx/html/* 2>/dev/null || true && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \;

# Expose port (Cloud Run uses 8080)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
