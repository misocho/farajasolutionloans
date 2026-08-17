"use client";

import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import {
  User,
  Building,
  Users,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Trash2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Save,
  Search,
  X,
  MapPin,
  Eye,
  FileText,
  Home,
  Briefcase,
  Heart,
  FileSpreadsheet,
  Camera,
  PenLine,
  GraduationCap,
  BadgeCheck,
  ImageIcon,
  RefreshCw,
  Banknote,
  ChevronDown,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMeApi } from "@/features/auth/api";
import { useBranch } from "@/components/layout/branch-selector";
import {
  fetchClientsApi,
  fetchClientApi,
  fetchClientLoansApi,
  fetchClientPdfApi,
  fetchLoanApi,
  createClientApi,
  type Client,
  type NextOfKin,
  type PropertyItem,
  type Dependant,
  LOAN_APPLICATION_FEE,
} from "@/features/clients/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { InstallmentTimeline } from "@/components/loans/installment-timeline";
import { formatKES, formatDate } from "@/app/lib/format";

// ── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

const SECTOR_OPTIONS = [
  "Retail & Trade",
  "Agriculture",
  "Logistics & Transport",
  "Construction",
  "Healthcare & Services",
  "Education",
  "Manufacturing",
  "Technology",
  "Hospitality & Tourism",
  "Other (Custom)",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function PhotoUpload({
  label,
  value,
  onChange,
  captureMode = "environment",
  id,
}: {
  label: string;
  value: string;
  onChange: (base64: string) => void;
  captureMode?: "environment" | "user";
  id: string;
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
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        {label}
      </Label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl cursor-pointer transition-colors min-h-[130px] overflow-hidden ${
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
              alt={label}
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
                Tap to take photo
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                or choose from gallery
              </p>
            </div>
          </>
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute top-2 right-2 p-1 bg-rose-500 hover:bg-rose-600 rounded-full text-white z-10"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        capture={captureMode}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

function SignaturePad({
  label,
  onSave,
  savedSig,
  id,
}: {
  label: string;
  onSave: (base64: string) => void;
  savedSig: string;
  id: string;
}) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [signed, setSigned] = useState(false);

  const handleClear = () => {
    sigRef.current?.clear();
    setSigned(false);
    onSave("");
  };

  const handleSave = () => {
    if (sigRef.current?.isEmpty()) {
      toast.error("Please draw a signature first");
      return;
    }
    const dataUrl = sigRef.current!.toDataURL("image/png");
    onSave(dataUrl);
    setSigned(true);
    toast.success("Signature captured");
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        {label}
      </Label>
      {savedSig ? (
        <div className="relative border-2 border-emerald-400/50 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedSig} alt="Signature" className="w-full h-28 object-contain" />
          <div className="absolute bottom-2 right-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 bg-white/90 dark:bg-zinc-900/90 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900"
            >
              Clear & Re-sign
            </button>
          </div>
          <div className="absolute top-2 left-2">
            <BadgeCheck className="size-4 text-emerald-500" />
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
          <SignatureCanvas
            ref={sigRef}
            penColor="#0D44A2"
            canvasProps={{
              id,
              className: "w-full",
              style: { height: "120px", touchAction: "none" },
            }}
            onEnd={() => setSigned(true)}
          />
          <div className="flex gap-2 p-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleSave}
              disabled={!signed}
              className="flex-1 text-xs font-semibold text-white bg-[#0D44A2] hover:bg-[#0A3682] disabled:opacity-40 px-3 py-2 rounded-xl transition-colors"
            >
              Save Signature
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-rose-500 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DependantList({
  title,
  items,
  onAdd,
  onRemove,
  onUpdate,
}: {
  title: string;
  items: Dependant[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: keyof Dependant, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">
          {title}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-semibold text-[#0D44A2] flex items-center gap-1 bg-[#0D44A2]/5 hover:bg-[#0D44A2]/10 dark:bg-[#0D44A2]/10 px-3 py-1.5 rounded-xl cursor-pointer border border-[#0D44A2]/20 transition-colors"
        >
          <Plus className="size-3.5" />
          <span>Add</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-16 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs">
          No dependants added yet
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((dep, idx) => (
            <div
              key={idx}
              className="bg-zinc-50/40 dark:bg-zinc-850/20 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 space-y-3 relative"
            >
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="absolute top-2 right-2 text-rose-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-6">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Full Name</Label>
                  <Input
                    value={dep.fullName}
                    onChange={(e) => onUpdate(idx, "fullName", e.target.value)}
                    placeholder="e.g. Mary Otieno"
                    className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Age</Label>
                  <Input
                    type="number"
                    value={dep.age}
                    onChange={(e) => onUpdate(idx, "age", e.target.value)}
                    placeholder="e.g. 12"
                    className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Relationship</Label>
                  <Input
                    value={dep.relationship}
                    onChange={(e) => onUpdate(idx, "relationship", e.target.value)}
                    placeholder="e.g. Son, Daughter"
                    className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900"
                    required
                  />
                </div>
              </div>

              {/* School toggle */}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={dep.is_school_going}
                  onChange={(e) => {
                    onUpdate(idx, "is_school_going", e.target.checked);
                    if (e.target.checked) {
                      onUpdate(idx, "occupation", "Student");
                    } else {
                      onUpdate(idx, "occupation", "");
                      onUpdate(idx, "school_name", "");
                      onUpdate(idx, "school_grade", "");
                    }
                  }}
                  className="rounded border-zinc-300 text-[#0D44A2] size-4"
                />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <GraduationCap className="size-3.5 text-[#0D44A2]" />
                  Currently in school
                </span>
              </label>

              {dep.is_school_going && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-[#0D44A2]/20">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">School Name</Label>
                    <Input
                      value={dep.school_name || ""}
                      onChange={(e) => onUpdate(idx, "school_name", e.target.value)}
                      placeholder="e.g. Mazeras Primary School"
                      className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Class / Grade / Form</Label>
                    <Input
                      value={dep.school_grade || ""}
                      onChange={(e) => onUpdate(idx, "school_grade", e.target.value)}
                      placeholder="e.g. Grade 5, Form 2"
                      className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900"
                      required
                    />
                  </div>
                </div>
              )}

              {!dep.is_school_going && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Occupation (if any)</Label>
                  <Input
                    value={dep.occupation || ""}
                    onChange={(e) => onUpdate(idx, "occupation", e.target.value)}
                    placeholder="e.g. Casual Labourer, None"
                    className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-900"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Loan Detail Panel (inline expansion in client drawer) ──────────────────────

function LoanInstallmentPanel({ loanId }: { loanId: string }) {
  const { data: loan, isLoading, isError, refetch } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => fetchLoanApi(loanId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-5 border-t border-zinc-100 dark:border-zinc-800">
        <Loader2 className="animate-spin text-[#0D44A2] size-5" />
      </div>
    );
  }
  if (isError || !loan) {
    return (
      <div className="flex items-center justify-between py-4 px-3 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-xs font-bold text-rose-600">Could not load loan details.</p>
        <button onClick={() => refetch()} className="text-[10px] font-bold text-[#0D44A2] underline cursor-pointer">Retry</button>
      </div>
    );
  }
  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={loan.status} />
        {loan.is_overdue && (
          <span className="text-[10px] font-bold text-rose-600">{loan.days_overdue}d overdue · Penalty {formatKES(loan.penalty_amount)}</span>
        )}
      </div>
      {loan.installments && loan.installments.length > 0 ? (
        <InstallmentTimeline installments={loan.installments} />
      ) : (
        <p className="text-[11px] text-zinc-400 italic">
          {loan.status === "Disbursed" ? "Schedule not generated yet." : "Installment schedule is generated at disbursement."}
        </p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"directory" | "register">("directory");
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
  });

  const canRegister = (currentUser?.permissions ?? []).includes("clients.create");

  // ── Fetch clients ───────────────────────────────────────────────────────────
  const { selectedBranchId, branches } = useBranch();

  // ── Branch assignment for new clients ───────────────────────────────────────
  const isBranchScoped = (currentUser?.branch_ids?.length ?? 0) > 0;
  const [formBranchId, setFormBranchId] = useState("");

  const initialBranchId =
    selectedBranchId !== "all" ? selectedBranchId : (branches[0]?.id ?? "");
  if (!formBranchId && initialBranchId) {
    setFormBranchId(initialBranchId);
  }

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients", selectedBranchId],
    queryFn: () => fetchClientsApi(selectedBranchId),
    staleTime: 60_000,
  });

  // ── Deep-link: /clients?client=<id> opens the detail drawer ────────────────
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  if (typeof window !== "undefined" && !selectedClient && detailClientId === null) {
    const param = new URLSearchParams(window.location.search).get("client");
    if (param) {
      setDetailClientId(param);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  const clientDetailQuery = useQuery({
    queryKey: ["client-detail", detailClientId],
    queryFn: () => fetchClientApi(detailClientId!),
    enabled: !!detailClientId,
  });
  const detailClient = clientDetailQuery.data ?? selectedClient;

  const clientLoansQuery = useQuery({
    queryKey: ["client-loans", detailClientId],
    queryFn: () => fetchClientLoansApi(detailClientId!),
    enabled: !!detailClientId,
  });

  const downloadClientPdf = async (clientId: string) => {
    try {
      const blob = await fetchClientPdfApi(clientId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `client-${clientId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the PDF");
    }
  };

  // ── Step 1: Personal & Residential ─────────────────────────────────────────
  const [personalInfo, setPersonalInfo] = useState({
    fullName: "",
    idNo: "",
    pin: "",
    phone: "",
    gender: "Male",
    maritalStatus: "Single",
    occupation: "",
    address: "",
    periodYears: "",
    accommodation: "Family",
    landmark: "",
  });

  // ── Step 2: Applicant's dependants ─────────────────────────────────────────
  const [applicantDependants, setApplicantDependants] = useState<Dependant[]>([]);

  const addApplicantDep = () =>
    setApplicantDependants([
      ...applicantDependants,
      { fullName: "", age: "", relationship: "", is_school_going: false },
    ]);

  const removeApplicantDep = (i: number) =>
    setApplicantDependants(applicantDependants.filter((_, idx) => idx !== i));

  const updateApplicantDep = (i: number, field: keyof Dependant, value: string | boolean) => {
    const updated = [...applicantDependants];
    (updated[i] as any)[field] = value;
    setApplicantDependants(updated);
  };

  // ── Step 3: Spouse & spouse's dependants ───────────────────────────────────
  const [spouseInfo, setSpouseInfo] = useState({
    fullName: "",
    idNo: "",
    phone: "",
    occupation: "",
    address: "",    // NEW
  });

  const [spouseDependants, setSpouseDependants] = useState<Dependant[]>([]);

  const addSpouseDep = () =>
    setSpouseDependants([
      ...spouseDependants,
      { fullName: "", age: "", relationship: "", is_school_going: false },
    ]);

  const removeSpouseDep = (i: number) =>
    setSpouseDependants(spouseDependants.filter((_, idx) => idx !== i));

  const updateSpouseDep = (i: number, field: keyof Dependant, value: string | boolean) => {
    const updated = [...spouseDependants];
    (updated[i] as any)[field] = value;
    setSpouseDependants(updated);
  };

  // ── Step 4: Next of Kin ────────────────────────────────────────────────────
  const [nextOfKinList, setNextOfKinList] = useState<NextOfKin[]>([
    { fullName: "", relationship: "", phone: "", address: "", idNo: "", occupation: "" },
  ]);

  const addNextOfKin = () =>
    setNextOfKinList([
      ...nextOfKinList,
      { fullName: "", relationship: "", phone: "", address: "", idNo: "", occupation: "" },
    ]);

  const removeNextOfKin = (i: number) =>
    setNextOfKinList(nextOfKinList.filter((_, idx) => idx !== i));

  const updateNextOfKin = (i: number, field: keyof NextOfKin, value: string) => {
    const updated = [...nextOfKinList];
    updated[i][field] = value;
    setNextOfKinList(updated);
  };

  // ── Step 5: Business ───────────────────────────────────────────────────────
  const [businessDetails, setBusinessDetails] = useState({
    name: "",
    type: "Retail & Trade",
    customSector: "",
    landmark: "",
    yearsOfOperation: "",
    location: "",
    estimatedAssetValue: "",
  });

  // ── Step 6: Collateral & Guarantor ─────────────────────────────────────────
  const [properties, setProperties] = useState<PropertyItem[]>([
    { description: "", makeModel: "", serialNo: "", estValue: "" },
  ]);

  const addProperty = () =>
    setProperties([...properties, { description: "", makeModel: "", serialNo: "", estValue: "" }]);

  const removeProperty = (i: number) =>
    setProperties(properties.filter((_, idx) => idx !== i));

  const updateProperty = (i: number, field: keyof PropertyItem, value: string) => {
    const updated = [...properties];
    updated[i][field] = value;
    setProperties(updated);
  };

  const [guarantorDetails, setGuarantorDetails] = useState({
    surname: "",
    firstName: "",
    middleName: "",
    idNo: "",      // NEW
    periodKnown: "",
    relationship: "",
    phone: "",
    address: "",
    occupation: "",
  });

  // ── Step 7: Documents ────────────────────────────────────────────────────────

  const [applicantIdPhoto, setApplicantIdPhoto] = useState("");
  const [applicantPassportPhoto, setApplicantPassportPhoto] = useState("");
  const [guarantorIdPhoto, setGuarantorIdPhoto] = useState("");
  const [guarantorPassportPhoto, setGuarantorPassportPhoto] = useState("");
  const [applicantSignature, setApplicantSignature] = useState("");
  const [guarantorSignature, setGuarantorSignature] = useState("");


  // ── Mutation ───────────────────────────────────────────────────────────────
  const clientMutation = useMutation({
    mutationFn: createClientApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client account profile saved!");
      setSuccess(true);
    },
    onError: () => {
      toast.error("Failed to register client profile");
    },
  });

  // ── Step Validation ─────────────────────────────────────────────────────────
  const validateStep = (s: number): string | null => {
    switch (s) {
      case 1:
        if (!formBranchId) return "Select the branch for this client.";
        if (!personalInfo.fullName) return "Full name is required.";
        if (!personalInfo.idNo) return "ID number is required.";
        if (!personalInfo.phone) return "Phone number is required.";
        if (!personalInfo.occupation) return "Occupation is required.";
        if (!personalInfo.address) return "Residential address is required.";
        if (!personalInfo.periodYears) return "Period at address is required.";
        if (!personalInfo.landmark) return "Nearest landmark is required.";
        return null;

      case 5:
        if (!businessDetails.name) return "Business name is required.";
        if (!businessDetails.location) return "Business location is required.";
        if (!businessDetails.yearsOfOperation) return "Years of operation is required.";
        if (!businessDetails.landmark) return "Business landmark is required.";
        if (businessDetails.type === "Other (Custom)" && !businessDetails.customSector)
          return "Please specify the custom business sector.";
        return null;

      case 6:
        if (!guarantorDetails.firstName || !guarantorDetails.surname)
          return "Guarantor's full name is required.";
        if (!guarantorDetails.idNo) return "Guarantor's ID number is required.";
        if (!guarantorDetails.phone) return "Guarantor's phone number is required.";
        if (!guarantorDetails.address) return "Guarantor's address is required.";
        if (!guarantorDetails.occupation) return "Guarantor's occupation is required.";
        if (!guarantorDetails.relationship) return "Guarantor's relationship is required.";
        const missingProp = properties.find(
          (p) => !p.description || !p.makeModel || !p.serialNo || !p.estValue
        );
        if (missingProp) return "Please complete all collateral asset fields.";
        return null;

      case 7:
        if (!applicantIdPhoto) return "Applicant's government ID photo is required.";
        if (!applicantPassportPhoto) return "Applicant's passport photo is required.";
        if (!guarantorIdPhoto) return "Guarantor's government ID photo is required.";
        if (!guarantorPassportPhoto) return "Guarantor's passport photo is required.";
        if (!applicantSignature) return "Applicant's signature is required.";
        if (!guarantorSignature) return "Guarantor's signature is required.";
        return null;

      default:
        return null;
    }
  };

  const handleContinue = () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateStep(7);
    if (error) {
      toast.error(error);
      return;
    }

    clientMutation.mutate({
      branch_id: formBranchId || undefined,
      name: personalInfo.fullName,
      phone: personalInfo.phone,
      email: `${personalInfo.fullName.toLowerCase().replace(/\s+/g, "")}@faraja.co.ke`,
      id_no: personalInfo.idNo,
      pin: personalInfo.pin || undefined,
      gender: personalInfo.gender,
      marital_status: personalInfo.maritalStatus,
      occupation: personalInfo.occupation,
      address: personalInfo.address,
      period_years: personalInfo.periodYears,
      accommodation: personalInfo.accommodation,
      landmark: personalInfo.landmark,

      spouse_name: spouseInfo.fullName || undefined,
      spouse_id: spouseInfo.idNo || undefined,
      spouse_phone: spouseInfo.phone || undefined,
      spouse_occupation: spouseInfo.occupation || undefined,
      spouse_address: spouseInfo.address || undefined,

      applicant_dependants: applicantDependants.filter((d) => d.fullName !== ""),
      spouse_dependants: spouseDependants.filter((d) => d.fullName !== ""),

      next_of_kin_list: nextOfKinList.filter((k) => k.fullName !== ""),

      business_name: businessDetails.name || undefined,
      business_type:
        businessDetails.type === "Other (Custom)"
          ? businessDetails.customSector || "Other"
          : businessDetails.type,
      business_sector_custom:
        businessDetails.type === "Other (Custom)"
          ? businessDetails.customSector
          : undefined,
      business_landmark: businessDetails.landmark || undefined,
      business_years: businessDetails.yearsOfOperation || undefined,
      business_location: businessDetails.location || undefined,
      estimated_asset_value: businessDetails.estimatedAssetValue
        ? Number(businessDetails.estimatedAssetValue)
        : undefined,

      guarantor_surname: guarantorDetails.surname || undefined,
      guarantor_first_name: guarantorDetails.firstName || undefined,
      guarantor_middle_name: guarantorDetails.middleName || undefined,
      guarantor_id_no: guarantorDetails.idNo || undefined,
      guarantor_phone: guarantorDetails.phone || undefined,
      guarantor_relationship: guarantorDetails.relationship || undefined,
      guarantor_address: guarantorDetails.address || undefined,
      guarantor_occupation: guarantorDetails.occupation || undefined,
      guarantor_period_known: guarantorDetails.periodKnown || undefined,

      properties_list: properties.filter((p) => p.description !== ""),

      applicant_id_photo: applicantIdPhoto || undefined,
      applicant_passport_photo: applicantPassportPhoto || undefined,
      guarantor_id_photo: guarantorIdPhoto || undefined,
      guarantor_passport_photo: guarantorPassportPhoto || undefined,
      applicant_signature: applicantSignature || undefined,
      guarantor_signature: guarantorSignature || undefined,
    });
  };


  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setSuccess(false);
    setStep(1);
    setPersonalInfo({ fullName: "", idNo: "", pin: "", phone: "", gender: "Male", maritalStatus: "Single", occupation: "", address: "", periodYears: "", accommodation: "Family", landmark: "" });
    setApplicantDependants([]);
    setSpouseInfo({ fullName: "", idNo: "", phone: "", occupation: "", address: "" });
    setSpouseDependants([]);
    setNextOfKinList([{ fullName: "", relationship: "", phone: "", address: "", idNo: "", occupation: "" }]);
    setBusinessDetails({ name: "", type: "Retail & Trade", customSector: "", landmark: "", yearsOfOperation: "", location: "", estimatedAssetValue: "" });
    setProperties([{ description: "", makeModel: "", serialNo: "", estValue: "" }]);
    setGuarantorDetails({ surname: "", firstName: "", middleName: "", idNo: "", periodKnown: "", relationship: "", phone: "", address: "", occupation: "" });
    setApplicantIdPhoto("");
    setApplicantPassportPhoto("");
    setGuarantorIdPhoto("");
    setGuarantorPassportPhoto("");
    setApplicantSignature("");
    setGuarantorSignature("");
    setViewMode("directory");
  };

  const filteredClients = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.id.toLowerCase().includes(q);
  });

  // ── Access Gate ─────────────────────────────────────────────────────────────
  if (currentUser && !canRegister) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[28px] max-w-xl mx-auto shadow-md select-none">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-3xl mb-6">
          <ShieldAlert className="size-16" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
          Access Level Restricted
        </h2>
        <p className="text-zinc-500 mt-2 text-sm max-w-sm">
          Client onboarding requires the clients.create permission.
        </p>
        <Button onClick={() => (window.location.href = "/dashboard")} className="mt-6 bg-[#0D44A2] hover:bg-[#0A3682] text-white px-6 rounded-xl">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  // ── Step Labels ─────────────────────────────────────────────────────────────
  const stepLabels = [
    "Personal",
    "My Dependants",
    "Spouse",
    "Next of Kin",
    "Business",
    "Collateral",
    "Documents",
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-5 text-left pb-24 select-none relative">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-[24px] shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-55 tracking-tight">
            Borrower Client Registry
          </h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            Onboard new loan applicants and manage credit-backed profiles.
          </p>
        </div>
        {viewMode === "directory" ? (
          <Button onClick={() => setViewMode("register")} className="bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 px-5 font-bold text-xs shrink-0">
            <Plus className="size-4 mr-1.5" />
            Onboard New Client
          </Button>
        ) : (
          <Button onClick={() => setViewMode("directory")} variant="outline" className="border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 rounded-xl h-10 px-5 font-bold text-xs shrink-0">
            Back to Directory
          </Button>
        )}
      </div>

      {/* ── DIRECTORY VIEW ─────────────────────────────────────────────── */}
      {viewMode === "directory" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-[24px] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search by name, phone or client ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-zinc-50/50"
              />
            </div>
            <span className="text-xs bg-zinc-50 dark:bg-zinc-800 text-zinc-500 px-3.5 py-1.5 rounded-full font-semibold shrink-0">
              {clients.length} Clients
            </span>
          </div>

          {clientsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="animate-spin text-primary size-7" />
              <span className="text-xs text-zinc-450">Fetching client registry...</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Full Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Sector</th>
                    <th className="py-3 px-3">Registered</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-400">
                        No clients found.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10 transition-colors">
                        <td className="py-4 px-3 font-bold text-zinc-950 dark:text-zinc-100">{client.name}</td>
                        <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400">{client.phone}</td>
                        <td className="py-4 px-3">
                          <span className="px-2 py-0.5 rounded-lg border border-[#0D44A2]/25 text-[#0D44A2] bg-[#0D44A2]/5 dark:text-blue-450 dark:border-blue-900/40 text-[10px] font-bold">
                            {client.business_type || "Retail"}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400">{formatDate(client.date_registered)}</td>
                        <td className="py-4 px-3 text-right">
                          <Button onClick={() => setSelectedClient(client)} variant="outline" size="sm" className="rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 h-8 flex items-center gap-1 cursor-pointer">
                            <Eye className="size-3.5" />
                            <span>View</span>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── REGISTRATION FORM ──────────────────────────────────────────── */}
      {viewMode === "register" && !success && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">

          {/* Step progress bar */}
          <div className="px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-850">
            {/* Mobile: compact step indicator */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-[#0D44A2] bg-[#0D44A2]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}
              </span>
              <span className="text-xs text-zinc-400 font-semibold">
                {Math.round((step / TOTAL_STEPS) * 100)}% complete
              </span>
            </div>

            {/* Progress track */}
            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0D44A2] rounded-full transition-all duration-500"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>

            {/* Step dots - scrollable on mobile */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              {stepLabels.map((label, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded-xl text-[10px] font-bold transition-colors ${
                    i + 1 === step
                      ? "bg-[#0D44A2]/10 text-[#0D44A2]"
                      : i + 1 < step
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
                      : "text-zinc-400"
                  }`}
                >
                  <span className={`size-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${i + 1 < step ? "bg-emerald-500 text-white" : i + 1 === step ? "bg-[#0D44A2] text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"}`}>
                    {i + 1 < step ? "✓" : i + 1}
                  </span>
                  <span className="hidden sm:block">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-5">

              {/* ── STEP 1: Personal & Residential ─────────────────────── */}
              {step === 1 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                    <User className="size-4" />
                    <span>Personal & Residential Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold">
                        Branch <span className="text-rose-500">*</span>
                      </Label>
                      <select
                        value={formBranchId}
                        onChange={(e) => setFormBranchId(e.target.value)}
                        disabled={isBranchScoped}
                        className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-800 disabled:opacity-60"
                      >
                        {branches.length === 0 && (
                          <option value="">Loading branches...</option>
                        )}
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      {isBranchScoped && (
                        <p className="text-[10px] text-zinc-400">
                          Assigned to your branch automatically.
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold">Full Names (as on ID) <span className="text-rose-500">*</span></Label>
                      <Input value={personalInfo.fullName} onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })} placeholder="e.g. Mary Atieno Onyango" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">National ID Number <span className="text-rose-500">*</span></Label>
                      <Input value={personalInfo.idNo} onChange={(e) => setPersonalInfo({ ...personalInfo, idNo: e.target.value })} placeholder="e.g. 29304928" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">KRA PIN Number</Label>
                      <Input value={personalInfo.pin} onChange={(e) => setPersonalInfo({ ...personalInfo, pin: e.target.value })} placeholder="e.g. A010293847Z" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Cell Phone Number <span className="text-rose-500">*</span></Label>
                      <Input type="tel" value={personalInfo.phone} onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })} placeholder="e.g. +254 712 999 888" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Occupation <span className="text-rose-500">*</span></Label>
                      <Input value={personalInfo.occupation} onChange={(e) => setPersonalInfo({ ...personalInfo, occupation: e.target.value })} placeholder="e.g. Tailor, Grocer, Farmer" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Gender <span className="text-rose-500">*</span></Label>
                      <select value={personalInfo.gender} onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value })} className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-800">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Marital Status <span className="text-rose-500">*</span></Label>
                      <select value={personalInfo.maritalStatus} onChange={(e) => setPersonalInfo({ ...personalInfo, maritalStatus: e.target.value })} className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-800">
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Accommodation Type <span className="text-rose-500">*</span></Label>
                      <select value={personalInfo.accommodation} onChange={(e) => setPersonalInfo({ ...personalInfo, accommodation: e.target.value })} className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-800">
                        <option value="Family">Family Owned</option>
                        <option value="Rental">Rented</option>
                        <option value="Own">Self Owned</option>
                        <option value="Employer">Employer Provided</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold">Current Residential Address (Physical/Live) <span className="text-rose-500">*</span></Label>
                      <Input value={personalInfo.address} onChange={(e) => setPersonalInfo({ ...personalInfo, address: e.target.value })} placeholder="Estate, Road, House No., Town" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Period at Address (Years) <span className="text-rose-500">*</span></Label>
                      <Input type="number" value={personalInfo.periodYears} onChange={(e) => setPersonalInfo({ ...personalInfo, periodYears: e.target.value })} placeholder="e.g. 4" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Nearest Landmark <span className="text-rose-500">*</span></Label>
                      <Input value={personalInfo.landmark} onChange={(e) => setPersonalInfo({ ...personalInfo, landmark: e.target.value })} placeholder="e.g. Near Mazeras Junction" required />
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Applicant's Dependants ─────────────────────── */}
              {step === 2 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                    <Users className="size-4" />
                    <span>Applicant's Own Dependants</span>
                  </div>
                  <p className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    Add people directly depending on the applicant (not linked to the spouse). Spouse's dependants are recorded in the next step.
                  </p>
                  <DependantList
                    title="Applicant's Dependants"
                    items={applicantDependants}
                    onAdd={addApplicantDep}
                    onRemove={removeApplicantDep}
                    onUpdate={updateApplicantDep}
                  />
                </div>
              )}

              {/* ── STEP 3: Spouse & Spouse's Dependants ───────────────── */}
              {step === 3 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                    <Heart className="size-4" />
                    <span>Spouse Details & Spouse's Dependants</span>
                  </div>

                  <div className="bg-zinc-50/40 dark:bg-zinc-850/20 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 space-y-4">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Spouse Information (if applicable)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold">Spouse Full Names <span className="text-rose-500">*</span></Label>
                        <Input value={spouseInfo.fullName} onChange={(e) => setSpouseInfo({ ...spouseInfo, fullName: e.target.value })} placeholder="e.g. Samuel Mwangi Kamau" className="bg-white dark:bg-zinc-900" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Spouse National ID No.</Label>
                        <Input value={spouseInfo.idNo} onChange={(e) => setSpouseInfo({ ...spouseInfo, idNo: e.target.value })} placeholder="Spouse ID number" className="bg-white dark:bg-zinc-900" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Spouse Cell Phone <span className="text-rose-500">*</span></Label>
                        <Input type="tel" value={spouseInfo.phone} onChange={(e) => setSpouseInfo({ ...spouseInfo, phone: e.target.value })} placeholder="Spouse phone number" className="bg-white dark:bg-zinc-900" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Spouse Occupation <span className="text-rose-500">*</span></Label>
                        <Input value={spouseInfo.occupation} onChange={(e) => setSpouseInfo({ ...spouseInfo, occupation: e.target.value })} placeholder="e.g. Teacher, Farmer" className="bg-white dark:bg-zinc-900" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Spouse Residential Address <span className="text-rose-500">*</span></Label>
                        <Input value={spouseInfo.address} onChange={(e) => setSpouseInfo({ ...spouseInfo, address: e.target.value })} placeholder="Physical address / estate" className="bg-white dark:bg-zinc-900" />
                      </div>
                    </div>
                  </div>

                  <DependantList
                    title="Spouse's Dependants (separate from applicant's)"
                    items={spouseDependants}
                    onAdd={addSpouseDep}
                    onRemove={removeSpouseDep}
                    onUpdate={updateSpouseDep}
                  />
                </div>
              )}

              {/* ── STEP 4: Next of Kin ─────────────────────────────────── */}
              {step === 4 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                      <FileText className="size-4" />
                      <span>Next of Kin Entries</span>
                    </div>
                    <button type="button" onClick={addNextOfKin} className="text-xs font-semibold text-[#0D44A2] flex items-center gap-1 bg-[#0D44A2]/5 hover:bg-[#0D44A2]/10 px-3 py-1.5 rounded-xl cursor-pointer border border-[#0D44A2]/20 transition-colors">
                      <Plus className="size-3.5" />
                      <span>Add Next of Kin</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {nextOfKinList.map((kin, idx) => (
                      <div key={idx} className="bg-zinc-50/40 dark:bg-zinc-850/20 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 space-y-3 relative">
                        {nextOfKinList.length > 1 && (
                          <button type="button" onClick={() => removeNextOfKin(idx)} className="absolute top-2 right-2 text-rose-400 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                        <span className="text-[10px] font-black text-[#0D44A2] uppercase tracking-wider">
                          Next of Kin #{idx + 1}
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-4">
                          <div className="sm:col-span-2 space-y-1">
                            <Label className="text-[10px] font-bold">Full Names <span className="text-rose-500">*</span></Label>
                            <Input value={kin.fullName} onChange={(e) => updateNextOfKin(idx, "fullName", e.target.value)} placeholder="Kin full name" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold">Relationship <span className="text-rose-500">*</span></Label>
                            <Input value={kin.relationship} onChange={(e) => updateNextOfKin(idx, "relationship", e.target.value)} placeholder="e.g. Sister, Son" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold">Cell Phone <span className="text-rose-500">*</span></Label>
                            <Input type="tel" value={kin.phone} onChange={(e) => updateNextOfKin(idx, "phone", e.target.value)} placeholder="Phone number" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold">National ID No. (required if 18+)</Label>
                            <Input value={kin.idNo || ""} onChange={(e) => updateNextOfKin(idx, "idNo", e.target.value)} placeholder="ID number" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold">Occupation <span className="text-rose-500">*</span></Label>
                            <Input value={kin.occupation || ""} onChange={(e) => {
                              updateNextOfKin(idx, "occupation", e.target.value);
                              // Auto set school note
                              if (e.target.value.toLowerCase().includes("school") || e.target.value.toLowerCase() === "student") {
                                updateNextOfKin(idx, "school_note", "Currently in school");
                              } else {
                                updateNextOfKin(idx, "school_note", "");
                              }
                            }} placeholder='e.g. Farmer, Student, "In school - Form 3"' className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                            {(kin.occupation?.toLowerCase().includes("school") || kin.occupation?.toLowerCase() === "student") && (
                              <p className="text-[10px] text-[#0D44A2] flex items-center gap-1 mt-1">
                                <GraduationCap className="size-3" />
                                School-going noted
                              </p>
                            )}
                          </div>
                          <div className="sm:col-span-2 space-y-1">
                            <Label className="text-[10px] font-bold">Residential Address <span className="text-rose-500">*</span></Label>
                            <Input value={kin.address || ""} onChange={(e) => updateNextOfKin(idx, "address", e.target.value)} placeholder="Physical residential address" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 5: Business Details ────────────────────────────── */}
              {step === 5 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                    <Building className="size-4" />
                    <span>Business Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold">Business / Shop Name <span className="text-rose-500">*</span></Label>
                      <Input value={businessDetails.name} onChange={(e) => setBusinessDetails({ ...businessDetails, name: e.target.value })} placeholder="e.g. Baraka Seeds & Fertilizers" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Business Sector <span className="text-rose-500">*</span></Label>
                      <select value={businessDetails.type} onChange={(e) => setBusinessDetails({ ...businessDetails, type: e.target.value })} className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-800">
                        {SECTOR_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    {businessDetails.type === "Other (Custom)" && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Specify Sector <span className="text-rose-500">*</span></Label>
                        <Input value={businessDetails.customSector} onChange={(e) => setBusinessDetails({ ...businessDetails, customSector: e.target.value })} placeholder="Describe the business sector" required />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Years of Operation <span className="text-rose-500">*</span></Label>
                      <Input type="number" value={businessDetails.yearsOfOperation} onChange={(e) => setBusinessDetails({ ...businessDetails, yearsOfOperation: e.target.value })} placeholder="e.g. 5" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Nearest Business Landmark <span className="text-rose-500">*</span></Label>
                      <Input value={businessDetails.landmark} onChange={(e) => setBusinessDetails({ ...businessDetails, landmark: e.target.value })} placeholder="e.g. Next to KCB Agent" required />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold">Physical Business Location / Address <span className="text-rose-500">*</span></Label>
                      <Input value={businessDetails.location} onChange={(e) => setBusinessDetails({ ...businessDetails, location: e.target.value })} placeholder="Shop road, building, town" required />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold">Estimated Asset Value (KES)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={businessDetails.estimatedAssetValue}
                        onChange={(e) => setBusinessDetails({ ...businessDetails, estimatedAssetValue: e.target.value })}
                        placeholder="e.g. 250000"
                      />
                      <p className="text-[10px] text-zinc-400">Approximate total value of the business's assets.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 6: Collateral & Guarantor ─────────────────────── */}
              {step === 6 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                    <ShieldCheck className="size-4" />
                    <span>Collateral Assets & Guarantor</span>
                  </div>

                  {/* Collateral */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Schedule of Collateral Properties <span className="text-rose-500">*</span></span>
                      <button type="button" onClick={addProperty} className="text-xs font-semibold text-[#0D44A2] flex items-center gap-1 bg-[#0D44A2]/5 hover:bg-[#0D44A2]/10 px-3 py-1.5 rounded-xl cursor-pointer border border-[#0D44A2]/20 transition-colors">
                        <Plus className="size-3.5" />
                        <span>Add Asset</span>
                      </button>
                    </div>
                    {properties.map((prop, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50/30 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 items-end relative">
                        {properties.length > 1 && (
                          <button type="button" onClick={() => removeProperty(idx)} className="absolute top-2 right-2 text-rose-400 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                        <div className="col-span-2 sm:col-span-1 space-y-1">
                          <Label className="text-[10px] font-bold">Item Description <span className="text-rose-500">*</span></Label>
                          <Input value={prop.description} onChange={(e) => updateProperty(idx, "description", e.target.value)} placeholder="e.g. Double-door Fridge" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold">Make/Model <span className="text-rose-500">*</span></Label>
                          <Input value={prop.makeModel || ""} onChange={(e) => updateProperty(idx, "makeModel", e.target.value)} placeholder="e.g. LG Samsung" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold">Serial No. <span className="text-rose-500">*</span></Label>
                          <Input value={prop.serialNo || ""} onChange={(e) => updateProperty(idx, "serialNo", e.target.value)} placeholder="Serial or Reg." className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold">Est. Value (KES) <span className="text-rose-500">*</span></Label>
                          <Input type="number" value={prop.estValue} onChange={(e) => updateProperty(idx, "estValue", e.target.value)} placeholder="Value in KES" className="h-9 rounded-xl bg-white dark:bg-zinc-900 text-xs" required />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Guarantor */}
                  <div className="bg-zinc-50/30 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 space-y-4">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Guarantor's Details <span className="text-rose-500">*</span></span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">First Name <span className="text-rose-500">*</span></Label>
                        <Input value={guarantorDetails.firstName} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, firstName: e.target.value })} placeholder="First Name" className="bg-white dark:bg-zinc-900" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Middle Name</Label>
                        <Input value={guarantorDetails.middleName} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, middleName: e.target.value })} placeholder="Middle Name" className="bg-white dark:bg-zinc-900" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Surname <span className="text-rose-500">*</span></Label>
                        <Input value={guarantorDetails.surname} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, surname: e.target.value })} placeholder="Surname" className="bg-white dark:bg-zinc-900" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">National ID No. <span className="text-rose-500">*</span></Label>
                        <Input value={guarantorDetails.idNo} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, idNo: e.target.value })} placeholder="Guarantor's national ID" className="bg-white dark:bg-zinc-900" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone Number <span className="text-rose-500">*</span></Label>
                        <Input type="tel" value={guarantorDetails.phone} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, phone: e.target.value })} placeholder="Phone number" className="bg-white dark:bg-zinc-900" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Relationship to Applicant <span className="text-rose-500">*</span></Label>
                        <Input value={guarantorDetails.relationship} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, relationship: e.target.value })} placeholder="e.g. Business Partner" className="bg-white dark:bg-zinc-900" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Occupation <span className="text-rose-500">*</span></Label>
                        <Input value={guarantorDetails.occupation} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, occupation: e.target.value })} placeholder="e.g. Hardware Owner" className="bg-white dark:bg-zinc-900" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Period Known to Applicant</Label>
                        <Input value={guarantorDetails.periodKnown} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, periodKnown: e.target.value })} placeholder="e.g. 5 years" className="bg-white dark:bg-zinc-900" />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Home Physical Address <span className="text-rose-500">*</span></Label>
                        <Input value={guarantorDetails.address} onChange={(e) => setGuarantorDetails({ ...guarantorDetails, address: e.target.value })} placeholder="Guarantor's physical address" className="bg-white dark:bg-zinc-900" required />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 7: Documents & Signatures ─────────────────────── */}
              {step === 7 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                    <Camera className="size-4" />
                    <span>Documents, Photos & Signatures</span>
                  </div>

                  {/* Applicant Photos */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-[#0D44A2]" />
                      Applicant's Photos
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                      <PhotoUpload label="ID / National ID Photo *" value={applicantIdPhoto} onChange={setApplicantIdPhoto} captureMode="environment" id="applicant-id-photo" />
                      <PhotoUpload label="Passport Photo *" value={applicantPassportPhoto} onChange={setApplicantPassportPhoto} captureMode="user" id="applicant-passport-photo" />
                    </div>
                  </div>

                  {/* Guarantor Photos */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-[#F57424]" />
                      Guarantor's Photos
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                      <PhotoUpload label="Guarantor ID Photo *" value={guarantorIdPhoto} onChange={setGuarantorIdPhoto} captureMode="environment" id="guarantor-id-photo" />
                      <PhotoUpload label="Guarantor Passport Photo *" value={guarantorPassportPhoto} onChange={setGuarantorPassportPhoto} captureMode="user" id="guarantor-passport-photo" />
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                      <PenLine className="size-3.5 text-emerald-600" />
                      Signatures <span className="text-rose-500">*</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SignaturePad label="Applicant's Signature *" onSave={setApplicantSignature} savedSig={applicantSignature} id="applicant-sig" />
                      <SignaturePad label="Guarantor's Signature *" onSave={setGuarantorSignature} savedSig={guarantorSignature} id="guarantor-sig" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Navigation Buttons ────────────────────────────────────── */}
            <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-850 px-5 py-4">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>

              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-5 py-2.5 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5 focus:outline-none"
                >
                  <span>Continue</span>
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <Button
                  type="submit"
                  disabled={clientMutation.isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5 focus:outline-none h-auto"
                >
                  {clientMutation.isPending ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
                  <span>{clientMutation.isPending ? "Submitting..." : "Onboard & Complete"}</span>
                </Button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── SUCCESS BANNER ─────────────────────────────────────────────── */}
      {success && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[28px] max-w-md mx-auto shadow-md">
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-3xl mb-6">
            <CheckCircle2 className="size-16" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-55 tracking-tight">
            Client Profile Onboarded
          </h2>
          <p className="text-zinc-500 mt-2 text-sm">
            {personalInfo.fullName} has been successfully registered with full documentation, signatures, and collateral records.
          </p>
          <div className="flex gap-4 mt-6 w-full">
            <Button onClick={resetForm} className="flex-1 border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 h-10 rounded-xl">
              Register Another
            </Button>
            <Button onClick={() => { resetForm(); setViewMode("directory"); }} className="flex-1 bg-[#0D44A2] hover:bg-[#0A3682] text-white h-10 rounded-xl">
              View Directory
            </Button>
          </div>
        </div>
      )}

      {/* ── CLIENT DETAIL DRAWER ───────────────────────────────────────── */}
      {(selectedClient || detailClientId) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-full max-w-2xl h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-250">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 flex justify-between items-start z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0D44A2]/10 text-primary rounded-xl">
                  <User className="size-5 text-[#0D44A2]" />
                </div>
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-zinc-50 text-base">{detailClient?.name ?? selectedClient?.name ?? "Loading…"}</h3>
                  <p className="text-xs font-bold text-zinc-400">{detailClient ? `Registered ${formatDate(detailClient.date_registered)}` : "Fetching details…"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadClientPdf(detailClient?.id ?? selectedClient?.id ?? "")}
                  disabled={!detailClient && !selectedClient}
                  className="flex items-center gap-1.5 h-9 px-3 bg-[#F57424] hover:bg-[#e0641a] text-white rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-40"
                >
                  <Download className="size-3.5" /> PDF
                </button>
                <button onClick={() => { setSelectedClient(null); setDetailClientId(null); }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer">
                  <X className="size-5 text-zinc-500" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6 text-xs text-zinc-700 dark:text-zinc-300">

              {clientDetailQuery.isError && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
                  <p className="text-amber-800 dark:text-amber-300 font-semibold">
                    Couldn't refresh client details — showing last loaded data.
                  </p>
                  <Button
                    onClick={() => clientDetailQuery.refetch()}
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-xl border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
                  >
                    <RefreshCw className="size-3 mr-1" /> Retry
                  </Button>
                </div>
              )}

              {detailClient ? (
                <>
              {/* Loans */}
              <section className="space-y-2">
                <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Banknote className="size-3.5" />Loans ({clientLoansQuery.data?.length ?? 0})</p>
                {clientLoansQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="animate-spin text-[#0D44A2] size-5" />
                  </div>
                ) : clientLoansQuery.isError ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Could not load loans.</p>
                    <button onClick={() => clientLoansQuery.refetch()} className="text-[10px] font-bold text-amber-800 underline cursor-pointer">Retry</button>
                  </div>
                ) : clientLoansQuery.data && clientLoansQuery.data.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {clientLoansQuery.data.map((loan) => (
                      <div key={loan.id} className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 overflow-hidden">
                        <button
                          onClick={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                          className="w-full flex items-center justify-between gap-2 p-3 text-left cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {loan.loan_number} <span className="text-zinc-400 font-semibold">· {loan.product ?? loan.sector}</span>
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {formatKES(loan.amount)}{loan.due_date ? ` · Due ${formatDate(loan.due_date)}` : ""}
                              {loan.outstanding > 0 ? ` · Outstanding ${formatKES(loan.outstanding)}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={loan.status} />
                            <ChevronDown className={`size-4 text-zinc-400 transition-transform ${expandedLoanId === loan.id ? "rotate-180" : ""}`} />
                          </div>
                        </button>
                        {expandedLoanId === loan.id && <LoanInstallmentPanel loanId={loan.id} />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-zinc-400 text-[11px] italic">No loans recorded for this client.</span>
                )}
              </section>

              {/* Personal */}
              <section className="space-y-2">
                <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Home className="size-3.5" />Personal & Residency</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50/40 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                  {[
                    ["National ID", detailClient.id_no],
                    ["KRA PIN", detailClient.pin],
                    ["Phone", detailClient.phone],
                    ["Gender / Marital", `${detailClient.gender} / ${detailClient.marital_status}`],
                    ["Occupation", detailClient.occupation],
                    ["Accommodation", `${detailClient.accommodation} (${detailClient.period_years || "0"} yrs)`],
                    ["Address", detailClient.address],
                    ["Landmark", detailClient.landmark],
                  ].map(([label, val]) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">{label}</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{val || "N/A"}</span>
                    </div>
                  ))}
                  <div className="sm:col-span-3 flex flex-col">
                    <span className="text-[10px] text-zinc-400 font-semibold">Residential Maps Link</span>
                    {detailClient.residential_maps_link ? (
                      <a
                        href={detailClient.residential_maps_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-[#0D44A2] underline cursor-pointer"
                      >
                        <MapPin className="size-3" /> Open in Google Maps
                      </a>
                    ) : (
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">N/A</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Applicant Dependants */}
              {detailClient.applicant_dependants && detailClient.applicant_dependants.length > 0 && (
                <section className="space-y-2">
                  <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Users className="size-3.5" />Applicant's Dependants ({detailClient.applicant_dependants.length})</p>
                  <div className="flex flex-col gap-2">
                    {detailClient.applicant_dependants.map((dep, i) => (
                      <div key={i} className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 flex justify-between">
                        <div>
                          <span className="font-bold text-zinc-900 dark:text-zinc-200">{dep.fullName}</span>
                          <span className="text-[10px] text-zinc-400 block">Age {dep.age} • {dep.relationship}</span>
                        </div>
                        {dep.is_school_going && (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                            <GraduationCap className="size-3" />
                            {dep.school_name} — {dep.school_grade}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Spouse */}
              <section className="space-y-2">
                <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Heart className="size-3.5" />Spouse & Family</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50/40 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                  {[
                    ["Spouse Name", detailClient.spouse_name],
                    ["Spouse Phone", detailClient.spouse_phone],
                    ["Spouse Occupation", detailClient.spouse_occupation],
                    ["Spouse Address", detailClient.spouse_address],
                  ].map(([label, val]) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">{label}</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{val || "N/A"}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Next of Kin */}
              <section className="space-y-2">
                <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Users className="size-3.5" />Next of Kin ({detailClient.next_of_kin_list?.length || 0})</p>
                <div className="flex flex-col gap-2">
                  {(!detailClient.next_of_kin_list || detailClient.next_of_kin_list.length === 0) ? (
                    <span className="text-zinc-400 text-[11px] italic">No next of kin recorded.</span>
                  ) : detailClient.next_of_kin_list.map((kin, i) => (
                    <div key={i} className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/20">
                      <div className="flex justify-between flex-wrap gap-2">
                        <div>
                          <span className="font-bold text-zinc-900 dark:text-zinc-200">{kin.fullName}</span>
                          <span className="text-[10px] text-zinc-400 block">{kin.relationship} • ID: {kin.idNo || "N/A"} • {kin.occupation || "N/A"}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-zinc-700 dark:text-zinc-300 block">{kin.phone}</span>
                          <span className="text-[10px] text-zinc-400">{kin.address || "No address"}</span>
                        </div>
                      </div>
                      {kin.school_note && (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-1"><GraduationCap className="size-3" />{kin.school_note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Business */}
              <section className="space-y-2">
                <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Briefcase className="size-3.5" />Business Operations</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50/40 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                  {[
                    ["Business Name", detailClient.business_name],
                    ["Sector", detailClient.business_sector_custom || detailClient.business_type],
                    ["Years Operating", detailClient.business_years ? `${detailClient.business_years} years` : "N/A"],
                    ["Location", detailClient.business_location],
                    ["Landmark", detailClient.business_landmark],
                    ["Est. Asset Value", detailClient.estimated_asset_value ? formatKES(detailClient.estimated_asset_value) : "N/A"],
                  ].map(([label, val]) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">{label}</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{val || "N/A"}</span>
                    </div>
                  ))}
                  <div className="sm:col-span-3 flex flex-col">
                    <span className="text-[10px] text-zinc-400 font-semibold">Business Maps Link</span>
                    {detailClient.business_maps_link ? (
                      <a
                        href={detailClient.business_maps_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-[#0D44A2] underline cursor-pointer"
                      >
                        <MapPin className="size-3" /> Open in Google Maps
                      </a>
                    ) : (
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">N/A</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Collateral */}
              <section className="space-y-2">
                <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><FileSpreadsheet className="size-3.5" />Collateral Properties</p>
                <div className="flex flex-col gap-2">
                  {(!detailClient.properties_list || detailClient.properties_list.length === 0) ? (
                    <span className="text-zinc-400 italic">No collateral registered.</span>
                  ) : detailClient.properties_list.map((prop, i) => (
                    <div key={i} className="flex justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/20">
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-200">{prop.description}</span>
                        <span className="text-[10px] text-zinc-400 block">Model: {prop.makeModel || "N/A"} • Serial: {prop.serialNo || "N/A"}</span>
                      </div>
                      <span className="font-bold text-emerald-600">
                        KES {(() => {
                          const cleanVal = String(prop.estValue || "0").replace(/[^0-9.]/g, "");
                          const num = parseFloat(cleanVal);
                          return isNaN(num) ? "0" : num.toLocaleString();
                        })()}
                      </span>

                    </div>
                  ))}
                </div>
              </section>

              {/* Guarantor */}
              <section className="space-y-2">
                <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><ShieldCheck className="size-3.5" />Guarantor Details</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50/40 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                  {[
                    ["Full Name", `${detailClient.guarantor_first_name || ""} ${detailClient.guarantor_middle_name || ""} ${detailClient.guarantor_surname || ""}`.trim()],
                    ["ID No.", detailClient.guarantor_id_no],
                    ["Phone", detailClient.guarantor_phone],
                    ["Relationship", detailClient.guarantor_relationship],
                    ["Occupation", detailClient.guarantor_occupation],
                    ["Address", detailClient.guarantor_address],
                    ["Period Known", detailClient.guarantor_period_known],
                  ].map(([label, val]) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">{label}</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{val || "N/A"}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Documents thumbnails */}
              {(detailClient.applicant_id_photo || detailClient.applicant_passport_photo || detailClient.guarantor_id_photo || detailClient.guarantor_passport_photo) && (
                <section className="space-y-2">
                  <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Camera className="size-3.5" />Uploaded Documents</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ["Applicant ID", detailClient.applicant_id_photo],
                      ["Applicant Passport", detailClient.applicant_passport_photo],
                      ["Guarantor ID", detailClient.guarantor_id_photo],
                      ["Guarantor Passport", detailClient.guarantor_passport_photo],
                    ].filter(([, src]) => src).map(([label, src]) => (
                      <div key={label} className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-semibold block">{label}</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src as string} alt={label as string} className="w-full h-24 object-cover rounded-xl border border-zinc-200 dark:border-zinc-800" />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Signatures */}
              {(detailClient.applicant_signature || detailClient.guarantor_signature) && (
                <section className="space-y-2">
                  <p className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5"><PenLine className="size-3.5" />Signatures</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {detailClient.applicant_signature && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-semibold">Applicant Signature</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={detailClient.applicant_signature} alt="Applicant signature" className="w-full h-20 object-contain rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white" />
                      </div>
                    )}
                    {detailClient.guarantor_signature && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-semibold">Guarantor Signature</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={detailClient.guarantor_signature} alt="Guarantor signature" className="w-full h-20 object-contain rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white" />
                      </div>
                    )}
                  </div>
                </section>
              )}
                </>
              ) : (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-[#0D44A2] size-7" />
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 p-4">
              <Button onClick={() => { setSelectedClient(null); setDetailClientId(null); }} className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold">
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
