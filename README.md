<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=0:0d9488,100:134e4a&text=URL%20Shortener&fontColor=ffffff&fontSize=48&animation=fadeIn&desc=Serverless%20on%20AWS%20%E2%80%A2%20S3%20%2B%20Lambda%20%2B%20DynamoDB&descAlignY=78&descSize=18" width="100%" alt="URL Shortener banner" />

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=20&duration=3000&pause=1000&color=0D9488&center=true&vCenter=true&width=600&lines=Serverless+URL+Shortener+on+AWS;S3+%2B+Lambda+Function+URL+%2B+DynamoDB;Region%3A+ap-southeast-1+(Singapore))](#)

[![AWS](https://img.shields.io/badge/AWS-Lambda%20%7C%20S3%20%7C%20DynamoDB-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Region](https://img.shields.io/badge/region-ap--southeast--1-0d9488)](#)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/local%20dev-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Last Commit](https://img.shields.io/github/last-commit/HuynhTanTon/URLShortener?color=0d9488&label=last%20commit)](https://github.com/HuynhTanTon/URLShortener/commits)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

<img src="frontend/forest-anime-bg.png" alt="preview background" width="480" />

### 🎬 [Xem video demo](docs/demo.mp4)

</div>

---

## 📚 Mục lục

- [Video demo](#-xem-video-demo)
- [Tổng quan](#-tổng-quan)
- [Kiến trúc](#-kiến-trúc)
- [Cấu trúc project](#-cấu-trúc-project)
- [Chạy local bằng Docker](#-chạy-local-bằng-docker)
- [Checklist kiểm thử](#-checklist-kiểm-thử)
- [Deploy lên AWS thật](#-deploy-lên-aws-thật)
- [Nâng cấp: đếm click + cảnh báo lỗi](#-nâng-cấp-đếm-lượt-click--cảnh-báo-lỗi-qua-cloudwatch)
- [Nâng cấp: custom short code + analytics mở rộng](#-nâng-cấp-custom-short-code--analytics-mở-rộng)
- [Nâng cấp: bảo mật & vận hành](#-nâng-cấp-bảo-mật--vận-hành)
- [Xử lý lỗi thường gặp](#-xử-lý-lỗi-thường-gặp)

---

## 🧭 Tổng quan

Dự án triển khai theo kiến trúc trong `huong-dan-url-shortener-aws.md`: **S3 (frontend) + Lambda Function URL (backend) + DynamoDB** — hoàn toàn serverless, không cần quản lý server.

Để test toàn bộ luồng mà **không cần tài khoản AWS**, repo này giả lập lại đúng 3 thành phần bằng Docker:

| Thành phần AWS thật | Giả lập local bằng Docker | Ghi chú |
|---|---|---|
| 🗄️ DynamoDB | `amazon/dynamodb-local` (image chính thức của AWS) | Chạy `-inMemory`, dữ liệu mất khi restart container |
| ⚡ Lambda Function URL | Node.js HTTP server (`backend/local-server.mjs`) bọc quanh `backend/src/handler.mjs` | **`handler.mjs` là code Lambda thật 100%**, deploy lên AWS không cần sửa gì |
| 🌐 S3 Static Website Hosting | Nginx (`nginx:alpine`) serve thư mục `frontend/` | `index.html` giống hệt file sẽ upload lên S3 |
| 🔍 DynamoDB Console | `dynamodb-admin` (UI web) | Tiện xem item trong bảng khi test |

> [!NOTE]
> `backend/src/handler.mjs` là code Lambda **deploy-được thẳng lên AWS Console, không cần sửa gì**. Mọi hack chỉ dành cho local (SSL, tự tạo bảng...) đều nằm riêng ở `local-server.mjs`, `ensure-table.mjs`, `Dockerfile`.

## 🏗️ Kiến trúc

> Sơ đồ dưới đây vẽ đúng phần **đã triển khai thật trong code** (kể cả 2 nâng cấp: đếm click + cảnh báo CloudWatch, và custom short code + analytics mở rộng). Các đề xuất của admin **chưa triển khai** (Amplify, DAX, multi-region, đăng nhập...) không được vẽ vào đây — xem bảng trạng thái ngay dưới sơ đồ.

```mermaid
flowchart LR
    U([👤 Người dùng]) -->|1. Mở trang, nhập link<br/>+ mã tuỳ chọn nếu muốn| S3[🌐 S3<br/>Static Website]
    S3 -->|2. POST /<br/>url + customCode?| L[⚡ Lambda<br/>Function URL]
    L -->|3. PutItem<br/>condition: not_exists| D[(🗄️ DynamoDB<br/>url-shortener-links)]
    U -->|4. GET /shortCode| L
    L -->|5. UpdateItem atomic<br/>clickCount + lastClickedAt| D
    L -->|6. 302 Redirect| U
    U -.->|7. GET /stats/shortCode| L
    L -.->|8. GetItem read-only| D
    L -->|9. console.error| CW[📋 CloudWatch Logs]
    CW -->|10. Metric filter pattern: ERROR| AL[🚨 CloudWatch Alarm]
    AL -->|11. Trigger khi ≥1 lỗi/5 phút| SNS[📧 SNS Topic]
    SNS -->|12. Gửi email| ADM([👤 Admin])
```

1. Người dùng mở trang web tĩnh trên **S3**, nhập link dài và **tuỳ chọn** một mã ngắn riêng (*custom short code*).
2. Trang gọi `POST /` tới **Lambda Function URL** — nếu có `customCode` hợp lệ và chưa ai dùng thì lưu đúng mã đó, ngược lại Lambda tự sinh mã random 6 ký tự; ghi vào **DynamoDB** bằng `PutItem` có điều kiện chống trùng.
3. Khi ai truy cập `shortUrl`, Lambda `UpdateItem` **atomic** để tăng `clickCount` và cập nhật `lastClickedAt`, rồi trả **HTTP 302** redirect tới link gốc.
4. `GET /stats/{shortCode}` đọc số liệu (link gốc, `clickCount`, `createdAt`, `lastClickedAt`) mà không tăng đếm.
5. Mọi lỗi được log dạng `console.error("[ERROR]", ...)` → **CloudWatch Logs Metric Filter** bắt log này → **CloudWatch Alarm** kích hoạt khi ≥ 1 lỗi/5 phút → **SNS Topic** gửi email cảnh báo cho admin.

### 📋 Đối chiếu với nhận xét của admin

| Đề xuất | Trạng thái | Ghi chú |
|---|---|---|
| Custom short code | ✅ Đã làm | `POST /` nhận `customCode`, validate + chống trùng (409) |
| Analytics (đếm click, thời điểm) | ✅ Đã làm | `clickCount`, `createdAt`, `lastClickedAt` qua `GET /stats/{shortCode}` |
| Cảnh báo lỗi (Operational Excellence) | ✅ Đã làm | CloudWatch Metric Filter + Alarm + SNS email |
| Migrate S3 → AWS Amplify | ⏳ Chưa làm | Vẫn đang dùng S3 Static Website Hosting |
| DAX caching cho DynamoDB | ⏳ Chưa làm | Đề xuất tối ưu chi phí, chưa triển khai |
| Multi-region / Disaster Recovery | ⏳ Chưa làm | Cần nghiên cứu thêm, chưa triển khai |
| Đăng ký / đăng nhập | ⏳ Chưa làm | Chưa nằm trong phạm vi hiện tại |

## 📁 Cấu trúc project

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

## 🚀 Chạy local bằng Docker

```powershell
cd infra\docker
docker compose up -d --build
```

Sau khi các container chạy (`docker compose ps`), truy cập:

| Dịch vụ | URL |
|---|---|
| 🌐 **Frontend** (trang rút gọn link) | http://localhost:8080 |
| ⚡ **Backend** (giả lập Lambda Function URL) | http://localhost:3000 |
| 🔍 **DynamoDB Admin** (xem bảng `url-shortener-links`) | http://localhost:8001 |
| 🗄️ DynamoDB Local (endpoint SDK) | http://localhost:8000 |

Mở **http://localhost:8080**, nhập 1 link dài, nhấn "Tạo link ngắn" — hệ thống hoạt động đúng như khi chạy trên AWS thật (tạo mã ngắn, lưu DynamoDB, redirect 302).

> [!TIP]
> Luôn test đủ trên Docker local **trước**, chỉ deploy lên AWS thật sau khi mọi thứ đã chạy đúng — đỡ tốn phí và dễ debug hơn nhiều.

<details>
<summary>📋 Xem log / dừng / dọn dẹp</summary>

```powershell
docker compose logs -f backend      # xem log backend
docker compose down                 # dừng & xoá container (dữ liệu DynamoDB in-memory mất luôn)
```

</details>

## ✅ Checklist kiểm thử

<details>
<summary>Xem đầy đủ 13 test case (8 test case gốc theo mục 6 tài liệu + 4 test case custom code/analytics + 1 test case TTL)</summary>

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
| 9 | Tạo custom short code hợp lệ | Nhấn "+ Đặt mã tuỳ chỉnh", nhập `khuyen-mai-2026` → tạo thành công với đúng mã đó |
| 10 | Custom code bị trùng | Tạo lại đúng mã vừa dùng ở trên → backend trả **409** |
| 11 | Custom code sai định dạng / trùng từ khoá | Nhập `a!` hoặc `stats` → backend trả **400** |
| 12 | Xem số liệu (`/stats`) | Sau khi tạo link, nhấn "Xem số liệu" → hiện đúng `clickCount`, `createdAt`, `lastClickedAt` |
| 13 | TTL tự động | Tạo link mới → `GET /stats/{shortCode}` phải trả `expiresAt` ≈ `createdAt` + 90 ngày |

</details>

## ☁️ Deploy lên AWS thật

Khi đã test ổn trên Docker, deploy lên AWS thật theo đúng mục 3–5 của `huong-dan-url-shortener-aws.md`:

- `backend/src/handler.mjs` chính là code sẽ upload lên Lambda (paste trực tiếp vào `index.mjs` trên Console, không cần `node_modules` vì SDK đã có sẵn trong runtime).
- `frontend/index.html` + `frontend/config.aws.template.js` (copy thành `config.js`, thay `__LAMBDA_URL__` bằng Function URL thật) chính là 2 file upload lên S3.

> [!IMPORTANT]
> Region bắt buộc là **`ap-southeast-1` (Singapore)** cho cả S3, Lambda, DynamoDB — không đổi trừ khi có lý do kỹ thuật rõ ràng và đã xác nhận với người phụ trách.

## 📈 Nâng cấp: đếm lượt click & cảnh báo lỗi qua CloudWatch

### 🖱️ Đếm lượt click (`clickCount`)

Luồng redirect (`GET /{shortCode}`) dùng `UpdateCommand` để tăng `clickCount` **atomic** (an toàn khi nhiều người click cùng lúc), kèm `ConditionExpression: attribute_exists(shortCode)` để vẫn trả 404 đúng khi mã không tồn tại (nếu thiếu điều kiện này, `UpdateItem` sẽ tự tạo item mới thay vì báo lỗi).

Thêm endpoint mới **`GET /stats/{shortCode}`** (không tăng click count, chỉ đọc):

```json
{ "shortCode": "aZ3kT9", "originalUrl": "https://...", "clickCount": 5, "createdAt": "...", "lastClickedAt": "...", "expiresAt": "..." }
```

<details>
<summary>🔑 Cần cập nhật IAM policy trên AWS thật</summary>

Thêm quyền `dynamodb:UpdateItem` (mục 3.2 tài liệu gốc hiện chỉ có `PutItem`, `GetItem`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowDynamoDBAccessToShortenerTable",
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:ap-southeast-1:<ACCOUNT_ID>:table/url-shortener-links"
    }
  ]
}
```

</details>

### 🚨 Cảnh báo lỗi qua CloudWatch

`handler.mjs` luôn `catch` lỗi và trả JSON 500 thay vì throw ra ngoài, nên metric có sẵn `Lambda > Errors` sẽ luôn = 0. Code đã chuẩn hoá log lỗi thành `console.error("[ERROR]", err)` để dùng **CloudWatch Logs Metric Filter** (đọc log, không phụ thuộc Lambda có throw hay không).

Các bước làm trên AWS Console (không có trong code, phải tự làm):

1. **CloudWatch → Log groups → `/aws/lambda/url-shortener-backend` → Metric filters → Create metric filter**
   - Filter pattern: `"[ERROR]"`
   - Đặt tên metric: `URLShortenerErrorCount`
2. **CloudWatch → Alarms → Create alarm** trên metric `URLShortenerErrorCount`
   - Ngưỡng: **≥ 1 lỗi trong 5 phút**
3. Tạo **SNS topic** mới, subscribe email nhận cảnh báo → xác nhận subscription qua email đã nhận được.

## 🔗 Nâng cấp: Custom short code + analytics mở rộng

### ✍️ Custom short code

`POST /` nhận thêm field tuỳ chọn `customCode` trong body:

```json
{ "url": "https://example.com/khuyen-mai", "customCode": "khuyen-mai-2026" }
```

- **Định dạng hợp lệ**: 3–20 ký tự, chỉ gồm chữ, số, `-`, `_` (regex `^[A-Za-z0-9_-]{3,20}$`).
- **Từ khoá bị chặn**: `stats` (trùng với route nội bộ `GET /stats/{shortCode}`).
- **Chống trùng mã**: dùng `PutCommand` kèm `ConditionExpression: attribute_not_exists(shortCode)` — nếu mã đã tồn tại, trả về **HTTP 409** `{ "error": "Mã này đã được sử dụng, vui lòng chọn mã khác." }`.
- Nếu không truyền `customCode`, hệ thống vẫn sinh mã ngẫu nhiên 6 ký tự như cũ (có thêm cơ chế thử lại tối đa 5 lần nếu trùng mã — xác suất cực thấp nhưng vẫn xử lý an toàn).
- Frontend (`frontend/index.html`) có nút **"+ Đặt mã tuỳ chỉnh (tuỳ chọn)"** để hiện ô nhập, không bắt buộc điền.

### 📊 Analytics mở rộng (`lastClickedAt`)

Ngoài `clickCount`, mỗi lần redirect giờ cũng cập nhật `lastClickedAt` (timestamp ISO) trong cùng một `UpdateCommand` atomic — không tốn thêm request tới DynamoDB. Endpoint `GET /stats/{shortCode}` trả về đầy đủ `clickCount`, `createdAt`, `lastClickedAt`. Frontend có nút **"Xem số liệu"** ngay sau khi tạo link để xem nhanh mà không cần gọi API thủ công.

> [!NOTE]
> Không cần thêm quyền IAM mới cho 2 tính năng này — vẫn dùng đúng 3 action đã cấp ở trên (`PutItem`, `GetItem`, `UpdateItem`).

## 🛡️ Nâng cấp: Bảo mật & vận hành

Sau khi được admin review kiến trúc, đây là 4 điểm được ưu tiên xử lý (nhóm rẻ/miễn phí, phù hợp Free Tier). Các điểm còn lại trong review (VPC Endpoint, tách nhiều Lambda, WAF, PITR...) được đánh giá **không phù hợp quy mô/mục tiêu Free Tier** của project này — xem giải thích chi tiết trong lịch sử trao đổi, không áp dụng ở đây.

### ⏳ TTL tự động xoá link cũ (90 ngày)

Mỗi link khi tạo (`handler.mjs`) được ghi thêm attribute `expiresAt` = thời điểm tạo + 90 ngày (epoch giây — đúng định dạng DynamoDB TTL yêu cầu). Có thể đổi số ngày qua biến môi trường `TTL_DAYS`.

> [!IMPORTANT]
> Code chỉ **ghi sẵn** attribute `expiresAt`. Muốn DynamoDB **thật sự tự xoá** item quá hạn, phải bật TTL trên bảng AWS thật:
> **DynamoDB Console → chọn bảng `url-shortener-links` → tab "Additional settings" → Time to Live (TTL) → Enable → attribute name: `expiresAt`**
>
> `backend/src/ensure-table.mjs` đã tự bật TTL này trên DynamoDB Local mỗi khi khởi động (chỉ để code giống AWS thật nhất — DynamoDB Local **không** có cơ chế tự xoá nền như AWS thật, item quá hạn vẫn nằm trong bảng khi chạy local).

### 🚦 Rate limiting bằng Reserved Concurrency

Lambda Function URL không có rate limit theo IP/user mặc định — ai đó có thể spam tạo hàng nghìn link, tốn tiền và làm quá tải DynamoDB. Cách rẻ nhất để chặn là giới hạn số lần Lambda được chạy đồng thời:

**Lambda Console → chọn function `url-shortener-backend` → tab "Configuration" → "Concurrency" → Reserved concurrency → đặt `5`**

> [!NOTE]
> Đặt `5` nghĩa là tối đa 5 request được xử lý cùng lúc — đủ cho demo/test, request thứ 6 trở lên (nếu bị spam) sẽ bị Lambda từ chối ngay (lỗi `429 TooManyRequestsException`) thay vì tính phí + ghi đè DynamoDB liên tục. Có thể tăng dần khi có traffic thật.

### 🔔 Bổ sung CloudWatch Alarm cho Timeout & Throttles

Ngoài alarm lỗi `[ERROR]` đã có, nên thêm 2 alarm theo dõi metric có sẵn của Lambda (không cần code, không tốn thêm phí trong giới hạn Free Tier 10 alarm/tháng):

1. **CloudWatch → Alarms → Create alarm**
   - Metric: `Lambda → By Function Name → Duration` (chọn function `url-shortener-backend`) → Statistic `Maximum` → ngưỡng gần bằng Timeout đã cấu hình (VD: nếu Timeout Lambda = 10s, đặt ngưỡng ≥ 9000ms) → cảnh báo khi Lambda gần hết thời gian chạy.
   - Metric: `Lambda → By Function Name → Throttles` → ngưỡng **≥ 1 trong 5 phút** → cảnh báo khi Lambda bị giới hạn concurrency (đúng lúc Reserved Concurrency ở trên phát huy tác dụng chặn spam).
2. Gắn cả 2 alarm vào **SNS topic** đã tạo ở mục cảnh báo lỗi phía trên (không cần tạo topic mới).

### 🔒 Siết lại CORS (không dùng `*` cho production)

Cấu hình CORS hiện tại (`Allow origin: *`) chỉ nên dùng khi test. Khi đã có domain frontend thật (S3 website URL hoặc domain Amplify), sửa lại:

**Lambda Console → chọn function → tab "Configuration" → "Function URL" → Edit → CORS → Allow origin: chỉ nhập đúng domain frontend (VD: `http://url-shortener-frontend-xxx.s3-website-ap-southeast-1.amazonaws.com`), bỏ `*`**

> [!NOTE]
> Nếu vẫn cần test local song song, thêm cả `http://localhost:8080` vào danh sách Allow origin (Function URL cho phép nhiều origin, không cần dùng `*`).

## 🛠️ Xử lý lỗi thường gặp

> [!WARNING]
> Nếu máy bạn có phần mềm diệt virus quét SSL (VD: Avast), `npm install` trong container backend có thể báo lỗi `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. `backend/Dockerfile` đã xử lý sẵn bằng `npm config set strict-ssl false` — đây **chỉ là workaround cho môi trường dev local**, không ảnh hưởng gì đến việc deploy lên AWS Lambda thật (Lambda runtime đã có sẵn `@aws-sdk/client-dynamodb` và `@aws-sdk/lib-dynamodb`, không cần `npm install`).

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=120&color=0:134e4a,100:0d9488&section=footer&animation=fadeIn" width="100%" alt="footer" />

Made with ☕ and 🔗 — chạy thử local trước, deploy AWS sau.

</div>
