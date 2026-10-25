"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <section className="card">
      <h1>Không thể tải dữ liệu</h1>
      <p>Vui lòng kiểm tra kết nối và thử lại.</p>
      <button className="button button-secondary" onClick={retry}>
        Thử lại
      </button>
    </section>
  );
}
