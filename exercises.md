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

> Ví dụ, nếu mình quên đặt `AGENT_API_KEY` khi deploy thì app sẽ báo lỗi cấu hình
> ngay lúc khởi động. Như vậy mình biết cần sửa biến môi trường trước khi dùng
> app. Nếu có giá trị mặc định như `"changeme"`, app vẫn có thể chạy và mình dễ
> không nhận ra là khóa chưa được cấu hình đúng. Với mình, lợi ích của fail fast
> là lỗi hiện ra sớm và rõ hơn.

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
> Hai việc mình có thể làm với log JSON này là:
> 1. Lọc các dòng theo `user_id` hoặc `event`, rồi đếm số lần gọi hay cộng
>    `cost_usd` cho từng user.
> 2. Đưa các trường như `level` và `timestamp` vào công cụ log để tìm lỗi theo
>    thời gian hoặc đặt cảnh báo. Câu `print("đã trả lời xong")` chỉ cho biết có
>    một dòng chữ được in ra, không có các trường riêng để lọc và tính toán.

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
> Hai lần build mình ghi được là 1.7 GB và 271 MB, lệch khoảng 1.4 GB. Bản đầu
> mang theo nhiều thành phần hơn cần thiết để chạy app. Ở bản multi-stage,
> dependency được cài ở builder; image cuối dùng `python:3.11-slim` và chỉ nhận
> các thư viện từ `/install` cùng thư mục `app` và `utils`. Vì vậy image chạy
> không phải mang cả môi trường build.

---

### Câu 4 — Thứ tự lệnh trong Dockerfile (CP2)

Sửa một ký tự trong `app/main.py` rồi build lại. Với Dockerfile của bạn, những
layer nào được dùng lại từ cache, layer nào phải chạy lại? Nếu bạn đặt
`COPY . .` lên trước `RUN pip install` thì kết quả khác thế nào?

> Khi chỉ sửa `app/main.py`, các bước cài package vẫn có thể lấy từ cache vì
> `requirements.txt` không đổi. Các bước copy source app chạy lại để đưa code
> mới vào image. Nếu `COPY . .` nằm trước `RUN pip install`, thay đổi một file
> bất kỳ cũng làm layer copy đổi; khi đó bước cài package phía sau có thể phải
> chạy lại. Tách bước copy requirements ra trước giúp Docker giữ cache cài đặt
> khi mình chỉ sửa code.

---

### Câu 5 — Vì sao không chạy bằng root (CP2)

Container mặc định chạy bằng root. Mô tả chuỗi sự kiện dẫn từ "một lỗ hổng
trong code Python của bạn" tới "kẻ tấn công có quyền cao trên máy host", và
lệnh `USER` cắt đứt chuỗi đó ở chỗ nào.

> Nếu app có lỗ hổng cho phép chạy lệnh, kẻ tấn công có thể chạy lệnh với quyền
> của process trong container. Nếu process là root thì họ có quyền root bên
> trong container; sau đó họ còn có thể tìm cách khai thác lỗi cấu hình hoặc
> lỗ hổng khác để thoát container và ảnh hưởng máy host. `USER appuser` làm cho
> process chỉ có quyền user thường ngay từ đầu. Nó không sửa được lỗ hổng RCE,
> nhưng giới hạn quyền mà kẻ tấn công có được.

---

### Câu 6 — Cửa sổ trượt (CP3)

Rate limit của bạn dùng sliding window 60 giây. Nếu thay bằng cách đếm theo
phút đồng hồ (reset lúc giây 00), một người dùng có thể gửi tối đa bao nhiêu
request trong 2 giây liên tiếp khi hạn mức là 10/phút? Giải thích cách đạt được
con số đó.

> Có thể gửi 20 request trong khoảng hai giây: gửi 10 request ngay trước phút
> mới, rồi gửi thêm 10 ngay sau khi đồng hồ chuyển phút. Bộ đếm theo phút lịch
> vừa reset nên cả hai nhóm đều được tính vào hai phút khác nhau. Với sliding
> window, 20 request vẫn nằm trong cùng khoảng 60 giây, nên nhóm thứ hai sẽ bị
> chặn khi đã đủ hạn mức.

