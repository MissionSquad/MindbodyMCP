# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build && npm prune --omit=dev

# Production stage
FROM node:20-alpine

# Install dumb-init for signal handling and curl for healthchecks
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --chown=nodejs:nodejs .env.example .env.example
COPY --chown=nodejs:nodejs CLAUDE.md CLAUDE.md

# Switch to non-root user
USER nodejs

# Expose SSE server port
EXPOSE 3000

# Health check for SSE server
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),5000); fetch('http://localhost:3000/sse',{headers:{Accept:'text/event-stream'},signal:controller.signal}).then((response)=>{clearTimeout(timeout); process.exit(response.ok?0:1)}).catch(()=>process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the MCP server - defaults to STDIO, but can be overridden
# For SSE: docker run -e MCP_TRANSPORT=sse image
# Or override: docker run image node dist/index.js --transport sse
CMD ["node", "dist/index.js"]
