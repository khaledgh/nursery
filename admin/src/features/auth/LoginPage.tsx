import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
} from "@heroui/react";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { applyServerErrors } from "../../lib/formErrors";
import { useAuthStore } from "../../store/auth";
import type { ItemResponse, LoginResponse } from "../../types/api";

const schema = z.object({
  email: z.string().min(3, "Enter your email or username"),
  password: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accessToken, user, setTokens } = useAuthStore();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

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
      setError(applyServerErrors(form, err));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-950 overflow-hidden">
      {/* Background ambient glowing shapes */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-300/15 blur-3xl pointer-events-none" />

      <Card
        shadow="lg"
        className="w-full max-w-md border border-white/20 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl rounded-3xl p-3 sm:p-5"
      >
        <CardHeader className="flex flex-col items-center gap-3 pt-6 pb-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-lg shadow-slate-200/50 p-2">
            <img src="/logo.png" alt="Nursee+" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {t("auth.title")}
            </h1>
            <p className="text-xs font-bold text-primary mt-1 uppercase tracking-widest">
              Nursee+ Platform
            </p>
          </div>
        </CardHeader>

        <CardBody className="py-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  type="text"
                  label="Email or Username"
                  placeholder="admin or admin@nurseeplus.com"
                  autoComplete="username"
                  variant="bordered"
                  radius="lg"
                  size="md"
                  isInvalid={!!errors.email}
                  errorMessage={errors.email?.message}
                  startContent={<Mail size={18} className="text-slate-400 shrink-0" />}
                  classNames={{
                    inputWrapper: "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50",
                  }}
                />
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  type={showPassword ? "text" : "password"}
                  label={t("auth.password")}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  variant="bordered"
                  radius="lg"
                  size="md"
                  isInvalid={!!errors.password}
                  errorMessage={errors.password?.message}
                  startContent={<Lock size={18} className="text-slate-400 shrink-0" />}
                  endContent={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="focus:outline-none text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                  classNames={{
                    inputWrapper: "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50",
                  }}
                />
              )}
            />

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-danger-50 border border-danger-200 p-3 text-xs font-semibold text-danger-700">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              color="primary"
              size="lg"
              radius="lg"
              isLoading={isSubmitting}
              className="w-full font-bold text-sm shadow-md shadow-primary/25 mt-2"
            >
              {isSubmitting ? t("auth.signingIn") : t("auth.submit")}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

