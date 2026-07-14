// index.mjs / handler.mjs — Logic Lambda thuc te.
// Deploy nguyen file nay len AWS Lambda (mục 3.4 huong-dan-url-shortener-aws.md)
// khong can sua gi ca — @aws-sdk da co san trong Lambda Node.js runtime.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const TABLE_NAME = process.env.TABLE_NAME || "url-shortener-links";

// DYNAMODB_ENDPOINT chi duoc set khi chay local (tro ve DynamoDB Local).
// Tren AWS thuc te, bien nay khong ton tai nen SDK tu dong dung DynamoDB vung that.
const clientConfig = {};
if (process.env.DYNAMODB_ENDPOINT) clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
if (process.env.AWS_REGION) clientConfig.region = process.env.AWS_REGION;

const client = new DynamoDBClient(clientConfig);
const ddb = DynamoDBDocumentClient.from(client);

// Sinh ma ngan ngau nhien 6 ky tu (chu + so)
function generateShortCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || "GET";
  const path = event.rawPath || "/";

  // ----- LUONG 1: TAO LINK NGAN (POST /) -----
  if (method === "POST" && path === "/") {
    try {
      const body = JSON.parse(event.body || "{}");
      const originalUrl = body.url;

      if (!originalUrl || !isValidUrl(originalUrl)) {
        return jsonResponse(400, { error: "Link không hợp lệ. Vui lòng nhập link bắt đầu bằng http:// hoặc https://" });
      }

      const shortCode = generateShortCode(6);

      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          shortCode,
          originalUrl,
          createdAt: new Date().toISOString(),
        },
      }));

      const host = event.headers?.host || event.headers?.Host || "your-lambda-url.lambda-url.region.on.aws";
      const protocol = event.headers?.["x-forwarded-proto"] || "https";
      const shortUrl = `${protocol}://${host}/${shortCode}`;

      return jsonResponse(200, { shortCode, shortUrl, originalUrl });
    } catch (err) {
      console.error("[ERROR]", err);
      return jsonResponse(500, { error: "Lỗi server khi tạo link ngắn." });
    }
  }

  // ----- LUONG 3: XEM SO LIEU (GET /stats/{shortCode}) - khong tang clickCount -----
  if (method === "GET" && path.startsWith("/stats/")) {
    const shortCode = path.replace("/stats/", "");

    try {
      const result = await ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { shortCode },
      }));

      if (!result.Item) {
        return jsonResponse(404, { error: "Link không tồn tại hoặc đã bị xoá." });
      }

      return jsonResponse(200, {
        shortCode,
        originalUrl: result.Item.originalUrl,
        clickCount: result.Item.clickCount || 0,
        createdAt: result.Item.createdAt,
      });
    } catch (err) {
      console.error("[ERROR]", err);
      return jsonResponse(500, { error: "Lỗi server khi lấy số liệu." });
    }
  }

  // ----- LUONG 2: REDIRECT (GET /{shortCode}) - tang clickCount atomic -----
  if (method === "GET" && path !== "/") {
    const shortCode = path.replace("/", "");

    try {
      const result = await ddb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { shortCode },
        UpdateExpression: "SET clickCount = if_not_exists(clickCount, :zero) + :inc",
        ConditionExpression: "attribute_exists(shortCode)",
        ExpressionAttributeValues: { ":zero": 0, ":inc": 1 },
        ReturnValues: "ALL_NEW",
      }));

      return {
        statusCode: 302,
        headers: {
          Location: result.Attributes.originalUrl,
        },
        body: "",
      };
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        return jsonResponse(404, { error: "Link không tồn tại hoặc đã bị xoá." });
      }
      console.error("[ERROR]", err);
      return jsonResponse(500, { error: "Lỗi server khi tra cứu link." });
    }
  }

  return jsonResponse(404, { error: "Route không tồn tại." });
};

function jsonResponse(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyObj),
  };
}
