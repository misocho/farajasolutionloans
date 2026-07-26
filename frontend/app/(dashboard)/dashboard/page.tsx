"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Users,
  Coins,
  TrendingUp,
  FileText,
  Building2,
  Clock,
  ArrowRight,
  ShieldAlert,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { fetchMeApi } from "@/features/auth/api";
import { fetchLoansApi, createLoanApi, fetchClientsApi, createClientApi, type Loan } from "@/features/clients/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialChartData = [
  { name: "Jan", Disbursements: 2400000, Repayments: 1100000 },
  { name: "Feb", Disbursements: 4500000, Repayments: 2300000 },
  { name: "Mar", Disbursements: 3800000, Repayments: 1900000 },
  { name: "Apr", Disbursements: 5100000, Repayments: 3200000 },
  { name: "May", Disbursements: 6200000, Repayments: 3800000 },
  { name: "Jun", Disbursements: 7800000, Repayments: 4600000 },
  { name: "Jul", Disbursements: 8200000, Repayments: 5200000 },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("All");

  // In-memory addition of payments for demo simulation
  const [extraRepayments, setExtraRepayments] = useState(0);

  // Modal Control States
  const [activeModal, setActiveModal] = useState<
    "Apply for Loan" | "Register Client" | "Record Repayment" | "Generate Report" | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Field States
  const [newLoan, setNewLoan] = useState({ client: "", sector: "Retail", amount: "" });
  const [newClient, setNewClient] = useState({ name: "", sector: "Retail", email: "", phone: "" });
  const [newRepayment, setNewRepayment] = useState({ loanId: "", amount: "", method: "M-Pesa" });

  // 1. Fetch user profile info
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
    staleTime: Infinity,
  });

  // 2. Fetch loans from backend
  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["loans"],
    queryFn: fetchLoansApi,
  });

  // 3. Fetch clients from backend
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClientsApi,
  });

  // Mutations
  const createLoanMutation = useMutation({
    mutationFn: createLoanApi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      
      // Log audit activity
      const auditMsg = `Officer logged loan request of KES ${data.amount.toLocaleString()} for ${data.client}.`;
      addActivityLog("verification", "Credit Review Created", auditMsg);

      toast.success("Credit Application Received", {
        description: `Loan ${data.id} is pending verification.`,
      });

      setNewLoan({ client: "", sector: "Retail", amount: "" });
      setActiveModal(null);
    },
    onError: () => {
      toast.error("Failed to submit credit application");
    },
    onSettled: () => setSubmitting(false),
  });

  const createClientMutation = useMutation({
    mutationFn: createClientApi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      // Log audit activity
      const auditMsg = `Business account "${data.name}" has been registered in the system.`;
      addActivityLog("verification", "Client Onboarded", auditMsg);

      toast.success("Business Registered Successfully", {
        description: `Account profile saved for ${data.name}.`,
      });

      setNewClient({ name: "", sector: "Retail", email: "", phone: "" });
      setActiveModal(null);
    },
    onError: () => {
      toast.error("Failed to register client");
    },
    onSettled: () => setSubmitting(false),
  });

  // Audit activities local state (persisting during page session)
  const [activities, setActivities] = useState([
    {
      id: "act-1",
      type: "repayment",
      title: "Repayment Recorded",
      description: "Loan #LN-2026-894 received KES 45,000 from Baraka Agro-Supplies.",
      time: "23 mins ago",
    },
    {
      id: "act-2",
      type: "verification",
      title: "Loan Verified",
      description: "Officer verified business records for Zawadi Enterprises.",
      time: "1 hour ago",
    },
    {
      id: "act-3",
      type: "alert",
      title: "Failed Login Alert",
      description: "3 unsuccessful login attempts recorded for Employee FS-MGR002.",
      time: "4 hours ago",
    },
  ]);

  const addActivityLog = (type: string, title: string, description: string) => {
    const newAct = {
      id: `act-${Date.now()}`,
      type,
      title,
      description,
      time: "Just now",
    };
    setActivities((prev) => [newAct, ...prev]);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Filter logic for loans
  const filteredLoans = loans.filter((loan) => {
    if (selectedTab === "All") return true;
    return loan.status.toLowerCase() === selectedTab.toLowerCase();
  });

  // Calculate dynamic stats from backend list
  const getActivePortfolio = () => {
    const activeSum = loans
      .filter((l) => l.status === "Disbursed" || l.status === "Approved")
      .reduce((sum, l) => sum + l.amount, 0);
    return activeSum || 24500000; // fallback if db empty
  };

  const getDisbursedMonth = () => {
    const disbursedSum = loans
      .filter((l) => l.status === "Disbursed")
      .reduce((sum, l) => sum + l.amount, 0);
    return disbursedSum || 8200000;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      disbursed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      rejected: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${styles[status.toLowerCase()]}`}>
        {status}
      </span>
    );
  };

  // 1. Submit Loan Request
  const handleApplyLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoan.client || !newLoan.amount) {
      toast.error("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    createLoanMutation.mutate({
      client: newLoan.client,
      sector: newLoan.sector,
      amount: parseFloat(newLoan.amount),
      duration_days: 90,
    });
  };

  // 2. Submit Register Client
  const handleRegisterClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.phone) {
      toast.error("Please fill in name and phone.");
      return;
    }
    setSubmitting(true);
    createClientMutation.mutate({
      name: newClient.name,
      phone: newClient.phone,
      email: newClient.email || undefined,
      business_type: newClient.sector,
    });
  };

  // 3. Submit Record Repayment
  const handleRepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepayment.loanId || !newRepayment.amount) {
      toast.error("Please specify Loan ID and Amount.");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      const payAmount = parseFloat(newRepayment.amount);
      setExtraRepayments((prev) => prev + payAmount);

      const matchedLoan = loans.find((l) => l.id === newRepayment.loanId);
      const clientName = matchedLoan ? matchedLoan.client : "Faraja Borrower";

      const auditMsg = `Received KES ${payAmount.toLocaleString()} via ${newRepayment.method} for Loan #${newRepayment.loanId} (${clientName}).`;
      addActivityLog("repayment", "Payment Credited", auditMsg);

      toast.success("Repayment Recorded", {
        description: `KES ${payAmount.toLocaleString()} allocated to Loan #${newRepayment.loanId}.`,
      });

      setNewRepayment({ loanId: "", amount: "", method: "M-Pesa" });
      setSubmitting(false);
      setActiveModal(null);
    }, 1200);
  };

  // 4. Report simulation
  const handleGenerateReportClick = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Compiling financial audit report (PDF)...",
        success: "Audit report generated! Check your downloads folder.",
        error: "Failed to download audit logs.",
      }
    );
  };

  const handleActionTrigger = (actionType: typeof activeModal) => {
    if (actionType === "Generate Report") {
      handleGenerateReportClick();
    } else {
      setActiveModal(actionType);
    }
  };

  // Update chart data base value dynamically
  const getDynamicChartData = () => {
    const next = [...initialChartData];
    const lastMonthIndex = next.length - 1;
    next[lastMonthIndex] = {
      ...next[lastMonthIndex],
      Disbursements: getDisbursedMonth(),
      Repayments: next[lastMonthIndex].Repayments + extraRepayments,
    };
    return next;
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-10 text-left relative select-none">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-6 rounded-[20px] sm:rounded-[24px] shadow-sm">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
            <span>{getGreeting()}, {user?.first_name || "System"}!</span>
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
            Credit activity summary for {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800 px-3.5 py-2 rounded-2xl w-fit">
          <Building2 className="size-4 text-[#0D44A2]" />
          <span>Branch: {user?.branch || "Head Office - Miritini"}</span>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Active Portfolio"
          value={`KES ${getActivePortfolio().toLocaleString()}`}
          change="+12.4%"
          isPositive={true}
          icon={Banknote}
          iconBgColor="bg-[#0D44A2]/10"
          iconColor="text-[#0D44A2]"
        />
        <StatCard
          title="Active Clients"
          value={(clients.length || 142).toString()}
          change="+4.8%"
          isPositive={true}
          icon={Users}
          iconBgColor="bg-[#F57424]/10"
          iconColor="text-[#F57424]"
        />
        <StatCard
          title="Disbursed (Month)"
          value={`KES ${getDisbursedMonth().toLocaleString()}`}
          change="+18.2%"
          isPositive={true}
          icon={TrendingUp}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Repayments (Month)"
          value={`KES ${(3450000 + extraRepayments).toLocaleString()}`}
          change="-2.3%"
          isPositive={false}
          icon={Coins}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-500"
        />
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column (Charts & Tables) - Span 2 */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 flex flex-col">
          {/* Recharts Performance Dynamics */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col text-left">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Lending Dynamics</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Disbursement vs Repayment trends</p>
              </div>
            </div>
            
            {/* Chart Area */}
            <div className="h-52 sm:h-72 w-full text-xs mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getDynamicChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDisb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D44A2" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0D44A2" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRepay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F57424" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F57424" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7/50" className="dark:stroke-zinc-800/50" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area
                    type="monotone"
                    dataKey="Disbursements"
                    stroke="#0D44A2"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorDisb)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Repayments"
                    stroke="#F57424"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRepay)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Loans Application Registry */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col gap-4 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <div className="flex flex-col text-left">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Recent Loan Applications</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Latest submissions for credit approval</p>
              </div>

              {/* Status Filtering Tabs */}
              <div className="flex bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl w-fit border border-zinc-100 dark:border-zinc-850 self-start sm:self-center">
                {["All", "Pending", "Approved", "Disbursed"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedTab(tab)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedTab === tab
                        ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-550 shadow-sm"
                        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto w-full -mx-4 sm:mx-0 px-4 sm:px-0">
              {loansLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="animate-spin text-primary size-6" />
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse min-w-[520px]">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-850 text-zinc-400 font-bold">
                      <th className="py-3 px-2">Loan ID</th>
                      <th className="py-3 px-2">Client</th>
                      <th className="py-3 px-2">Sector</th>
                      <th className="py-3 px-2">Amount</th>
                      <th className="py-3 px-2">Submission</th>
                      <th className="py-3 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
                    {filteredLoans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-400 dark:text-zinc-500">
                          No loans match the selected state filter.
                        </td>
                      </tr>
                    ) : (
                      filteredLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-850/20 transition-colors animate-fade-in">
                          <td className="py-3 px-2 font-mono font-semibold text-zinc-750 dark:text-zinc-350">
                            {loan.id}
                          </td>
                          <td className="py-3 px-2 font-bold text-zinc-950 dark:text-zinc-100">
                            {loan.client}
                          </td>
                          <td className="py-3 px-2 text-zinc-500 dark:text-zinc-400">{loan.sector}</td>
                          <td className="py-3 px-2 font-bold text-zinc-900 dark:text-zinc-200">
                            KES {loan.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-zinc-500 dark:text-zinc-400">{loan.date}</td>
                          <td className="py-3 px-2 text-right">{getStatusBadge(loan.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Quick Actions & Recent Activity Logs) */}
        <div className="space-y-4 sm:space-y-6">
          {/* Quick Actions Panel with Callback */}
          <QuickActions onActionClick={handleActionTrigger} />

          {/* Audit Logs / Activity logs */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col text-left">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Recent Activities</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Real-time audit log feeds</p>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 mt-2">
              {activities.slice(0, 4).map((act) => (
                <div key={act.id} className="flex gap-3 text-left animate-in slide-in-from-top-1 duration-200">
                  <div className={`p-1.5 rounded-xl h-fit shrink-0 ${
                    act.type === "repayment" 
                      ? "bg-emerald-500/10 text-emerald-500" 
                      : act.type === "verification" 
                      ? "bg-[#0D44A2]/10 text-primary" 
                      : "bg-rose-500/10 text-rose-500"
                  }`}>
                    {act.type === "repayment" ? <Coins className="size-3.5" /> : act.type === "verification" ? <FileText className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                      {act.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                      {act.description}
                    </p>
                    <span className="text-[9px] text-zinc-400 flex items-center gap-1 mt-1">
                      <Clock className="size-3" />
                      <span>{act.time}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button className="text-xs text-primary hover:text-primary-foreground font-semibold flex items-center justify-center gap-1.5 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-55 px-3 py-2 rounded-2xl transition-colors mt-2 cursor-pointer">
              <span>View Full Audit Logs</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* --- DEMO INTERACTIVE MODALS --- */}

      {/* 1. Modal: Apply for Loan */}
      {activeModal === "Apply for Loan" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom sm:fade-in-50 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">Apply for Business Loan</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer focus:outline-none">
                <X className="size-5 text-zinc-500" />
              </button>
            </div>
            
            <form onSubmit={handleApplyLoanSubmit} className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label htmlFor="loan-client" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Client / Business Name</Label>
                <select
                  id="loan-client"
                  value={newLoan.client}
                  onChange={(e) => setNewLoan({ ...newLoan, client: e.target.value })}
                  className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                  required
                >
                  <option value="">-- Choose client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="New Business Ltd">New Business Ltd (Direct Entry)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="loan-sector" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Industry Sector</Label>
                <select
                  id="loan-sector"
                  value={newLoan.sector}
                  onChange={(e) => setNewLoan({ ...newLoan, sector: e.target.value })}
                  className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                >
                  <option value="Retail">Retail & Trade</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Transport">Logistics & Transport</option>
                  <option value="Construction">Construction</option>
                  <option value="Services">Healthcare & Services</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="loan-amount" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Loan Amount (KES)</Label>
                <Input
                  id="loan-amount"
                  type="number"
                  placeholder="e.g. 500000"
                  value={newLoan.amount}
                  onChange={(e) => setNewLoan({ ...newLoan, amount: e.target.value })}
                  className="h-10 bg-zinc-50/50 rounded-xl"
                  required
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? <Loader2 className="animate-spin size-4" /> : <CheckCircle2 className="size-4" />}
                  <span>{submitting ? "Logging loan request..." : "Submit Credit Application"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Register Client */}
      {activeModal === "Register Client" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom sm:fade-in-50 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">Onboard New Client</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer focus:outline-none">
                <X className="size-5 text-zinc-500" />
              </button>
            </div>
            
            <form onSubmit={handleRegisterClientSubmit} className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label htmlFor="client-name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Business / Client Name</Label>
                <Input
                  id="client-name"
                  type="text"
                  placeholder="e.g. Neema Wholesalers"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="h-10 bg-zinc-50/50 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-phone" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Phone Number</Label>
                <Input
                  id="client-phone"
                  type="tel"
                  placeholder="e.g. +254 712 345 678"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="h-10 bg-zinc-50/50 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-sector" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Sector</Label>
                <select
                  id="client-sector"
                  value={newClient.sector}
                  onChange={(e) => setNewClient({ ...newClient, sector: e.target.value })}
                  className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                >
                  <option value="Retail">Retail</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Transport">Transport</option>
                  <option value="Services">Services</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-email" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Email Address</Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="e.g. contact@neema.co.ke"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="h-10 bg-zinc-50/50 rounded-xl"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#F57424] hover:bg-[#DE6218] text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? <Loader2 className="animate-spin size-4" /> : <CheckCircle2 className="size-4" />}
                  <span>{submitting ? "Saving record..." : "Register & Onboard"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Record Repayment */}
      {activeModal === "Record Repayment" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom sm:fade-in-50 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">Record Client Repayment</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer focus:outline-none">
                <X className="size-5 text-zinc-500" />
              </button>
            </div>
            
            <form onSubmit={handleRepaymentSubmit} className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label htmlFor="repay-loan" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Select Active Loan</Label>
                <select
                  id="repay-loan"
                  value={newRepayment.loanId}
                  onChange={(e) => setNewRepayment({ ...newRepayment, loanId: e.target.value })}
                  className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                  required
                >
                  <option value="">-- Choose active loan --</option>
                  {loans
                    .filter((l) => l.status === "Disbursed" || l.status === "Approved")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.id} - {l.client} (KES {l.amount.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="repay-amount" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Payment Amount (KES)</Label>
                <Input
                  id="repay-amount"
                  type="number"
                  placeholder="e.g. 45000"
                  value={newRepayment.amount}
                  onChange={(e) => setNewRepayment({ ...newRepayment, amount: e.target.value })}
                  className="h-10 bg-zinc-50/50 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="repay-method" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Method</Label>
                <select
                  id="repay-method"
                  value={newRepayment.method}
                  onChange={(e) => setNewRepayment({ ...newRepayment, method: e.target.value })}
                  className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                >
                  <option value="M-Pesa">M-Pesa Express</option>
                  <option value="Bank Transfer">RTGS Bank Transfer</option>
                  <option value="Cash">Cash Deposit</option>
                </select>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? <Loader2 className="animate-spin size-4" /> : <CheckCircle2 className="size-4" />}
                  <span>{submitting ? "Allocating payment..." : "Record Payment & Issue Receipt"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
