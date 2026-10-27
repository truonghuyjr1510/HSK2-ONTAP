# Âm thanh Quan thoại

Các tệp trong `audio/` được tạo từ 318 từ và 318 câu ví dụ trong `words-data.js`. Mỗi từ có `w-NNN.mp3`, mỗi câu ví dụ có `e-NNN.mp3`; `NNN` là vị trí của mục trong danh sách. App chỉ tải và phát tệp khi người dùng nhấn nút nghe. Vì thế cùng một phát âm được dùng trên máy tính và điện thoại.

App phát âm ở tốc độ 0,9 và nút nghe chậm ở 0,75. `voice-preview/` chứa các mẫu so sánh giọng và tốc độ trước khi tạo lại toàn bộ bộ âm thanh.

Nguồn giọng: [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh), giọng `zf_001`, giấy phép Apache 2.0. Mã tạo âm thanh dùng [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT) và `misaki-fork[zh]`. Tệp mô hình không được lưu trong website.

Để tạo lại bộ âm thanh, cài `kokoro-onnx==0.6.1` và `misaki-fork[zh]==0.9.6`, rồi tải ba tệp vào một thư mục mô hình:

- [`kokoro-v1.1-zh.onnx`](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.1-zh.onnx)
- [`voices-v1.1-zh.bin`](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.1-zh.bin)
- [`config.json`](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/raw/main/config.json)

Chạy `python scripts/generate_audio.py --model-dir /đường/dẫn/đến/mô-hình`. Nếu sửa một mục, xóa MP3 tương ứng trước khi chạy lại. Nếu thay đổi thứ tự danh sách, xóa toàn bộ `audio/*.mp3` trước khi chạy lại vì tên tệp phụ thuộc vào vị trí. Kiểm tra đủ 636 tệp MP3 trước khi xuất bản.
