"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { loginSchema, type LoginFormValues } from "../schemas";
import { loginApi } from "../api";
import { setToken } from "@/app/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employee_number: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      setToken(data.access_token);
      queryClient.clear(); // Clear cache to load new user data
      toast.success("Login successful!", {
        description: "Welcome to Faraja Solutions.",
      });
      router.push("/dashboard");
    },
    onError: (error: any) => {
      const apiError = error.response?.data?.detail || "An unexpected error occurred. Please try again.";
      setErrorMessage(apiError);
      toast.error("Authentication failed", {
        description: apiError,
      });
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setErrorMessage(null);
    loginMutation.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full">
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl p-4 flex items-center gap-2">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Employee Number */}
      <div className="space-y-2">
        <Label htmlFor="employee_number" className="text-zinc-700 dark:text-zinc-300">
          Employee Number
        </Label>
        <InputGroup className="bg-zinc-50 border-zinc-200 focus-within:border-primary focus-within:ring-primary/20 dark:bg-zinc-900 dark:border-zinc-800 dark:focus-within:border-zinc-700 dark:focus-within:ring-zinc-700/20 h-11 rounded-2xl">
          <InputGroupAddon align="inline-start" className="pl-3.5 text-zinc-400">
            <User className="size-5" />
          </InputGroupAddon>
          <InputGroupInput
            id="employee_number"
            type="text"
            placeholder="e.g. FS-DIR001"
            className="text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 text-base"
            disabled={loginMutation.isPending}
            {...register("employee_number")}
          />
        </InputGroup>
        {errors.employee_number && (
          <p className="text-destructive text-xs mt-1 pl-1">{errors.employee_number.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">
            Password
          </Label>
        </div>
        <InputGroup className="bg-zinc-50 border-zinc-200 focus-within:border-primary focus-within:ring-primary/20 dark:bg-zinc-900 dark:border-zinc-800 dark:focus-within:border-zinc-700 dark:focus-within:ring-zinc-700/20 h-11 rounded-2xl">
          <InputGroupAddon align="inline-start" className="pl-3.5 text-zinc-400">
            <Lock className="size-5" />
          </InputGroupAddon>
          <InputGroupInput
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 text-base"
            disabled={loginMutation.isPending}
            {...register("password")}
          />
          <InputGroupAddon align="inline-end" className="pr-2">
            <InputGroupButton
              onClick={() => setShowPassword(!showPassword)}
              disabled={loginMutation.isPending}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {errors.password && (
          <p className="text-destructive text-xs mt-1 pl-1">{errors.password.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loginMutation.isPending}
        className="w-full h-11 bg-primary hover:bg-[#0A3682] text-white rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg focus:ring-4 focus:ring-primary/25 disabled:opacity-50 disabled:pointer-events-none mt-2"
      >
        {loginMutation.isPending ? (
          <>
            <Loader2 className="animate-spin size-5" />
            <span>Verifying Credentials...</span>
          </>
        ) : (
          <span>Log In</span>
        )}
      </Button>
    </form>
  );
}
