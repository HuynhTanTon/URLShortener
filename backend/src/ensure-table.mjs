// Chi dung khi chay LOCAL qua Docker (DynamoDB Local khong co san bang nhu
// AWS thuc te). Tren AWS, ban tao bang qua Console theo muc 3.1 tai lieu goc,
// nen ham nay se tu bo qua khi khong thay bien DYNAMODB_ENDPOINT.
import { DynamoDBClient, CreateTableCommand, waitUntilTableExists } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "url-shortener-links";

const clientConfig = {};
if (process.env.DYNAMODB_ENDPOINT) clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
if (process.env.AWS_REGION) clientConfig.region = process.env.AWS_REGION;

const client = new DynamoDBClient(clientConfig);

async function createTable() {
  await client.send(new CreateTableCommand({
    TableName: TABLE_NAME,
    AttributeDefinitions: [{ AttributeName: "shortCode", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "shortCode", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
  }));
  console.log(`Da tao bang "${TABLE_NAME}" tren DynamoDB Local.`);
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: TABLE_NAME });
}

export async function ensureTableExists({ retries = 15, delayMs = 2000 } = {}) {
  if (!process.env.DYNAMODB_ENDPOINT) {
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await createTable();
      return;
    } catch (err) {
      if (err.name === "ResourceInUseException") {
        console.log(`Bang "${TABLE_NAME}" da ton tai, bo qua.`);
        return;
      }
      if (attempt === retries) throw err;
      console.log(`DynamoDB Local chua san sang (lan ${attempt}/${retries}), thu lai sau ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
