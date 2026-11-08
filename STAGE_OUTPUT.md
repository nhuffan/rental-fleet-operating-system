# Stage Output

Cập nhật: 08/11/2026. Mỗi stage chỉ gồm phần bàn giao và checklist test thủ công.

**Thứ tự test từ dữ liệu mới:** [tạo doanh nghiệp/Owner](#stage-19-output) → [tạo xe](#stage-3-output) → [bảng giá](#stage-18-output) → [khách hàng/đặt xe](#stage-4-output) → [phát hành/in hợp đồng](#stage-20-output) → [bàn giao/trả xe](#stage-14-output) kèm [ảnh/video](#stage-15-output) → [thu/hoàn cọc](#stage-11-output).

Ô được tick là case đã pass trong QA ngày 02/11/2026; nhãn API/Browser chỉ rõ cách kiểm tra. Ô trống là case còn cần chạy, không phải trạng thái implement. Các case tạo/sửa/xóa dùng doanh nghiệp và dữ liệu thử riêng. Cách chạy source xem [README](README.md); chi tiết kỹ thuật xem [development](docs/development.md). Log kiểm tra cũ còn trong Git.

## Stage 0 output

### Delivery

- Chưa có tài liệu hoặc kết quả độc lập để xác nhận phạm vi Stage 0.

### Cases to test

- Không có case riêng; bắt đầu từ Stage 1.

## Stage 1 output

### Delivery

- Nền tảng Web Next.js, API NestJS, Supabase và các lệnh chạy chung/riêng.

### Cases to test

- [ ] Chạy theo README → Web mở được tại `localhost:4000`, API `127.0.0.1:9000/api/v1/health` trả `status:ok`.
- [ ] Tải lại trang Login → không có lỗi runtime hoặc mất kết nối API.

## Stage 2 output

### Delivery

- Đăng nhập, workspace theo doanh nghiệp; quản lý doanh nghiệp, chi nhánh, quyền truy cập Owner, cài đặt và nhật ký.
- Dữ liệu tách theo doanh nghiệp; quyền hiện tại dùng mô hình Owner/Superadmin ở mục role bên dưới.

### Cases to test

- [ ] Đăng nhập sai mật khẩu → báo lỗi; đăng nhập đúng rồi tải lại → giữ phiên; đăng xuất → không mở lại trang riêng tư được.
- [ ] Owner đổi doanh nghiệp → dữ liệu và bản nháp của workspace trước không bị lẫn sang workspace mới.
- [ ] Tạo/sửa chi nhánh hoặc cài đặt → mở lại đúng dữ liệu, nhật ký có thao tác; ID của doanh nghiệp khác bị từ chối.

## Stage 3 output

### Delivery

- Quản lý xe, thiết bị GPS, gắn/tháo thiết bị và lịch sử gắn xe; đăng ký thiết bị chưa có nghĩa là đã nhận GPS.

### Cases to test

- [ ] Xe/Thiết bị → tạo, tìm, lọc, sửa → danh sách và chi tiết cập nhật đúng; biển số/định danh trùng bị chặn.
- [ ] Gắn thiết bị đang rảnh → xe hiển thị đúng thiết bị; gắn thiết bị đang dùng vào xe khác → bị chặn.
- [ ] Tháo rồi gắn lại → lịch sử cũ còn nguyên; vô hiệu xe/thiết bị đang có ràng buộc → báo lý do.

## Stage 4 output

### Delivery

- Khách hàng, hợp đồng thuê và vòng đời nháp → giữ chỗ → bàn giao → hoàn tất; có hủy, gia hạn, quá hạn và lịch xe trống.

### Cases to test

- [ ] Tạo khách, chọn xe/khoảng thuê, lưu nháp rồi giữ chỗ → trạng thái và lịch xe cập nhật đúng.
- [ ] Đặt hai hợp đồng trùng giờ cho cùng xe → bị chặn; giờ trả của hợp đồng trước bằng giờ nhận của hợp đồng sau → được phép nếu không còn xe chưa trả.
- [ ] Bàn giao → gia hạn → trả xe; thử hủy hợp đồng còn được hủy → chỉ hiện thao tác hợp lệ, lịch xe và trạng thái cập nhật đúng.

## Stage 5 output

### Delivery

- Traccar TEST feed đi qua API vào bản đồ Leaflet/OpenStreetMap và vị trí xe; chưa kết nối thiết bị GPS vật lý.
- Hiển thị vị trí mới/cũ, mất bản tin, chưa có dữ liệu hoặc chưa gắn thiết bị.

### Cases to test

- [ ] Với bản tin TEST riêng → Bản đồ/chi tiết xe hiển thị đúng vị trí, tốc độ, thời gian và nhãn TEST.
- [ ] Gửi lại bản tin trùng hoặc cũ hơn → không nhân đôi dữ liệu và không kéo vị trí hiện tại lùi về quá khứ.
- [ ] Lọc/chọn xe trên bản đồ; mở xe chưa có dữ liệu/chưa gắn thiết bị → trạng thái rõ, không tạo vị trí giả.

## Stage 6 output

### Delivery

- Lịch sử hành trình, bộ lọc xe/hợp đồng/thời gian và xem lại tuyến đường từ GPS TEST; quãng đường là ước tính.
- Tổ chức lại code; thống nhất Web `4000`, API `9000`.

### Cases to test

- [ ] Hành trình → lọc xe/ngày → mở chi tiết, phát/tạm dừng/tua tuyến → vị trí và thời gian khớp dữ liệu.
- [ ] Có khoảng mất GPS → tuyến bị ngắt, không nối thành đường liên tục; khoảng không có dữ liệu hiện trạng thái trống.
- [ ] Mở hành trình từ xe/hợp đồng → đúng bộ lọc; khoảng ngày quá giới hạn được báo rõ.

## Stage 7 output

### Delivery

- Giới hạn nhận GPS, chẩn đoán dữ liệu, dọn lịch sử cũ và khôi phục bộ lọc khi hành trình không còn tồn tại.
- GPS vẫn là TEST; vị trí cũ luôn ghi rõ thời điểm ghi nhận vị trí cuối.

### Cases to test

- [ ] Bản đồ/chi tiết xe → kiểm tra dữ liệu mới, dữ liệu cũ, chưa có dữ liệu và chưa gắn thiết bị → trạng thái giải thích đúng.
- [ ] Mở hành trình đã thay đổi/không còn tồn tại → có hướng dẫn quay lại, giữ xe và khoảng thời gian đã chọn.
- [ ] Kiểm tra kỹ thuật với dữ liệu TEST riêng → bản tin sai token/quá giới hạn bị từ chối; dọn lịch sử giữ lại vị trí cuối của thiết bị đang gắn.

## Stage 8 output

### Delivery

- Superadmin có Tổng quan, danh sách/chi tiết doanh nghiệp dùng dữ liệu thật, với quyền nền tảng riêng.

### Cases to test

- [ ] Superadmin → Tổng quan → Doanh nghiệp → tìm/lọc/mở chi tiết → thông tin và số liệu đúng doanh nghiệp.
- [ ] Owner mở `/superadmin` → bị từ chối; vẫn vào workspace của mình bình thường.
- [ ] Superadmin mở nghiệp vụ Owner khi chưa được cấp Owner → bị từ chối.

## Stage 9 output

### Delivery

- Đồng bộ logo, nhận diện Rental Fleet OS; bổ sung Người dùng và Nhật ký nền tảng cho Superadmin.

### Cases to test

- [ ] Login và hai workspace → logo/tên sản phẩm đồng bộ; thao tác bàn phím thấy vị trí focus.
- [ ] Superadmin → Người dùng → tìm/lọc/phân trang/mở chi tiết → đúng hồ sơ và các quyền truy cập doanh nghiệp.
- [ ] Superadmin → Nhật ký → lọc ngày/hành động/doanh nghiệp → kết quả đúng, không lộ thông tin khách thuê hoặc credential.

## Role simplification and account replacement output

### Delivery

- Chỉ còn Superadmin, Owner và Customer chưa có portal; đã thay tài khoản example bằng ba tài khoản được yêu cầu.
- Bỏ chọn role/ma trận quyền; quản lý quyền Owner bằng trạng thái và bảo vệ Owner cuối cùng.

### Cases to test

- [ ] Đăng nhập ba tài khoản → Superadmin vào console, Owner vào workspace, Customer thấy thông báo chưa có portal.
- [ ] Quyền truy cập Owner → không còn ADMIN/OPERATIONS hoặc ô chọn role; trên doanh nghiệp thử, vô hiệu Owner cuối → bị chặn.
- [ ] Superadmin xem Người dùng → ba tài khoản đã cấu hình có đúng quyền; tài khoản example cũ không còn. Có thể có thêm fixture QA riêng.

## Stage 10 output

### Delivery

- Gộp hai plan Stage 10 và shell follow-up: font Inter, icon Lucide, sáng/tối, bộ lọc và menu tài khoản dùng chung.
- Topbar/logo cố định, chỉ nội dung cuộn; loading theo trang và bỏ nút tạo hợp đồng khỏi sidebar.

### Cases to test

- [ ] Cuộn trang dài, chuyển trang rồi phân trang → topbar/logo đứng yên; trang mới về đầu, phân trang giữ vị trí hợp lý.
- [ ] Mở menu tài khoản bằng chuột/bàn phím → đúng email/role; Escape trả focus; Cài đặt của Owner/Đăng xuất hoạt động.
- [ ] Đổi sáng/tối rồi tải lại; thử màn hình nhỏ → theme được giữ, menu/nội dung không tràn hoặc che thao tác.

## Stage 11 output

### Delivery

- Thu chi thực nhận, tiền thuê, nhận/hoàn/giữ cọc, sửa sai bằng bút toán đảo và đối chiếu theo xe/hợp đồng.
- Một Login chung; server tự chọn workspace. Giá hợp đồng/xác nhận cọc không tự trở thành tiền đã thu.

### Cases to test

- [ ] Login với Owner/Superadmin, kể cả từ link role khác → tự vào workspace có quyền, không cần chọn role.
- [ ] Thu tiền thuê, nhận cọc rồi hoàn/giữ một phần → tổng thu, còn thiếu và cọc đang giữ đúng; hoàn quá cọc bị chặn.
- [ ] Đảo giao dịch có lý do → bản gốc còn nguyên, có giao dịch sửa sai, tổng tiền đúng; Owner doanh nghiệp khác không mở được.

## Stage 12 output

### Delivery

- Cảnh báo trả xe quá hạn/sắp đến hạn và GPS TEST cũ; có bộ lọc và liên kết xe/hợp đồng.
- Dialog, text field, dropdown và lịch đồng bộ; cảnh báo bỏ thay đổi chưa lưu.

### Cases to test

- [ ] Cảnh báo → lọc loại/mức độ, mở bản ghi liên quan → đúng dữ liệu; xe chưa từng có GPS không bị báo mất kết nối.
- [ ] Form có dropdown/ngày giờ → chọn bằng chuột/bàn phím → popup không lệch/bị che, giá trị lưu đúng.
- [ ] Sửa form rồi Cancel/Escape → chọn tiếp tục sửa hoặc bỏ thay đổi; đang lưu không đóng nhầm, đóng xong trả focus.

## Stage 13 output

### Delivery

- Áp dụng bố cục preview vào Tổng quan Owner/Superadmin và danh sách, dùng số liệu thật; GPS ghi rõ TEST.
- Topbar, avatar mặc định/menu tài khoản, icon trước nút chính, category luôn mở và viền focus đồng bộ.

### Cases to test

- [ ] Owner → Tổng quan → KPI, lịch thuê, hàng đợi, bản đồ → mở được bản ghi liên quan, không xuất hiện fixture preview.
- [ ] Superadmin → Tổng quan → Doanh nghiệp/Nhật ký → liên kết và số liệu đúng phạm vi đang hiển thị.
- [ ] Desktop/mobile → category luôn thấy, nút chính có icon, field có một viền focus cam, menu không tràn màn hình.

## Stage 14 output

### Delivery

- Biên bản bàn giao/trả xe có km, nhiên liệu, tình trạng, checklist, ghi chú và đối chiếu; đã lưu không sửa/xóa được.
- Chi tiết xe có biên bản gần nhất; kiểm tra xe không tự phát sinh phí.

### Cases to test

- [ ] Hợp đồng đã giữ chỗ → Bàn giao → thiếu checklist hoặc có hư hỏng nhưng thiếu mô tả → bị chặn; điền đủ → lưu được.
- [ ] Trả với km nhỏ hơn lúc giao → bị chặn; nhập hợp lệ → hoàn tất, hiển thị đúng chênh lệch km/nhiên liệu.
- [ ] Mở lại hợp đồng/xe → biên bản giữ nguyên, không có nút sửa/xóa, không tự tạo thu/chi.

## Stage 15 output

### Delivery

- Ảnh/video riêng tư đính kèm lúc bàn giao/trả xe; có xem trước, nén, tiến trình, thử lại/hủy và gallery theo biên bản.
- Tệp đã gắn được giữ nguyên, xem bằng link ngắn hạn có kiểm tra quyền.

### Cases to test

- [ ] Chọn ảnh/video → xem trước, tải lên, lưu biên bản → gallery hiển thị đúng tệp, mở toàn màn hình/phát video được.
- [ ] Video quá 30 giây, tệp quá giới hạn/không hợp lệ → báo rõ; hủy/thử lại không đính kèm trùng.
- [ ] Để link hết hạn rồi mở lại qua gallery → có link mới nếu tệp còn hạn lưu; Owner doanh nghiệp khác không xem được.

## Stage 16 output

### Delivery

- Giữ tệp 30/90 ngày sau trả xe; Quan trọng/Legal hold có lý do và lịch sử bảo vệ.
- Tệp hết hạn có trạng thái rõ, vẫn giữ biên bản. Xóa vật lý mặc định tắt; công cụ mặc định chỉ dry-run.

### Cases to test

- [ ] Cài đặt → đổi 30/90 ngày → hạn tệp đủ điều kiện cập nhật đúng; hợp đồng chưa hoàn tất không tự hết hạn.
- [ ] Đặt/gỡ Quan trọng hoặc Legal hold → bắt buộc lý do, trạng thái đúng; tranh chấp không tự gỡ bảo vệ.
- [ ] Dry-run trên dữ liệu thử → không xóa tệp; tệp hết hạn không được cấp link mới, tệp đang được bảo vệ vẫn xem được nếu chưa bị xóa.

## Stage 17 output

### Delivery

- Import CSV phí đường bộ → xem trước → đối soát xe/hợp đồng → ghi chi phí riêng lẻ/hàng loạt; cảnh báo trùng. Chưa tích hợp VETC trực tiếp.
- Tên/trạng thái doanh nghiệp gọn trên topbar, header chỉ title/description; chuyển category có một vùng loading trong nội dung.

### Cases to test

- [ ] Thu chi → Phí đường bộ → import CSV → dòng hợp lệ được xem trước, ngày/tiền sai báo rõ; chưa xác nhận thì chưa tạo chi phí.
- [ ] Đối soát, ghi chi phí rồi thử lại/import lại → không ghi trùng; dòng mơ hồ/có khả năng trùng bị chặn ghi hàng loạt, phải xử lý riêng có lý do/xác nhận.
- [ ] Chuyển category liên tục/đổi doanh nghiệp → một loader trong trang, đến đúng nội dung; tên/dropdown co theo tên doanh nghiệp, header đồng bộ.

## Stage 18 output

### Delivery

- Bảng giá giờ/ngày riêng xe hoặc mặc định doanh nghiệp; báo giá VND có diễn giải và giá thỏa thuận kèm lý do.
- Giá đã xác nhận được giữ nguyên; báo giá không tự ghi tiền thu.

### Cases to test

- [ ] Hợp đồng → Bảng giá → tạo giá mặc định/riêng xe → báo giá chọn đúng xe, hiệu lực và quy tắc giờ/ngày.
- [ ] Đổi xe/thời gian hoặc nhập giá thỏa thuận → cập nhật báo giá, bắt buộc lý do; thiếu bảng giá không điền giá giả.
- [ ] Sửa bảng giá trước xác nhận → phải xem lại báo giá; sửa sau xác nhận/gia hạn → giá đã chốt giữ nguyên, không tự tạo thu/chi.

## Stage 19 output

### Delivery

- Superadmin tạo doanh nghiệp, chi nhánh đầu tiên và Owner; cấp/cấp lại link đặt mật khẩu, ngưng/kích hoạt và ghi nhật ký.
- Luồng tạo Owner → người dùng đặt mật khẩu → đúng workspace đã chạy thực tế. Cấu hình Auth hosted vẫn cần quản trị viên xác nhận; có gặp lỗi kết nối/phiên tạm thời khi QA, thử lại thành công nhưng chưa xác định nguyên nhân.

### Cases to test

- [x] **Browser:** tạo doanh nghiệp/email thử mới → nhận link; người dùng tự đặt mật khẩu → vào đúng workspace Owner.
- [x] **API + Browser:** cấp lại link → mở đúng `/set-password`; URL đích sạch, không còn token.
- [x] **API:** ngưng doanh nghiệp → cấp link bị chặn; kích hoạt lại → cấp được; nhật ký có thao tác, không chứa email/token/link.
- [ ] Dùng email thử đã tồn tại cho doanh nghiệp khác → thêm workspace, không đổi mật khẩu cũ; link đã dùng/hết hạn bị từ chối.
- [ ] Owner bị ngưng thử truy cập dữ liệu → bị chặn; Owner/Customer mở trang/API Superadmin → bị từ chối.

## Stage 20 output

### Delivery

- Hồ sơ pháp lý doanh nghiệp, CCCD/GPLX khách; danh sách che số giấy tờ. Hợp đồng có số/phiên bản bất biến, in hợp đồng và biên bản A4.
- Đã sửa trang trắng cuối khi in; preview hợp đồng và biên bản trả xe đã kiểm tra trên Chrome. Điều khoản mẫu cần rà soát trước khi dùng thương mại.

### Cases to test

- [x] **API:** lưu hồ sơ doanh nghiệp/khách → đọc lại đúng; danh sách chỉ hiện ba ký tự cuối CCCD/GPLX, audit không chứa số giấy tờ.
- [x] **API + Browser:** phát hành khi thiếu hồ sơ → có cảnh báo/dòng chấm để điền tay; phát hành từ hợp đồng nháp bị chặn.
- [x] **API + Browser xem lại:** nội dung trùng → giữ phiên bản; sửa hồ sơ → phiên bản mới, mở lại bản cũ vẫn giữ nguyên.
- [x] **Browser:** preview A4 hợp đồng/trả xe → không có shell hoặc trang trắng cuối, tiền bằng chữ đúng; trả xe đúng 125 km/−25 điểm phần trăm nhiên liệu và không tạo phí.
- [ ] Từ panel Tài liệu → phát hành bằng dialog rồi xem/in biên bản bàn giao; dữ liệu bàn giao trên Web đã kiểm tra đúng 10.000 km/80% nhiên liệu.
- [ ] Hợp đồng đã hủy → không phát hành; tiền lẻ/ngoại tệ → cảnh báo, tắt nút in và không làm tròn.

## Stage 21 output

### Delivery

- Trang Báo cáo cho Owner: doanh thu, chi phí, lợi nhuận ước tính theo kỳ/tháng, công suất khai thác theo xe, hợp đồng theo trạng thái.
- Xuất CSV danh sách xe, khách hàng, hợp đồng và giao dịch; không gồm số CCCD/GPLX, địa chỉ hay ghi chú. Chưa chạy thử trên trình duyệt.

### Cases to test

- [x] **Browser:** Báo cáo → chọn kỳ có giao dịch → số doanh thu/chi phí khớp dữ liệu thử; kỳ trên 366 ngày bị chặn (chặn đã kiểm tra bằng test, chưa thử trên UI).
- [ ] Xe có hợp đồng hoàn tất trong kỳ → giờ thuê và công suất hợp lý; xe không có hợp đồng hiện 0%.
- [ ] Xuất 4 loại CSV → mở bằng Excel đúng tiếng Việt; ô bắt đầu `=` không chạy công thức; không có số CCCD/GPLX.
- [ ] Đổi doanh nghiệp → báo cáo và CSV chỉ chứa dữ liệu doanh nghiệp đó.

## Stage 22 output

### Delivery

- Hồ sơ xe có hạn đăng kiểm, bảo hiểm, mốc bảo dưỡng; ghi nhận lịch sử dịch vụ không sửa/xóa và cập nhật hạn mới cùng lúc.
- Cảnh báo vận hành thêm xe quá hạn hoặc còn tối đa 30 ngày. Chi phí dịch vụ chỉ để tham khảo, không tự tạo thu chi. Migration chưa áp dụng lên project development.

### Cases to test

- [x] **Browser:** Chi tiết xe hiện đúng ngày và nhãn "Còn N ngày"/"Đã quá hạn" (dữ liệu nhập sẵn; form sửa xe chưa thử trên UI).
- [x] **Browser:** Chi tiết xe → Ghi nhận dịch vụ đăng kiểm → hạn xe cập nhật. Ngày tương lai bị chặn chỉ kiểm tra bằng test.
- [x] **Browser:** Cảnh báo → xe quá hạn hiện "Cần xử lý", xe còn ≤30 ngày hiện "Cần theo dõi"; xe ngưng hoạt động chỉ kiểm tra bằng test.
- [ ] Thương mại → không có giao dịch tự tạo sau khi ghi nhận chi phí dịch vụ.

## Stage 23 output

### Delivery

- Superadmin có Tính năng, Tích hợp & GPS và Cài đặt hệ thống chỉ đọc: môi trường, kết nối DB, migration mới nhất, trạng thái cấu hình và giới hạn vận hành.
- Không lộ khóa/token/DB URL; không có nút ghi giả. GPS vẫn ghi rõ TEST, cổng khách/thanh toán/thông báo ghi rõ chưa triển khai.

### Cases to test

- [x] **Browser:** Superadmin → Tính năng → danh sách đúng trạng thái "Đã triển khai/Chỉ dữ liệu TEST/Chưa triển khai".
- [x] **Browser:** Tích hợp & GPS → hiện Đã cấu hình đúng với env; không thấy khóa, token hay URL kết nối.
- [x] **Browser:** Cài đặt hệ thống → môi trường, migration mới nhất và giới hạn hiển thị; nhật ký nền tảng ghi sự kiện bằng test.
- [ ] Owner mở `/superadmin/settings` → bị từ chối.

## Stage 24 output

### Delivery

- Cổng khách thuê `/portal`: khách đăng nhập bằng link do Owner cấp, xem danh sách hợp đồng của chính mình và xem/in hợp đồng đã phát hành.
- Owner cấp/cấp lại link ở Chi tiết khách hàng (email chưa có tài khoản). Cổng chỉ đọc: chưa đặt xe, thanh toán hay thông báo. Migration chưa áp dụng lên project development.

### Cases to test

- [x] **Browser:** Khách có email → Owner bấm "Cấp quyền cổng khách" → nhận link; mở link, đặt mật khẩu → vào đúng `/portal` và thấy hợp đồng của mình.
- [ ] Khách A không mở được hợp đồng của khách B hay doanh nghiệp khác (đổi ID trên URL → không tìm thấy); hợp đồng nháp không hiện.
- [ ] Email đã có tài khoản → báo lỗi, không tạo link; ngưng hoạt động khách/doanh nghiệp → khách bị chặn ngay.
- [x] **Browser:** Tài khoản khách mở `/app` hoặc `/superadmin` → bị từ chối; Owner mở `/portal` → bị từ chối.
- [x] **Browser:** Portal → mở bản in hợp đồng đã phát hành hiển thị đúng; chưa thử bản in thật.

## Stage 25 output

### Delivery

- API có security headers, giới hạn yêu cầu theo IP (429 kèm Retry-After), endpoint sẵn sàng `/health/ready`, và từ chối cấu hình staging/production nguy hiểm. Web có header chống nhúng khung và HSTS bản production.
- Thêm CI GitHub Actions (typecheck, lint, test, build, kiểm tra contracts, build Docker) và HEALTHCHECK cho container. Chưa chạy workflow trên GitHub; CSP đầy đủ để sau.

### Cases to test

- [ ] Push lên GitHub → workflow CI chạy xanh (verify, docker).
- [ ] Gọi API > giới hạn/phút từ một IP → trả 429 `RATE_LIMITED` có `Retry-After`; `/health` không bị chặn.
- [ ] Tắt database → `/health/ready` trả 503 không lộ chi tiết; `/health` vẫn 200.
- [ ] Mở bất kỳ trang → header `X-Frame-Options: DENY`; nhúng trang trong iframe bị chặn.