---

### Câu 7 — Rate limit và cost guard (CP3)

Hai cơ chế này khác nhau ở điểm nào? Cho một tình huống mà rate limit cho qua
nhưng cost guard phải chặn, và một tình huống ngược lại.

> Rate limit đếm số request trong một khoảng thời gian; cost guard theo dõi tiền
> đã dùng so với ngân sách. Ví dụ, nếu một request xử lý nhiều token thì số
> request vẫn có thể dưới hạn mức nhưng chi phí đã chạm ngân sách, khi đó cost
> guard phải chặn. Ngược lại, nhiều request nhỏ có thể chưa tốn bao nhiêu nhưng
> vẫn vượt số request cho phép trong một phút, nên rate limit chặn trước.

---

### Câu 8 — /health khác /ready (CP4)

Nếu gộp hai endpoint làm một và cho nó kiểm tra Redis, chuyện gì xảy ra với cụm
3 container khi Redis mất kết nối 30 giây? Trả lời theo đúng thứ tự sự kiện.

> Redis mất kết nối thì endpoint gộp sẽ trả lỗi dù process trong cả ba
> container vẫn còn chạy. Nếu nền tảng dùng kết quả đó làm liveness check, nó
> có thể restart các container đang khỏe; nếu việc restart chồng lên nhau thì
> tạm thời không còn instance nhận traffic. Khi tách endpoint, `/health` kiểm
> tra process còn sống, còn `/ready` kiểm tra Redis. Redis lỗi sẽ làm instance
> tạm ngừng nhận traffic thay vì khiến health check yêu cầu restart.

---

### Câu 9 — Stateless (CP4)

Chạy `docker compose up --scale agent=3` rồi gọi `/ask` nhiều lần với cùng một
`X-User-Id`. Quan sát `history_length` trong response. Nếu lịch sử được lưu
trong một dict Python thay vì Redis, bạn sẽ thấy con số đó thay đổi thế nào?

> Khi dùng Redis, các container cùng đọc một nơi lưu lịch sử nên `history_length`
> tăng theo các lượt hỏi dù request vào container nào. Nếu mỗi container giữ
> một dict Python trong RAM, mỗi cái chỉ có phần lịch sử mà nó tự nhận. Khi
> request chuyển sang container khác, `history_length` có thể thấp hơn hoặc
> không tăng như lượt trước; với người dùng thì trông như app lúc nhớ, lúc quên.

---

### Câu 10 — Deploy thật (CP5)

Ghi lại **một** lỗi bạn gặp khi deploy lên cloud (build fail, health check
timeout, sai REDIS_URL, app không đọc `$PORT`...): thông báo lỗi là gì, bạn
tìm ra nguyên nhân bằng cách nào, và sửa ra sao?

> Lỗi mình gặp khi kiểm tra cấu hình là `REDIS_URL` không trỏ tới Redis đang
> dùng. Khi tái hiện với một địa chỉ Redis không hợp lệ, mình thấy:
>
> - `GET /health` → **200** `{"status":"ok",...}` (vì cố tình không chạm Redis)
> - `GET /ready` → **503** `{"status":"not ready","redis":false}`
> - `POST /ask` với key đúng → **500 Internal Server Error** (vì
>   `store.get_history` không kết nối được Redis)
>
> Cách khoanh vùng là so sánh hai endpoint: `/health` vẫn trả 200 nhưng `/ready`
> báo `redis:false`, nên process còn chạy nhưng app không nối được dependency.
> Log container cũng cho thấy lỗi kết nối Redis. Mình tái hiện trường hợp này
> với `REDIS_URL=redis://127.0.0.1:1/0`.
>
> Mình sửa bằng cách đặt `REDIS_URL` về địa chỉ Redis của service (trên Railway
> dùng tham chiếu `${{ redis.REDIS_URL }}`), rồi kiểm tra lại. Sau khi kết nối
> được, `/ready` báo `redis:true` và request `/ask` hoạt động. Nhìn riêng
> `/health` sẽ không phát hiện được lỗi Redis; `/ready` giúp mình nhận ra đúng
> chỗ cần kiểm tra.
