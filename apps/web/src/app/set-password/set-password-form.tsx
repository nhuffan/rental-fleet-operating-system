"use client";
import { useActionState } from "react";
import { AuthShowcase } from "@/components/ui/auth-showcase";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { Button, Input } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { MIN_PASSWORD_LENGTH } from "@/lib/recovery-navigation";
import { setPassword } from "./actions";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, { error: "" });
  return (
    <main className="login">
      <section className="login-story">
        <div className="login-brand">
          <BrandLockup tagline tone="dark" />
        </div>
        <div className="login-story-copy">
          <span className="eyebrow">CARBASE</span>
          <h1>Không gian làm việc của bạn đã sẵn sàng.</h1>
          <p>Đặt mật khẩu riêng để bắt đầu quản lý hoạt động cho thuê xe.</p>
        </div>
        <AuthShowcase />
        <small>Giữ mật khẩu và link truy cập riêng cho bạn.</small>
      </section>
      <section className="login-form" aria-labelledby="password-title">
        <div className="login-card">
          <span className="eyebrow">THIẾT LẬP TÀI KHOẢN</span>
          <h2 id="password-title">Đặt mật khẩu</h2>
          <p className="muted">
            Dùng mật khẩu riêng, tối thiểu {MIN_PASSWORD_LENGTH} ký tự.
          </p>
          <form action={action} aria-busy={pending}>
            <label htmlFor="new-password">
              Mật khẩu mới
              <Input
                id="new-password"
                name="password"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={128}
                autoComplete="new-password"
                required
                disabled={pending}
              />
            </label>
            <label htmlFor="confirm-password">
              Nhập lại mật khẩu
              <Input
                id="confirm-password"
                name="confirmation"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={128}
                autoComplete="new-password"
                required
                disabled={pending}
              />
            </label>
            {state.error && (
              <p className="error" role="alert">
                {state.error}
              </p>
            )}
            <Button type="submit" loading={pending}>
              {!pending && <Icon name="check" />}{" "}
              {pending ? "Đang lưu…" : "Lưu và tiếp tục"}
            </Button>
          </form>
          <p className="login-help">
            Link chỉ dùng một lần. Nếu phiên hết hạn, dùng &quot;Quên mật khẩu?&quot; ở
            trang đăng nhập hoặc liên hệ quản trị viên.
          </p>
        </div>
      </section>
    </main>
  );
}
