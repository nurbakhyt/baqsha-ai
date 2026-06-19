"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useStore } from "@/lib/hooks/useStore";
import { apiFetch } from "@/lib/api";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEMO_ACCOUNTS = [
  { label: "Покупатель", email: "customer@example.com", password: "customer123" },
  { label: "Админ", email: "admin@baqsha.kz", password: "admin123" },
];

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const login = useStore((s) => s.login);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setEmail("");
      setPassword("");
      setTimeout(() => emailRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        const res = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        if (res.success) {
          login(res.data.user, res.data.session.id);
          onClose();
        } else {
          setError("Неверный email или пароль");
        }
      } catch {
        setError("Ошибка подключения к серверу");
      } finally {
        setLoading(false);
      }
    },
    [email, password, login, onClose]
  );

  const fillDemo = useCallback((account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 id="login-title" className="text-lg font-semibold text-gray-900">
            Вход
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                ref={emailRef}
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="mt-4 w-full py-2.5 px-4 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Вход..." : "Войти"}
          </button>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Демо-аккаунты:</p>
            <div className="flex gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="flex-1 text-left px-3 py-2 rounded-md border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
                >
                  <span className="block text-xs font-medium text-gray-700 group-hover:text-primary-700">
                    {account.label}
                  </span>
                  <span className="block text-xs text-gray-400 mt-0.5 truncate">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
