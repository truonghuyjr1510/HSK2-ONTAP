# Âm thanh Quan thoại

`audio-c/` (giọng nữ `zf_002`) và `audio-d/` (giọng nam `zm_010`) đều được tạo ở tốc độ mô hình 0,9 từ 318 từ và 318 câu ví dụ trong `words-data.js`. Mỗi từ có `w-NNN.mp3`, mỗi câu ví dụ có `e-NNN.mp3`; `NNN` là vị trí của mục trong danh sách. App mặc định dùng giọng C; lựa chọn giọng D được lưu riêng trong trình duyệt. Cả hai giọng chỉ phát khi người dùng nhấn nút nghe. `audio/` chứa giọng cũ để các phiên bản trang đã tải trước đó vẫn hoạt động.

App phát các tệp mới ở tốc độ thường 1,0 và nút nghe chậm ở 0,82. `voice-preview/` chứa các mẫu so sánh giọng và tốc độ.

Nguồn giọng: [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh), giấy phép Apache 2.0. Mã tạo âm thanh dùng [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT) và `misaki-fork[zh]`. Tệp mô hình không được lưu trong website.

Để tạo lại bộ âm thanh, cài `kokoro-onnx==0.6.1` và `misaki-fork[zh]==0.9.6`, rồi tải ba tệp vào một thư mục mô hình:

- [`kokoro-v1.1-zh.onnx`](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.1-zh.onnx)
- [`voices-v1.1-zh.bin`](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.1-zh.bin)
- [`config.json`](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/raw/main/config.json)

Chạy `python scripts/generate_audio.py --model-dir /đường/dẫn/đến/mô-hình --voice zf_002 --speed 0.9 --output-dir audio-c` cho giọng C, rồi chạy lại với `--voice zm_010 --output-dir audio-d` cho giọng D. Nếu sửa một mục, xóa MP3 tương ứng trong cả hai thư mục trước khi tạo lại. Nếu thay đổi thứ tự danh sách, xóa toàn bộ MP3 trong hai thư mục vì tên tệp phụ thuộc vào vị trí. Kiểm tra đủ 636 tệp trong mỗi thư mục trước khi xuất bản.

## Phương án Azure Speech

`scripts/generate_azure_audio.py` tạo bộ MP3 riêng bằng [Azure AI Speech REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech). Từ vựng dùng cách đọc SAPI dựa trên pinyin trong sheet, theo [bảng âm vị tiếng Trung của Azure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets#pinyin-initials-for-zh-cn). Câu ví dụ được gửi dưới dạng Trung văn có ngữ cảnh. Script không tải âm thanh hay dùng API nội bộ của OnHSK.

Chạy thử phần kiểm tra dữ liệu mà không cần khóa API:

```sh
pip install pypinyin
python scripts/generate_azure_audio.py --dry-run
python scripts/generate_azure_audio.py --dry-run --indices 46,47
```

Để tạo âm thanh, đặt `HSK_SPEECH_KEY` trong phần bí mật của môi trường và `HSK_SPEECH_REGION` theo vùng của tài nguyên Speech (ví dụ `southeastasia`), rồi chạy:

```sh
python scripts/generate_azure_audio.py --voice zh-CN-XiaoxiaoNeural --output-dir audio-azure-c
python scripts/generate_azure_audio.py --voice zh-CN-YunxiNeural --output-dir audio-azure-d
```

Hai lệnh trên tạo 636 file cho mỗi giọng. Có thể dùng `--indices 46,47 --words-only` để nghe thử hai từ 字 và 听 trước. Năm từ có âm `儿` nối đuôi không thể khóa pinyin bằng quy tắc tự động hiện tại; script nêu rõ chúng trong kết quả kiểm tra để nghe và chỉnh riêng. Chỉ đưa bộ Azure lên website sau khi nghe rà soát từ đơn, câu ví dụ và xác nhận điều khoản sử dụng âm thanh. Khóa API chỉ dùng lúc tạo file, không đặt trong JavaScript của website.
