FROM node:18-slim

# Instalar dependências
RUN apt-get update && \
    apt-get install -y chromium

# Definir variáveis de ambiente necessárias para o Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD [ "npm", "start" ]
