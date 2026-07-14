// Dang tro ve Lambda Function URL thuc te tren AWS (khong con dung backend
// local nua). Neu muon quay lai test voi backend local (Docker), doi
// LAMBDA_URL ve "http://localhost:3000".
window.APP_CONFIG = {
  LAMBDA_URL: "https://wkrzvdek3oopk3vgurrwg4nsci0rtxtx.lambda-url.ap-southeast-1.on.aws",
};
