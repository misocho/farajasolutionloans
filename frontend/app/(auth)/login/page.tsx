"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, ShieldCheck, Zap, Coins } from "lucide-react";

import { LoginForm } from "@/features/auth/components/login-form";
import { AppLogo } from "@/components/layout/app-logo";
import { isAuthenticated } from "@/app/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }

    // Show session expired message if redirected
    if (searchParams.get("expired") === "true") {
      toast.error("Session Expired", {
        description: "Please log in again to continue.",
      });
    }
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Left Column: Form Section */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 md:px-20 lg:flex-none lg:w-[480px] xl:w-[540px] bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800 shadow-xl">
        <div className="mx-auto w-full max-w-sm lg:w-96 flex flex-col justify-between h-full">
          {/* Header */}
          <div className="flex flex-col pt-4">
            <AppLogo size="md" />
            <div className="mt-10">
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                Welcome Back
              </h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Please enter your employee credentials to access the credit management portal.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="mt-8 flex-1 flex flex-col justify-center">
            <LoginForm />
          </div>

          {/* Footer */}
          <div className="pt-8 text-center lg:text-left">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Faraja Solutions &copy; {new Date().getFullYear()}. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Visual Dashboard Showcase */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
        {/* Soft Modern Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D44A2]/5 via-transparent to-[#F57424]/5" />
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#0D44A2]/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#F57424]/10 blur-[120px] pointer-events-none" />

        {/* Feature Display Grid */}
        <div className="relative z-10 w-full max-w-2xl px-8 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0D44A2]/10 border border-[#0D44A2]/20 text-[#0D44A2] text-xs font-semibold mb-6">
            <span>Corporate Credit Portal</span>
            <ArrowUpRight className="size-3.5" />
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl leading-[1.1]">
            Empowering Kenyan SMEs with <span className="text-[#0D44A2]">Fast</span> & <span className="text-[#F57424]">Secure</span> Credit
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-lg">
            Manage loan disbursements, client profiles, and repayments seamlessly through a consolidated micro-finance dashboard.
          </p>

          {/* Cards Showcase */}
          <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-lg">
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-md text-left flex flex-col justify-between h-36 hover:-translate-y-1 transition-all duration-300">
              <div className="p-3 bg-[#0D44A2]/10 text-[#0D44A2] rounded-2xl w-fit">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200">Secure Approval Limits</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Role-based controls & thresholds.</p>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-md text-left flex flex-col justify-between h-36 hover:-translate-y-1 transition-all duration-300">
              <div className="p-3 bg-[#F57424]/10 text-[#F57424] rounded-2xl w-fit">
                <Zap className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200">Instant Disbursement</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Real-time processing integrations.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-md text-left flex items-center gap-4 w-full max-w-lg hover:-translate-y-1 transition-all duration-300">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl w-fit shrink-0">
              <Coins className="size-6" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200">Active Repayments</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Track, record and reconcile repayments seamlessly across branches.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
