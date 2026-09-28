# Phiếu Phản Ánh — K4 Level 3A, Ngày 12

> **Bài làm cá nhân.** Trả lời bằng lời của chính bạn, dựa trên những gì bạn
> quan sát được khi chạy code — không sao chép đáp án của người khác.
>
> Cách trả lời: thay dòng placeholder bằng câu trả lời của chính bạn.
> `grade.py` đếm số câu đã trả lời (15 điểm cho 10 câu).
>
> Họ và tên: Đỗ Hoàng Nam Khánh  Mã học viên: 2A202602423

---

### Câu 1 — Fail fast (CP1)

Trong `Settings`, `agent_api_key` không có giá trị mặc định nên app chết ngay
khi khởi động nếu thiếu biến môi trường. Hãy mô tả một tình huống cụ thể mà
việc "chết sớm" này cứu bạn, so với việc để mặc định `"changeme"`.

> Tình huống: mình deploy lên Railway nhưng quên set `AGENT_API_KEY`. Nếu để mặc
> định `"changeme"`, container vẫn khởi động, `/health` xanh, và bất kỳ ai đoán
> ra giá trị mặc định đều gọi được `/ask` bằng khóa đó — mình chỉ phát hiện khi
> nhìn hóa đơn LLM tăng. Vì `agent_api_key` không có mặc định, lần deploy đó
> container chết ngay, log ghi `ValidationError: agent_api_key Field required`.
> Mình sửa trong vài giây, trước khi có bất kỳ traffic nào. "Chết sớm" đổi một
> sự cố âm thầm tốn tiền thành một lỗi hiện rõ trên màn hình ngay lúc mình còn
> đang nhìn.

---

### Câu 2 — Log cho máy đọc (CP1)

Chạy service và gọi `/ask` vài lần. Dán một dòng log JSON bạn thu được, rồi
nêu **hai** việc bạn làm được với dòng log đó mà `print("đã trả lời xong")`
không làm được.

> Dòng log mình thu được khi gọi `/ask`:
>
> ```json
> {"event": "ask_completed", "level": "info", "timestamp": "2026-09-28T09:52:52.181733+00:00", "user_id": "sv01", "tokens_in": 3, "tokens_out": 41, "cost_usd": 2.505e-05}
> ```
>
> Hai việc `print("đã trả lời xong")` không làm được:
> 1. Lọc/đếm theo trường: mình trích `user_id` để tính tổng `cost_usd` của từng
>    user, hoặc lọc `event="rate_limited"` để xem ai đang bị chặn.
> 2. Đặt cảnh báo tự động: theo dõi tổng `cost_usd` theo thời gian và báo động
>    khi vượt ngưỡng, hoặc đếm tỷ lệ lỗi trong 5 phút gần nhất. Log JSON một
>    dòng giúp máy parse trực tiếp; `print` chỉ có chuỗi tự do, không tách được
>    thành các trường để tính toán.

---

### Câu 3 — Kích thước image (CP2)

Build cả hai phiên bản và ghi lại số đo thật:

```bash
docker build -f <Dockerfile-1-stage> -t agent:single .
docker build -t agent:multi .
docker images | grep agent
```

| Bản | Dung lượng |
|-----|-----------|
| 1 stage (bản đầu) | ... MB |
| Multi-stage | ... MB |

Giải thích: phần dung lượng chênh lệch đó là những gì?

> | Bản | Dung lượng |
> |-----|-----------|
> | 1 stage (bản đầu) | 1.7 GB |
> | Multi-stage | 271 MB |
>
> Chênh lệch ~1.4 GB đến từ: base image `python:3.11` bản đầy đủ (kèm compiler,
> header, nhiều gói hệ thống) so với `python:3.11-slim`; và stage builder chứa
> toàn bộ compiler + build tool + cache của pip mà stage runtime không cần.
> Multi-stage vứt bỏ stage builder, chỉ copy thư viện đã cài từ
> `/install` sang runtime, nên image nhỏ hơn nhiều lần và deploy nhanh hơn.

---

### Câu 4 — Thứ tự lệnh trong Dockerfile (CP2)

