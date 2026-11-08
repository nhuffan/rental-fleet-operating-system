"use client";
import Link from "next/link";
import { useActionState } from "react";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { Button, Input } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {
    message: "",
    error: "",
  });
  return (
    <main className="login">
      <section className="login-story">
        <div className="login-brand">
          <BrandLockup />
        </div>
        <div className="login-story-copy">
          <span className="eyebrow">RENTAL FLEET OS</span>
          <h1>Lấy lại quyền truy cập.</h1>
          <p>Nhập email tài khoản để nhận link đặt lại mật khẩu một lần.</p>
        </div>
        <small>Không chia sẻ link đặt lại mật khẩu với bất kỳ ai.</small>
      </section>
      <section className="login-form" aria-labelledby="forgot-title">
        <div className="login-card">
          <span className="eyebrow">KHÔI PHỤC TÀI KHOẢN</span>
          <h2 id="forgot-title">Quên mật khẩu</h2>
          <p className="muted">
            Chúng tôi sẽ gửi link nếu email có tài khoản đang hoạt động.
          </p>
          <form action={action} aria-busy={pending}>
            <label htmlFor="forgot-email">
              Email
              <Input
                id="forgot-email"
                name="email"
                type="email"
                placeholder="ban@doanhnghiep.vn"
                autoComplete="username"
                maxLength={254}
                required
                disabled={pending}
              />
            </label>
            {state.error && (
              <p role="alert" className="error">
                {state.error}
              </p>
            )}
            {state.message && (
              <p role="status" className="muted">
                {state.message}
              </p>
            )}
            <Button type="submit" loading={pending}>
              {!pending && <Icon name="arrow" size={16} />}
              {pending ? "Đang gửi…" : "Gửi link đặt lại"}
            </Button>
          </form>
          <p className="login-help">
            <Link href="/login">← Quay lại đăng nhập</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
