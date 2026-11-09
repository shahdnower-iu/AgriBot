FROM node:20-slim
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend ./backend
COPY frontend ./frontend
ENV PORT=7860
EXPOSE 7860
CMD ["node", "backend/server.js"]
