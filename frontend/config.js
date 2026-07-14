// Cau hinh cho moi truong LOCAL (Docker). Khi deploy AWS thuc te, thay file
// nay bang ban sinh ra tu config.aws.template.js (thay __LAMBDA_URL__ bang
// Function URL thuc te) roi upload len S3 cung index.html.
window.APP_CONFIG = {
  LAMBDA_URL: "http://localhost:3000",
};
