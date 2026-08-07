"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, CheckCircle, Loader2, ShieldCheck, Camera, FileText, Phone } from "lucide-react";
import { toast } from "sonner";
import { acceptInviteApi, completeProfileApi } from "@/features/auth/api";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiError = { response?: { data?: { detail?: string } } };

function ProfilePhotoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (base64: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be under 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
        Profile Photo <span className="text-zinc-400 font-semibold">(optional)</span>
      </Label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl cursor-pointer transition-colors min-h-[120px] overflow-hidden ${
          value
            ? "border-emerald-400/50 bg-emerald-50/20 dark:border-emerald-700/40 dark:bg-emerald-950/10"
            : "border-zinc-200 hover:border-[#0D44A2]/50 bg-zinc-50/50 dark:border-zinc-800 dark:hover:border-[#0D44A2]/40"
        }`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Profile"
              className="w-full h-full object-cover absolute inset-0"
            />
            <div className="absolute inset-0 bg-zinc-950/30 flex flex-col items-center justify-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="size-6 text-white" />
              <span className="text-[10px] text-white font-semibold">
                Tap to change
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <Camera className="size-6 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="text-center px-3">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Tap to take a selfie
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                or choose from gallery
              </p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState<"password" | "profile" | "done">("password");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [idNo, setIdNo] = useState("");
  const [photo, setPhoto] = useState("");

  const mutation = useMutation({
    mutationFn: () => acceptInviteApi({ token, password }),
    onSuccess: (data) => {
      setEmployeeNumber(data.employee_number);
      setStep("profile");
    },
    onError: (err: ApiError) => {
      toast.error("Could not accept invite", {
        description: err?.response?.data?.detail ?? "The link may have expired.",
      });
    },
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      completeProfileApi({ token, phone: phone.trim(), id_no: idNo.trim(), photo: photo || undefined }),
    onSuccess: (data) => {
      setEmployeeNumber(data.employee_number);
      setStep("done");
    },
    onError: (err: ApiError) => {
      toast.error("Could not save your profile", {
        description: err?.response?.data?.detail ?? "Please try again.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!token) {
      toast.error("Invalid invite link — no token found.");
      return;
    }
    mutation.mutate();
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      toast.error("Enter a valid phone number.");
      return;
    }
    if (!idNo.trim()) {
      toast.error("National ID number is required.");
      return;
    }
    profileMutation.mutate();
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="max-w-sm w-full bg-white dark:bg-zinc-900 rounded-[28px] p-8 border border-zinc-200 dark:border-zinc-800 shadow-xl text-center">
          <div className="p-4 bg-rose-500/10 rounded-3xl w-fit mx-auto mb-4">
            <ShieldCheck className="size-10 text-rose-500" />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Invalid Link</h2>
          <p className="text-sm text-zinc-500 mt-2">This invitation link is missing or invalid. Please contact your Director.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Left — Form */}
      <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-12 md:px-16 lg:flex-none lg:w-[480px] xl:w-[540px] bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800 shadow-xl">
        <div className="mx-auto w-full max-w-sm flex flex-col justify-between min-h-full">
          <div className="flex flex-col pt-2 sm:pt-4">
            <AppLogo size="md" />
            <div className="mt-8 sm:mt-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                {step === "done"
                  ? "Account Created!"
                  : step === "profile"
                    ? "Complete Your Profile"
                    : "Accept Your Invitation"}
              </h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {step === "done"
                  ? "Your account is pending Director approval. You'll receive an email once activated."
                  : step === "profile"
                    ? "Add your phone number and ID so the Director can verify you."
                    : "Set a secure password to activate your Faraja Solution Loans account."}
              </p>
            </div>
          </div>

          <div className="mt-8 flex-1 flex flex-col justify-center">
            {step === "done" ? (
              <div className="flex flex-col items-center gap-5 py-8 text-center">
                <div className="p-5 bg-emerald-500/10 rounded-3xl">
                  <CheckCircle className="size-12 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Your Employee ID</p>
                  <p className="text-2xl font-black text-[#0D44A2] mt-1 tracking-widest">{employeeNumber}</p>
                  <p className="text-xs text-zinc-400 mt-2">Keep this for your records.</p>
                </div>
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold mt-2"
                >
                  Back to Login
                </Button>
              </div>
            ) : step === "profile" ? (
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Cell Phone Number <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +254 712 345 678"
                      className="pl-10 h-11 rounded-xl border-zinc-200 dark:border-zinc-700"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="idNo" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    National ID Number <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                    <Input
                      id="idNo"
                      value={idNo}
                      onChange={(e) => setIdNo(e.target.value)}
                      placeholder="e.g. 29304928"
                      className="pl-10 h-11 rounded-xl border-zinc-200 dark:border-zinc-700"
                      required
                    />
                  </div>
                </div>

                <ProfilePhotoPicker value={photo} onChange={setPhoto} />

                <Button
                  type="submit"
                  disabled={profileMutation.isPending}
                  className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 shadow"
                >
                  {profileMutation.isPending ? (
                    <><Loader2 className="animate-spin size-4" /> Saving Profile...</>
                  ) : (
                    <><CheckCircle className="size-4" /> Save Profile & Finish</>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    New Password
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                    <Input
                      id="password"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="pl-10 pr-10 h-11 rounded-xl border-zinc-200 dark:border-zinc-700"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your password"
                      className="pl-10 pr-10 h-11 rounded-xl border-zinc-200 dark:border-zinc-700"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-xs text-rose-500 mt-1">Passwords do not match.</p>
                  )}
                </div>

                {/* Password strength hints */}
                <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 p-3 space-y-1.5">
                  {[
                    { label: "At least 8 characters", ok: password.length >= 8 },
                    { label: "Contains a number", ok: /\d/.test(password) },
                    { label: "Contains a capital letter", ok: /[A-Z]/.test(password) },
                  ].map((hint) => (
                    <div key={hint.label} className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${hint.ok ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`} />
                      <span className={`text-xs ${hint.ok ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                        {hint.label}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 shadow"
                >
                  {mutation.isPending ? (
                    <><Loader2 className="animate-spin size-4" /> Creating Account...</>
                  ) : (
                    <><CheckCircle className="size-4" /> Activate My Account</>
                  )}
                </Button>
              </form>
            )}
          </div>

          <div className="pt-6 sm:pt-8 text-center lg:text-left">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Faraja Solutions &copy; {new Date().getFullYear()}. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right — Branding */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D44A2]/5 via-transparent to-[#F57424]/5" />
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#0D44A2]/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#F57424]/10 blur-[120px] pointer-events-none" />
        <div className="relative z-10 w-full max-w-md px-8 text-center flex flex-col items-center gap-6">
          <div className="p-6 bg-[#0D44A2]/10 rounded-[32px] border border-[#0D44A2]/20">
            <ShieldCheck className="size-16 text-[#0D44A2]" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome to the <span className="text-[#0D44A2]">Faraja</span> Team
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-sm">
            Set your password to complete your account setup. Your Director will activate your access shortly.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteContent />
    </Suspense>
  );
}