Sửa một ký tự trong `app/main.py` rồi build lại. Với Dockerfile của bạn, những
layer nào được dùng lại từ cache, layer nào phải chạy lại? Nếu bạn đặt
`COPY . .` lên trước `RUN pip install` thì kết quả khác thế nào?

> Khi sửa một ký tự trong `app/main.py`, Docker hủy cache từ layer đầu tiên
> thay đổi trở đi. Với Dockerfile của mình, các layer `COPY requirements.txt`
> và `RUN pip install` vẫn được dùng lại từ cache (requirements không đổi), chỉ
> các layer `COPY app` và `COPY utils` phải chạy lại — build chỉ mất vài giây.
>
> Nếu đặt `COPY . .` lên trước `RUN pip install`, thì mỗi lần sửa code, layer
> `COPY . .` đổi → cache bị hủy → `RUN pip install` chạy lại từ đầu, cài toàn
> bộ thư viện cho mỗi lần build. Đảo thứ tự giúp thời gian build giảm từ hàng
> phút xuống vài giây.

---

### Câu 5 — Vì sao không chạy bằng root (CP2)

Container mặc định chạy bằng root. Mô tả chuỗi sự kiện dẫn từ "một lỗ hổng
trong code Python của bạn" tới "kẻ tấn công có quyền cao trên máy host", và
lệnh `USER` cắt đứt chuỗi đó ở chỗ nào.

> Chuỗi sự kiện: (1) code Python có lỗ hổng cho phép thực thi lệnh (RCE) →
> (2) kẻ tấn công chạy lệnh trong container với đúng quyền của tiến trình
> server → (3) nếu tiến trình chạy bằng root, kẻ tấn công có root trong
> container → (4) lợi dụng một lỗ hổng thoát container (kernel, mount, docker
> socket) để có quyền root trên máy host.
>
> Lệnh `USER appuser` cắt chuỗi ở bước (2)-(3): tiến trình chỉ chạy với uid
> 10001, nên dù bị RCE, kẻ tấn công chỉ có quyền của user thường trong
> container, không phải root. Điều này không chặn được RCE nhưng làm giảm mạnh
> đặc quyền, khiến việc leo thang ra host khó hơn rất nhiều.

---

### Câu 6 — Cửa sổ trượt (CP3)

Rate limit của bạn dùng sliding window 60 giây. Nếu thay bằng cách đếm theo
phút đồng hồ (reset lúc giây 00), một người dùng có thể gửi tối đa bao nhiêu
request trong 2 giây liên tiếp khi hạn mức là 10/phút? Giải thích cách đạt được
con số đó.

> Tối đa **20 request trong 2 giây** (với hạn mức 10/phút). Cách đạt: gửi 10
> request vào lúc 10:00:59 — tất cả rơi vào phút 10:00, nên đếm theo phút đồng
> hồ thấy 10/10, hợp lệ. Đồng hồ sang 10:01:00, bộ đếm phút reset về 0; gửi
> tiếp 10 request lúc 10:01:01 — lại 10/10 của phút 10:01, cũng hợp lệ. Tổng
> cộng 20 request trong ~2 giây mà mỗi phút đều "đúng luật". Sliding window
> chặn được vì nó đếm 60 giây gần nhất và vẫn thấy đủ 20 request đó.

---

### Câu 7 — Rate limit và cost guard (CP3)

Hai cơ chế này khác nhau ở điểm nào? Cho một tình huống mà rate limit cho qua
nhưng cost guard phải chặn, và một tình huống ngược lại.

> Khác nhau: rate limit giới hạn **số lượng** request trong một khoảng thời
> gian (10 request/phút), còn cost guard giới hạn **số tiền** tích lũy trong
> tháng (10 USD/tháng).
>
> - Rate cho qua nhưng cost guard chặn: user gửi 5 request/phút, mỗi request
>   cực lớn (50.000 token) — vẫn dưới hạn mức request/phút, nhưng tổng tiền đã
>   vượt ngân sách tháng → cost guard trả 402.
> - Cost cho qua nhưng rate chặn: user gửi 100 request cực nhỏ, mỗi request
>   tốn không đáng kể (tổng vài cent, còn xa ngân sách), nhưng gửi dồn dập
>   trong một phút → rate limit trả 429. Hai cơ chế bảo vệ hai khía cạnh khác
>   nhau nên cần cả hai.

