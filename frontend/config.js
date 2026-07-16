// Tai nguyen AWS cu da bi xoa, dang tro ve backend local (Docker) de dev/test.
// Khi tao lai Lambda Function URL moi tren AWS, doi LAMBDA_URL sang URL do
// truoc khi upload len S3/Amplify.
window.APP_CONFIG = {
  LAMBDA_URL: "http://localhost:3000",
};
