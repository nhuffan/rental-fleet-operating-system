"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
export default function Login() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await browserClient().auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error) {
        setError(
          "Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được kích hoạt.",
        );
        return;
      }
      document.cookie = "current-business=; Path=/; Max-Age=0; SameSite=Lax";
      router.replace("/app");
      router.refresh();
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <span className="eyebrow">RENTAL FLEET</span>
        <h1>
          Một không gian.
          <br />
          Cả đội xe.
        </h1>
        <p>Nền tảng quản lý doanh nghiệp và đội ngũ vận hành cho thuê xe.</p>
        <span className="quiet">Rental Fleet Operating System</span>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập</h2>
          <p className="muted">
            Sử dụng tài khoản được cấp cho doanh nghiệp của bạn.
          </p>
          <form onSubmit={submit}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button disabled={pending} type="submit">
              {pending ? "Đang đăng nhập…" : "Đăng nhập →"}
            </button>
          </form>
          <p className="quiet">
            Liên hệ quản trị viên nếu bạn chưa có tài khoản.
          </p>
        </div>
      </section>
    </main>
  );
}