---

### Câu 8 — /health khác /ready (CP4)

Nếu gộp hai endpoint làm một và cho nó kiểm tra Redis, chuyện gì xảy ra với cụm
3 container khi Redis mất kết nối 30 giây? Trả lời theo đúng thứ tự sự kiện.

> Thứ tự sự kiện khi gộp `/health` và `/ready` và cho nó kiểm tra Redis:
> (1) Redis mất kết nối trong 30 giây → (2) mỗi lần health check gọi Redis đều
> lỗi → (3) cả 3 container đồng loạt báo unhealthy → (4) orchestrator hiểu nhầm
> là container chết nên restart/schedule lại **cả 3 cùng lúc** → (5) trong lúc
> chúng khởi động lại, không còn instance nào phục vụ traffic → (6) khi Redis
> hồi phục thì service đang bận khởi động lại, người dùng thấy downtime.
>
> Một sự cố Redis ngắn biến thành sự cố toàn hệ thống. Tách riêng: `/health`
> chỉ hỏi "process còn sống không?" (không chạm Redis) nên không restart lung
> tung; `/ready` kiểm tra Redis và chỉ khiến load balancer tạm ngừng đẩy
> traffic, không restart.

---

### Câu 9 — Stateless (CP4)

Chạy `docker compose up --scale agent=3` rồi gọi `/ask` nhiều lần với cùng một
`X-User-Id`. Quan sát `history_length` trong response. Nếu lịch sử được lưu
trong một dict Python thay vì Redis, bạn sẽ thấy con số đó thay đổi thế nào?

> Với Redis, `history_length` tăng đều theo từng lượt hỏi (0, 2, 4, 6, ...)
> bất kể request rơi vào container nào, vì cả 3 instance cùng đọc chung một
> Redis.
>
> Nếu lịch sử nằm trong một dict Python trong RAM (mỗi process một dict), với
> 3 container, các request của cùng một user bị load balancer chia ngẫu nhiên
> vào các container khác nhau. Mỗi container chỉ thấy những message nó tự nhận,
> nên `history_length` nhảy loạn (ví dụ 0, 2, 0, 2, ...) thay vì tăng dần —
> agent như bị "mất trí nhớ" tùy lúc. Đó là lý do state phải nằm ngoài process.

---

### Câu 10 — Deploy thật (CP5)

Ghi lại **một** lỗi bạn gặp khi deploy lên cloud (build fail, health check
timeout, sai REDIS_URL, app không đọc `$PORT`...): thông báo lỗi là gì, bạn
tìm ra nguyên nhân bằng cách nào, và sửa ra sao?

> Lỗi mình gặp: `REDIS_URL` trỏ sai (chưa trỏ tới đúng service Redis). Biểu hiện
> quan sát được:
>
> - `GET /health` → **200** `{"status":"ok",...}` (vì cố tình không chạm Redis)
> - `GET /ready` → **503** `{"status":"not ready","redis":false}`
> - `POST /ask` với key đúng → **500 Internal Server Error** (vì
>   `store.get_history` không kết nối được Redis)
>
> Mình tái hiện đúng chuỗi lỗi này khi chạy container với
> `REDIS_URL=redis://127.0.0.1:1/0`. Cách tìm nguyên nhân: `/health` vẫn 200
> nhưng `/ready` báo `redis:false` → khoanh vùng ngay vào dependency Redis chứ
> không phải code app; đọc log container thì thấy lỗi kết nối Redis.
>
> Cách sửa: đặt lại `REDIS_URL` trỏ đúng service Redis (trên Railway là tham
> chiếu `${{ redis.REDIS_URL }}`), sau đó deploy lại. Kết quả: `/ready` trả 200
> `{"status":"ready","redis":true}` và `/ask` trả 200. Bài học: tách `/ready`
> khỏi `/health` chính là thứ giúp chẩn đoán nhanh lỗi dependency.
