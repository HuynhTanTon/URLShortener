# 🔗 URL Shortener — chạy local bằng Docker (trước khi deploy AWS thật)

Dự án triển khai theo kiến trúc trong `huong-dan-url-shortener-aws.md`: **S3 (frontend) + Lambda Function URL (backend) + DynamoDB**.

Để test toàn bộ luồng mà **không cần tài khoản AWS**, bộ này giả lập lại đúng 3 thành phần bằng Docker:

| Thành phần AWS thật | Giả lập local bằng Docker | Ghi chú |
|---|---|---|
| DynamoDB | `amazon/dynamodb-local` (image chính thức của AWS) | Chạy `-inMemory`, dữ liệu mất khi restart container |
| Lambda Function URL | Node.js HTTP server (`backend/local-server.mjs`) bọc quanh `backend/src/handler.mjs` | **`handler.mjs` là code Lambda thật 100%**, deploy lên AWS không cần sửa gì |
| S3 Static Website Hosting | Nginx (`nginx:alpine`) serve thư mục `frontend/` | `index.html` giống hệt file sẽ upload lên S3 |
| DynamoDB Console (xem dữ liệu) | `dynamodb-admin` (UI web) | Tiện xem item trong bảng khi test |

## Cấu trúc project

```
URLShortener/
├── backend/
│   ├── src/
│   │   ├── handler.mjs         ← Logic Lambda thật (dùng chung local + AWS)
│   │   └── ensure-table.mjs    ← Tự tạo bảng trên DynamoDB Local (chỉ chạy local)
│   ├── local-server.mjs        ← Adapter giả lập Lambda Function URL cho local
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── index.html              ← Giống file sẽ upload lên S3
│   ├── config.js                ← Đang trỏ về http://localhost:3000 (local)
│   └── config.aws.template.js  ← Template để sinh config.js khi deploy AWS thật
├── infra/
│   └── docker/
│       └── docker-compose.yml
└── huong-dan-url-shortener-aws.md   ← Tài liệu hướng dẫn gốc
```

## Cách chạy

```powershell
cd infra\docker
docker compose up -d --build
```

Sau khi các container chạy (`docker compose ps`), truy cập:

| Dịch vụ | URL |
|---|---|
| **Frontend** (trang rút gọn link) | http://localhost:8080 |
| **Backend** (giả lập Lambda Function URL) | http://localhost:3000 |
| **DynamoDB Admin** (xem bảng `url-shortener-links`) | http://localhost:8001 |
| DynamoDB Local (endpoint SDK) | http://localhost:8000 |

Mở **http://localhost:8080**, nhập 1 link dài, nhấn "Tạo link ngắn" — hệ thống hoạt động đúng như khi chạy trên AWS thật (tạo mã ngắn, lưu DynamoDB, redirect 302).

## Xem log / dừng / dọn dẹp

```powershell
docker compose logs -f backend      # xem log backend
docker compose down                 # dừng & xoá container (dữ liệu DynamoDB in-memory mất luôn)
```

## Lỗi SSL khi build (Avast / antivirus chặn HTTPS)

Nếu máy bạn có phần mềm diệt virus quét SSL (VD: Avast), `npm install` trong container backend có thể báo lỗi `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. `backend/Dockerfile` đã xử lý sẵn bằng `npm config set strict-ssl false` — đây **chỉ là workaround cho môi trường dev local**, không ảnh hưởng gì đến việc deploy lên AWS Lambda thật (Lambda runtime đã có sẵn `@aws-sdk/client-dynamodb` và `@aws-sdk/lib-dynamodb`, không cần `npm install`).

## Checklist kiểm thử (theo mục 6 tài liệu gốc)

| STT | Test case | Cách test |
|---|---|---|
| 1 | Tạo link ngắn hợp lệ | Nhập `https://www.google.com` → nhấn "Tạo link ngắn" → trả về `shortUrl` |
| 2 | Redirect đúng | Click vào link ngắn vừa tạo → chuyển hướng đúng tới link gốc |
| 3 | Link không tồn tại | Truy cập `http://localhost:3000/khongtontai` → 404 |
| 4 | Input rỗng | Nhấn "Tạo link ngắn" khi chưa nhập gì → validate ở frontend, không gọi API |
| 5 | Input không phải URL | Nhập `abc123` → backend trả 400 |
| 6 | CORS | Response có header `Access-Control-Allow-Origin: *` |
| 7 | Tạo nhiều link liên tiếp | Mã ngắn không trùng |
| 8 | Dữ liệu trong DynamoDB | Xem qua DynamoDB Admin (http://localhost:8001) |

## Bước tiếp theo: Deploy lên AWS thật

Khi đã test ổn trên Docker, deploy lên AWS thật theo đúng mục 3–5 của `huong-dan-url-shortener-aws.md`:
- `backend/src/handler.mjs` chính là code sẽ upload lên Lambda (paste trực tiếp vào `index.mjs` trên Console, không cần `node_modules` vì SDK đã có sẵn trong runtime).
- `frontend/index.html` + `frontend/config.aws.template.js` (copy thành `config.js`, thay `__LAMBDA_URL__` bằng Function URL thật) chính là 2 file upload lên S3.
