FROM node:20-alpine

WORKDIR /app

COPY package.json ./

# Ghi chu: mot so may co phan mem diet virus (VD: Avast) chan/giai ma SSL,
# khien "npm install" trong container bao loi UNABLE_TO_VERIFY_LEAF_SIGNATURE.
# Day CHI la workaround cho moi truong dev local qua Docker. Khong anh huong
# gi den viec deploy len AWS Lambda thuc te, vi Lambda runtime da tich hop
# san @aws-sdk/client-dynamodb va @aws-sdk/lib-dynamodb, khong can npm install.
RUN npm config set strict-ssl false && npm install --omit=dev

COPY src ./src
COPY local-server.mjs ./

EXPOSE 3000

CMD ["node", "local-server.mjs"]
