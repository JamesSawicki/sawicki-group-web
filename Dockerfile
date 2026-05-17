# Use the official Node.js 20 image as the base
FROM node:22-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package files first — Docker caches layers, so copying
# package.json before the rest of the code means npm install
# only re-runs when dependencies actually change, not on every
# code change. This speeds up subsequent builds significantly.
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the Astro site
RUN npm run build

# Expose port 4321 — this is the port Astro's Node adapter listens on
EXPOSE 4321

# Set the host so the server accepts external connections
# By default Node servers only listen on localhost, which doesn't
# work inside a container. 0.0.0.0 means "accept from anywhere".
ENV HOST=0.0.0.0
ENV PORT=4321

# Start the server
CMD ["node", "./dist/server/entry.mjs"]