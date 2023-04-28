FROM node:16.14.0-slim as node-builder
WORKDIR /app
COPY . ./
RUN npm install
CMD ["/app/entrypoint.sh"]
