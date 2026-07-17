import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { FormField } from "../../components/FormField";
import { api, errorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import type { ItemResponse, LoginResponse } from "../../types/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accessToken, user, setTokens } = useAuthStore();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (accessToken && user && user.role !== "parent") return <Navigate to="/" replace />;

  const onSubmit = async (values: FormValues) => {
    setError("");
    try {
      const res = await api.post<ItemResponse<LoginResponse>>("/auth/login", values);
      const { user: authUser, tokens } = res.data.data;
      if (authUser.role === "parent") {
        setError("This panel is for staff accounts");
        return;
      }
      setTokens(tokens, authUser);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-6 text-center text-xl font-semibold">☀️ {t("auth.title")}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label={t("auth.email")} error={errors.email?.message}>
            <input className="input" type="email" autoComplete="username" {...register("email")} />
          </FormField>
          <FormField label={t("auth.password")} error={errors.password?.message}>
            <input className="input" type="password" autoComplete="current-password" {...register("password")} />
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? t("auth.signingIn") : t("auth.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
