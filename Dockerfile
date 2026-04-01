FROM alpine:3.20

# Update packages and install runtime dependencies
RUN apk update && \
    # Install runtime dependencies (permanent)
    apk add --no-cache libstdc++ ca-certificates && \
    # Install temporary build dependencies (will be removed later)
    apk add --no-cache --virtual .build-deps curl && \
    # Clean up the apk cache to reduce image size
    rm -rf /var/cache/apk/*

# Define the specific Node.js version to install (e.g., 20.10.0)
ENV NODE_VERSION=20.10.0
 
# Download, verify, and install Node.js
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-alpine-linux-x64.tar.gz" -o node.tar.gz && \
    # Optional: Verify the SHA256 checksum of the tarball
    echo "Verifying Node.js tarball checksum..." && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" | grep "node-v${NODE_VERSION}-alpine-linux-x64.tar.gz" | sha256sum -c - && \
    # Extract the tarball to /usr/local (binaries will be in /usr/local/bin)
    tar -xzf node.tar.gz -C /usr/local --strip-components=1 && \
    # Remove the tarball to save space
    rm node.tar.gz && \
    # Remove temporary build dependencies (e.g., curl)
    apk del .build-deps

# Verify Node.js and NPM installation
RUN echo "Node.js version: $(node --version)" && \
    echo "NPM version: $(npm --version)"

WORKDIR /srv
RUN echo '{}' > config.json
RUN echo '{}' > passwords.json
RUN mkdir -p /srv/data /srv/keys
RUN adduser -D privsync
USER privsync
VOLUME [ "/srv/data" ]