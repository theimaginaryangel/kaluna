"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, KalunaApiError } from "@/lib/api";
import { ApiError } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, User, Lock, AlertCircle } from "lucide-react";

export default function CreatorLoginPage() {
  const router = useRouter();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [usernameError, setUsernameError] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");

  const [apiError, setApiError] = React.useState<ApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validateForm = (): boolean => {
    let valid = true;
    if (!username.trim()) {
      setUsernameError("Email is required");
      valid = false;
    } else {
      setUsernameError("");
    }

    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else {
      setPasswordError("");
    }

    return valid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await api.creatorLogin(username.trim(), password);

      if (typeof window !== "undefined") {
        localStorage.setItem("kaluna_jwt_token", response.token);
        localStorage.setItem("kaluna_admin_user", response.username);
      }

      router.push("/admin/dashboard");
    } catch (err: any) {
      if (err instanceof KalunaApiError) {
        setApiError({
          message: err.message,
          errorCode: err.errorCode,
          statusCode: err.statusCode,
        });
      } else {
        setApiError({
          message:
            err?.message || "Authentication failed. Please verify credentials.",
          errorCode: "UNAUTHORIZED",
          statusCode: 401,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 flex items-center justify-center px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: appleSpringEase }}
        className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-[#141622] border border-slate-200 dark:border-slate-800 shadow-soft space-y-6 relative overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-slate-800/40 blur-[60px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-900 dark:text-white shadow-inner">
            <User className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight pt-2">
            Want to create an event?
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to access your creator dashboard.
          </p>
        </div>

        {/* Error Banner */}
        {apiError && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Authentication Failed [{apiError.errorCode}]</span>
            </div>
            <p className="text-rose-300/90 leading-relaxed">
              {apiError.errorCode === "UNAUTHORIZED"
                ? "Invalid username or password. Access denied."
                : apiError.message}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Username or Email"
            type="text"
            placeholder="creator@kaluna.io"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={usernameError}
            icon={<User className="w-4 h-4" />}
            disabled={isSubmitting}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
            icon={<Lock className="w-4 h-4" />}
            disabled={isSubmitting}
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="white"
              size="lg"
              isLoading={isSubmitting}
              className="w-full justify-center font-bold"
            >
              Sign In to Dashboard
            </Button>
          </div>
        </form>

        <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Don't have an account?{" "}
            <a
              href="/admin/register"
              className="text-slate-900 dark:text-white font-bold hover:underline"
            >
              Register here
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
