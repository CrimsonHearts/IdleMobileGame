# Local game container. Serves the web game; the art generator (run inside or
# outside the container) talks to your NATIVE ComfyUI on the host for GPU speed.
FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "tools/static-server.mjs"]
