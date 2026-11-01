# Ba danh sách ôn tập

`review-groups.js` chứa vị trí từ (bắt đầu từ 1) trong `words-data.js`. Pinyin, nghĩa tiếng Việt, ví dụ và âm thanh vẫn lấy từ bộ 318 từ gốc; danh sách này không sao chép hay tự đặt nghĩa mới. Một từ có thể thuộc nhiều danh sách.

| Tệp người học gửi | Từ ghép được | Mục chưa có trong bảng gốc |
| --- | ---: | --- |
| Những từ dễ nhầm lẫn | 50 từ, 21 cặp có đủ hai vế | `bái`, `húi`, `nà`, `yāo`, `jǐe`, `shuǐ`, `dōu` |
| Từ vựng mới | 95 từ | `chū`, `lù`, `wàibiān`, `dì yi`, `nǔ háizi`, `nǔ`, `nán`, `xǐ`, `húidá` |
| Từ vựng nắm chắc | 162 từ | `shàngmiàn`, `lǐmiàn`, `xiǎo lǐ`, `xiǎo wáng`, `méi yǒu`, `jiā`, `zhè`, `húidá`, `nǎ` |

Các lỗi dấu hoặc gõ rõ ràng được sửa để khớp bảng gốc, chẳng hạn `pǎopù` → `pǎobù`, `hǔochē` → `huǒchē`, `shūo` → `shuō`. Những từ đồng âm nhưng khác nghĩa được chọn theo vị trí và ngữ cảnh danh sách: nhóm nắm chắc dùng `kuài` → 块 (đơn vị tiền), nhóm dễ nhầm có 快 (nhanh). Cặp `yào` trong nhóm dễ nhầm có cả 要 và 药 vì bảng gốc ghi hai từ cùng pinyin. Các mục không có từ tương ứng trong bảng gốc chưa được thêm vào bài ôn; khi bổ sung chúng vào bảng từ, cập nhật danh sách này và `review-groups.js`.
