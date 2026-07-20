"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ChevronRight,
  X,
  PlusCircle,
  Eye,
  FileText,
  Home,
  Briefcase,
  Heart,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMeApi } from "@/features/auth/api";
import { fetchClientsApi, createClientApi, type Client, type NextOfKin, type PropertyItem } from "@/features/clients/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"directory" | "register">("directory");
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Detailed selected client modal / drawer state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // 1. Fetch active user to verify permissions
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
  });

  const getRole = (user: any) => {
    if (!user) return "";
    if (user.roles && user.roles.length > 0) {
      return user.roles[0].role.name;
    }
    if (user.employee_number?.includes("DIR")) return "Director";
    if (user.employee_number?.includes("SYS")) return "System Admin";
    if (user.employee_number?.includes("LO")) return "Loan Officer";
    if (user.employee_number?.includes("MGR")) return "Manager";
    return "Auditor";
  };

  const userRole = getRole(currentUser);
  const isAuthorized = ["Director", "System Admin", "Loan Officer"].includes(userRole);

  // 2. Fetch clients list
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClientsApi,
  });

  // Client form states matching full PDF details
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

  // Dependants and Spouse
  const [spouseInfo, setSpouseInfo] = useState({
    fullName: "",
    idNo: "",
    phone: "",
    occupation: "",
  });

  const [dependantsInfo, setDependantsInfo] = useState({
    count: "",
    ages: "",
    schoolGoing: "",
    school: "",
  });

  // Dynamic next of kin list (Multiple entries)
  const [nextOfKinList, setNextOfKinList] = useState<NextOfKin[]>([
    { fullName: "", relationship: "", phone: "", address: "", idNo: "" },
  ]);

  const addNextOfKin = () => {
    setNextOfKinList([...nextOfKinList, { fullName: "", relationship: "", phone: "", address: "", idNo: "" }]);
  };

  const removeNextOfKin = (index: number) => {
    setNextOfKinList(nextOfKinList.filter((_, i) => i !== index));
  };

  const updateNextOfKin = (index: number, field: keyof NextOfKin, value: string) => {
    const updated = [...nextOfKinList];
    updated[index][field] = value;
    setNextOfKinList(updated);
  };

  // Business Details
  const [businessDetails, setBusinessDetails] = useState({
    name: "",
    type: "Retail",
    landmark: "",
    yearsOfOperation: "",
    location: "",
  });

  // Guarantor Details
  const [guarantorDetails, setGuarantorDetails] = useState({
    surname: "",
    firstName: "",
    middleName: "",
    periodKnown: "",
    relationship: "",
    phone: "",
    address: "",
    occupation: "",
  });

  // Collateral Assets list
  const [properties, setProperties] = useState<PropertyItem[]>([
    { description: "", makeModel: "", serialNo: "", estValue: "" },
  ]);

  const addProperty = () => {
    setProperties([...properties, { description: "", makeModel: "", serialNo: "", estValue: "" }]);
  };

  const removeProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index));
  };

  const updateProperty = (index: number, field: keyof PropertyItem, value: string) => {
    const updated = [...properties];
    updated[index][field] = value;
    setProperties(updated);
  };

  // 3. API Mutation for saving client
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalInfo.fullName || !personalInfo.phone) {
      toast.error("Full Name and Phone Number are required.");
      return;
    }
    clientMutation.mutate({
      name: personalInfo.fullName,
      phone: personalInfo.phone,
      email: `${personalInfo.fullName.toLowerCase().replace(/\s+/g, "")}@faraja.co.ke`,
      id_no: personalInfo.idNo || undefined,
      pin: personalInfo.pin || undefined,
      gender: personalInfo.gender,
      marital_status: personalInfo.maritalStatus,
      occupation: personalInfo.occupation || undefined,
      address: personalInfo.address || undefined,
      period_years: personalInfo.periodYears || undefined,
      accommodation: personalInfo.accommodation,
      landmark: personalInfo.landmark || undefined,
      
      spouse_name: spouseInfo.fullName || undefined,
      spouse_id: spouseInfo.idNo || undefined,
      spouse_phone: spouseInfo.phone || undefined,
      spouse_occupation: spouseInfo.occupation || undefined,
      
      dependants_count: dependantsInfo.count || undefined,
      dependants_ages: dependantsInfo.ages || undefined,
      school_going_count: dependantsInfo.schoolGoing || undefined,
      school_details: dependantsInfo.school || undefined,
      
      next_of_kin_list: nextOfKinList.filter(kin => kin.fullName !== ""),
      
      business_name: businessDetails.name || undefined,
      business_type: businessDetails.type,
      business_landmark: businessDetails.landmark || undefined,
      business_years: businessDetails.yearsOfOperation || undefined,
      business_location: businessDetails.location || undefined,
      
      guarantor_surname: guarantorDetails.surname || undefined,
      guarantor_first_name: guarantorDetails.firstName || undefined,
      guarantor_middle_name: guarantorDetails.middleName || undefined,
      guarantor_phone: guarantorDetails.phone || undefined,
      guarantor_relationship: guarantorDetails.relationship || undefined,
      guarantor_address: guarantorDetails.address || undefined,
      guarantor_occupation: guarantorDetails.occupation || undefined,
      guarantor_period_known: guarantorDetails.periodKnown || undefined,
      
      properties_list: properties.filter(prop => prop.description !== ""),
    });
  };

  // Reset registration form
  const resetForm = () => {
    setSuccess(false);
    setStep(1);
    setPersonalInfo({
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
    setSpouseInfo({ fullName: "", idNo: "", phone: "", occupation: "" });
    setDependantsInfo({ count: "", ages: "", schoolGoing: "", school: "" });
    setNextOfKinList([{ fullName: "", relationship: "", phone: "", address: "", idNo: "" }]);
    setBusinessDetails({ name: "", type: "Retail", landmark: "", yearsOfOperation: "", location: "" });
    setGuarantorDetails({
      surname: "",
      firstName: "",
      middleName: "",
      periodKnown: "",
      relationship: "",
      phone: "",
      address: "",
      occupation: "",
    });
    setProperties([{ description: "", makeModel: "", serialNo: "", estValue: "" }]);
    setViewMode("directory");
  };

  // Search filter
  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.phone.includes(query) ||
      client.id.toLowerCase().includes(query)
    );
  });

  // Security Gate
  if (currentUser && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[28px] max-w-xl mx-auto shadow-md select-none">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-3xl mb-6">
          <ShieldAlert className="size-16" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
          Access Level Restricted
        </h2>
        <p className="text-zinc-500 mt-2 text-sm max-w-sm">
          Onboarding new clients and completing credit verification forms are restricted to **Loan Officers**, **System Admins**, and **Directors**.
        </p>
        <Button
          onClick={() => window.location.href = "/dashboard"}
          className="mt-6 bg-[#0D44A2] hover:bg-[#0A3682] text-white px-6 rounded-xl"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-left pb-20 select-none relative">
      {/* 1. Header Area */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-[24px] shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-55 tracking-tight">
            Borrower Client Registry
          </h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            Onboard new loan applicants and view comprehensive credit-backed profiles.
          </p>
        </div>

        {viewMode === "directory" ? (
          <Button
            onClick={() => setViewMode("register")}
            className="bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 px-5 font-bold text-xs"
          >
            <Plus className="size-4 mr-1.5" />
            Onboard New Client
          </Button>
        ) : (
          <Button
            onClick={() => setViewMode("directory")}
            variant="outline"
            className="border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 rounded-xl h-10 px-5 font-bold text-xs"
          >
            Back to Directory
          </Button>
        )}
      </div>

      {/* 2. DIRECTORY VIEW */}
      {viewMode === "directory" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-[24px] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search filter */}
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search clients by name, phone or client ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-zinc-50/50"
              />
            </div>
            <span className="text-xs bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-450 px-3.5 py-1.5 rounded-full font-semibold shrink-0">
              Total Clients: {clients.length}
            </span>
          </div>

          {clientsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="animate-spin text-primary size-8" />
              <span className="text-xs text-zinc-450">Fetching client directories...</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Client ID</th>
                    <th className="py-3 px-3">Full Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Industry Sector</th>
                    <th className="py-3 px-3">Registered On</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400">
                        No clients registered matching that query.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10 transition-colors"
                      >
                        <td className="py-4 px-3 font-mono font-bold text-zinc-700 dark:text-zinc-350">
                          {client.id}
                        </td>
                        <td className="py-4 px-3 font-bold text-zinc-950 dark:text-zinc-100">
                          {client.name}
                        </td>
                        <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400">
                          {client.phone}
                        </td>
                        <td className="py-4 px-3">
                          <span className="px-2 py-0.5 rounded-lg border border-[#0D44A2]/25 text-[#0D44A2] bg-[#0D44A2]/5 dark:text-blue-450 dark:border-blue-900/40 text-[10px] font-bold">
                            {client.business_type || "Retail"}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400">
                          {client.date_registered}
                        </td>
                        <td className="py-4 px-3 text-right">
                          <Button
                            onClick={() => setSelectedClient(client)}
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 h-8 flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="size-3.5" />
                            <span>View Details</span>
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

      {/* 3. MULTI-STEP REGISTRATION FORM VIEW */}
      {viewMode === "register" && !success && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-[24px] shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-850 pb-3">
            <span className="text-xs font-bold text-[#0D44A2] bg-[#0D44A2]/10 px-3.5 py-1 rounded-full uppercase tracking-wider">
              Step {step} of 5
            </span>
            <span className="text-xs text-zinc-400 font-semibold">
              Fill in borrower records to proceed
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* STEP 1: Personal & Residential details */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                  <User className="size-4" />
                  <span>1. Borrower Personal & Residential Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Full Names (as on ID)</Label>
                    <Input
                      value={personalInfo.fullName}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                      placeholder="e.g. Mary Atieno Onyango"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">ID Number</Label>
                    <Input
                      value={personalInfo.idNo}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, idNo: e.target.value })}
                      placeholder="e.g. 29304928"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">KRA PIN Number</Label>
                    <Input
                      value={personalInfo.pin}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, pin: e.target.value })}
                      placeholder="e.g. A010293847Z"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Cell Phone Number</Label>
                    <Input
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                      placeholder="e.g. +254 712 999 888"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Gender</Label>
                    <select
                      value={personalInfo.gender}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value })}
                      className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Marital Status</Label>
                    <select
                      value={personalInfo.maritalStatus}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, maritalStatus: e.target.value })}
                      className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Occupation</Label>
                    <Input
                      value={personalInfo.occupation}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, occupation: e.target.value })}
                      placeholder="e.g. Tailor, Farmer, Grocer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Accommodation Type</Label>
                    <select
                      value={personalInfo.accommodation}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, accommodation: e.target.value })}
                      className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                    >
                      <option value="Family">Family Owned</option>
                      <option value="Rental">Rental</option>
                      <option value="Own">Self Owned</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold">Current Residential Address</Label>
                    <Input
                      value={personalInfo.address}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, address: e.target.value })}
                      placeholder="Estate, Road, House No."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Period in Years at Address</Label>
                    <Input
                      type="number"
                      value={personalInfo.periodYears}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, periodYears: e.target.value })}
                      placeholder="e.g. 4"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nearest Landmark</Label>
                    <Input
                      value={personalInfo.landmark}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, landmark: e.target.value })}
                      placeholder="e.g. Near Mazeras Junction"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Dependants & Spouse details */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                  <Users className="size-4" />
                  <span>2. Family, Spouse & Dependants Info</span>
                </div>

                {/* Spouse sub-panel */}
                <div className="bg-zinc-50/30 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 space-y-3">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Spouse Details (if applicable)</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Full Names</Label>
                      <Input
                        value={spouseInfo.fullName}
                        onChange={(e) => setSpouseInfo({ ...spouseInfo, fullName: e.target.value })}
                        placeholder="Spouse name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ID Number</Label>
                      <Input
                        value={spouseInfo.idNo}
                        onChange={(e) => setSpouseInfo({ ...spouseInfo, idNo: e.target.value })}
                        placeholder="Spouse national ID"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cell Phone</Label>
                      <Input
                        value={spouseInfo.phone}
                        onChange={(e) => setSpouseInfo({ ...spouseInfo, phone: e.target.value })}
                        placeholder="Phone number"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Occupation</Label>
                      <Input
                        value={spouseInfo.occupation}
                        onChange={(e) => setSpouseInfo({ ...spouseInfo, occupation: e.target.value })}
                        placeholder="e.g. Teacher, Farmer"
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Dependants sub-panel */}
                <div className="bg-zinc-50/30 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 space-y-3">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Dependants Details</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Number of Dependants</Label>
                      <Input
                        type="number"
                        value={dependantsInfo.count}
                        onChange={(e) => setDependantsInfo({ ...dependantsInfo, count: e.target.value })}
                        placeholder="e.g. 3"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ages (comma separated)</Label>
                      <Input
                        value={dependantsInfo.ages}
                        onChange={(e) => setDependantsInfo({ ...dependantsInfo, ages: e.target.value })}
                        placeholder="e.g. 14, 12, 6"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Number of School Going Ones</Label>
                      <Input
                        type="number"
                        value={dependantsInfo.schoolGoing}
                        onChange={(e) => setDependantsInfo({ ...dependantsInfo, schoolGoing: e.target.value })}
                        placeholder="e.g. 2"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">School Name / Details</Label>
                      <Input
                        value={dependantsInfo.school}
                        onChange={(e) => setDependantsInfo({ ...dependantsInfo, school: e.target.value })}
                        placeholder="e.g. Shimanzi Primary School"
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Next of Kin list */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-850 pb-2">
                  <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                    <Users className="size-4" />
                    <span>3. Next of Kin Entries</span>
                  </div>
                  <button
                    type="button"
                    onClick={addNextOfKin}
                    className="text-xs font-semibold text-[#0D44A2] hover:text-[#0A3682] flex items-center gap-1 bg-zinc-55 hover:bg-zinc-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-xl cursor-pointer border border-zinc-100 dark:border-zinc-800"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Next of Kin</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {nextOfKinList.map((kin, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-zinc-50/30 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 relative items-end"
                    >
                      {nextOfKinList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeNextOfKin(idx)}
                          className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Full Names</Label>
                        <Input
                          value={kin.fullName}
                          onChange={(e) => updateNextOfKin(idx, "fullName", e.target.value)}
                          placeholder="Kin full name"
                          className="h-9 rounded-xl bg-white text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Relationship</Label>
                        <Input
                          value={kin.relationship}
                          onChange={(e) => updateNextOfKin(idx, "relationship", e.target.value)}
                          placeholder="e.g. Sister, Son"
                          className="h-9 rounded-xl bg-white text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Cell Phone</Label>
                        <Input
                          value={kin.phone}
                          onChange={(e) => updateNextOfKin(idx, "phone", e.target.value)}
                          placeholder="Kin phone"
                          className="h-9 rounded-xl bg-white text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">National ID No.</Label>
                        <Input
                          value={kin.idNo || ""}
                          onChange={(e) => updateNextOfKin(idx, "idNo", e.target.value)}
                          placeholder="ID number"
                          className="h-9 rounded-xl bg-white text-xs"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2 lg:col-span-1">
                        <Label className="text-[10px] font-bold">Residential Address</Label>
                        <Input
                          value={kin.address || ""}
                          onChange={(e) => updateNextOfKin(idx, "address", e.target.value)}
                          placeholder="Residential address"
                          className="h-9 rounded-xl bg-white text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: Business Details */}
            {step === 4 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                  <Building className="size-4" />
                  <span>4. Business Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Business / Shop Name</Label>
                    <Input
                      value={businessDetails.name}
                      onChange={(e) => setBusinessDetails({ ...businessDetails, name: e.target.value })}
                      placeholder="e.g. Baraka seeds & fertilizers"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Business Type Sector</Label>
                    <select
                      value={businessDetails.type}
                      onChange={(e) => setBusinessDetails({ ...businessDetails, type: e.target.value })}
                      className="w-full h-10 border border-zinc-200/80 bg-zinc-50/50 rounded-xl text-sm px-3 focus:outline-primary dark:bg-zinc-900 dark:border-zinc-850"
                    >
                      <option value="Retail">Retail & general trade</option>
                      <option value="Agriculture">Agriculture</option>
                      <option value="Transport">Logistics & Transport</option>
                      <option value="Construction">Construction</option>
                      <option value="Services">Services / Healthcare</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Years of Operation</Label>
                    <Input
                      type="number"
                      value={businessDetails.yearsOfOperation}
                      onChange={(e) => setBusinessDetails({ ...businessDetails, yearsOfOperation: e.target.value })}
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nearest Landmark</Label>
                    <Input
                      value={businessDetails.landmark}
                      onChange={(e) => setBusinessDetails({ ...businessDetails, landmark: e.target.value })}
                      placeholder="e.g. Next to Mazeras junction"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold">Physical Location Address</Label>
                    <Input
                      value={businessDetails.location}
                      onChange={(e) => setBusinessDetails({ ...businessDetails, location: e.target.value })}
                      placeholder="Physical shop address"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Collateral & Guarantors */}
            {step === 5 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                  <ShieldCheck className="size-4" />
                  <span>5. Collateral Assets & Guarantors</span>
                </div>

                {/* Collateral assets list */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Schedule of Properties / Assets</span>
                    <button
                      type="button"
                      onClick={addProperty}
                      className="text-xs font-semibold text-[#0D44A2] hover:text-[#0A3682] flex items-center gap-1 bg-zinc-55 hover:bg-zinc-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-xl cursor-pointer border border-zinc-100 dark:border-zinc-800"
                    >
                      <Plus className="size-3.5" />
                      <span>Add Asset</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {properties.map((prop, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-zinc-50/30 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 items-end relative"
                      >
                        {properties.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProperty(idx)}
                            className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                        
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold">Item Description</Label>
                          <Input
                            value={prop.description}
                            onChange={(e) => updateProperty(idx, "description", e.target.value)}
                            placeholder="e.g. Double door Fridge"
                            className="h-9 rounded-xl bg-white text-xs"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold">Make/Model</Label>
                          <Input
                            value={prop.makeModel || ""}
                            onChange={(e) => updateProperty(idx, "makeModel", e.target.value)}
                            placeholder="e.g. Samsung"
                            className="h-9 rounded-xl bg-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold">Serial No.</Label>
                          <Input
                            value={prop.serialNo || ""}
                            onChange={(e) => updateProperty(idx, "serialNo", e.target.value)}
                            placeholder="Serial number"
                            className="h-9 rounded-xl bg-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold">Est. Value (KES)</Label>
                          <Input
                            value={prop.estValue}
                            onChange={(e) => updateProperty(idx, "estValue", e.target.value)}
                            placeholder="Est KES value"
                            className="h-9 rounded-xl bg-white text-xs"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guarantor Details */}
                <div className="bg-zinc-50/30 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-850 space-y-4">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Guarantor's Details</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">First Name</Label>
                      <Input
                        value={guarantorDetails.firstName}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, firstName: e.target.value })}
                        placeholder="Guarantor's First Name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Middle Name</Label>
                      <Input
                        value={guarantorDetails.middleName}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, middleName: e.target.value })}
                        placeholder="Guarantor's Middle Name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Surname</Label>
                      <Input
                        value={guarantorDetails.surname}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, surname: e.target.value })}
                        placeholder="Guarantor's Surname"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone Number</Label>
                      <Input
                        value={guarantorDetails.phone}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, phone: e.target.value })}
                        placeholder="Phone number"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Relationship to Applicant</Label>
                      <Input
                        value={guarantorDetails.relationship}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, relationship: e.target.value })}
                        placeholder="e.g. Spouse, Business Partner"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Occupation</Label>
                      <Input
                        value={guarantorDetails.occupation}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, occupation: e.target.value })}
                        placeholder="e.g. Shopkeeper, Teacher"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Period Known to Applicant</Label>
                      <Input
                        value={guarantorDetails.periodKnown}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, periodKnown: e.target.value })}
                        placeholder="e.g. 5 years, 10 months"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">Home Physical Address</Label>
                      <Input
                        value={guarantorDetails.address}
                        onChange={(e) => setGuarantorDetails({ ...guarantorDetails, address: e.target.value })}
                        placeholder="Guarantor's physical address"
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-850 pt-4 mt-8">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="px-4 py-2 border border-zinc-200 hover:bg-zinc-55 disabled:opacity-50 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>

              {step < 5 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 && (!personalInfo.fullName || !personalInfo.phone)) {
                      toast.error("Full Names and Phone Number are required.");
                      return;
                    }
                    setStep((s) => s + 1);
                  }}
                  className="px-4 py-2 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5 focus:outline-none"
                >
                  <span>Continue</span>
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <Button
                  type="submit"
                  disabled={clientMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5 focus:outline-none"
                >
                  {clientMutation.isPending ? (
                    <Loader2 className="animate-spin size-4" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  <span>{clientMutation.isPending ? "Submitting Details..." : "Onboard & Complete"}</span>
                </Button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* 4. SUCCESS ONBOARDING BANNER */}
      {success && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[28px] max-w-md mx-auto shadow-md">
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-3xl mb-6">
            <CheckCircle2 className="size-16" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-55 tracking-tight">
            Client Profile Onboarded
          </h2>
          <p className="text-zinc-500 mt-2 text-sm">
            {personalInfo.fullName} has been successfully registered with full spouse, next-of-kin lists, and property evaluations.
          </p>
          <div className="flex gap-4 mt-8 w-full">
            <Button
              onClick={resetForm}
              className="flex-1 border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 h-10 rounded-xl"
            >
              Clear & Go Back
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setViewMode("directory");
              }}
              className="flex-1 bg-[#0D44A2] hover:bg-[#0A3682] text-white h-10 rounded-xl"
            >
              Client Directory
            </Button>
          </div>
        </div>
      )}

      {/* --- DETAILED SLIDING DRAWER / OVERLAY PANEL --- */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-full max-w-2xl h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-250">
            <div>
              {/* Drawer Header */}
              <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#0D44A2]/10 text-primary rounded-2xl">
                    <User className="size-6 text-[#0D44A2]" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900 dark:text-zinc-50 text-lg">
                      {selectedClient.name}
                    </h3>
                    <p className="text-xs font-mono font-bold text-zinc-400">
                      ID: {selectedClient.id} • Registered {selectedClient.date_registered}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer focus:outline-none"
                >
                  <X className="size-5 text-zinc-500" />
                </button>
              </div>

              {/* Drawer Body - Sections mapping the application */}
              <div className="space-y-6 mt-6 text-xs text-zinc-700 dark:text-zinc-300">
                {/* 1. Personal & Residential details */}
                <div className="space-y-2">
                  <span className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Home className="size-3.5" />
                    <span>Personal & Residency details</span>
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-zinc-50/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">National ID</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.id_no || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">KRA PIN</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.pin || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Cell Phone</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.phone}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Gender / Marital</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">
                        {selectedClient.gender} / {selectedClient.marital_status}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Accommodation</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">
                        {selectedClient.accommodation} ({selectedClient.period_years || "0"} yrs)
                      </span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] text-zinc-400 font-semibold">Residential Address</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.address || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Nearest Landmark</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.landmark || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Business Details */}
                <div className="space-y-2">
                  <span className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Briefcase className="size-3.5" />
                    <span>Business & Trade Operations</span>
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-zinc-50/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Business Name</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.business_name || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Sector Category</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.business_type}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Years of Operation</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.business_years || "0"} Years</span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] text-zinc-400 font-semibold">Physical Location</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.business_location || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Biz Landmark</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.business_landmark || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Family details & Dependants */}
                <div className="space-y-2">
                  <span className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Heart className="size-3.5" />
                    <span>Spouse & Dependants Details</span>
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-zinc-50/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Spouse Name</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.spouse_name || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Spouse Phone</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.spouse_phone || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Dependants Count (Ages)</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">
                        {selectedClient.dependants_count || "0"} Dependant(s) ({selectedClient.dependants_ages || "N/A"})
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Schooling Count</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.school_going_count || "0"} going</span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] text-zinc-400 font-semibold">School Name</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.school_details || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Next of Kin Entries */}
                <div className="space-y-2">
                  <span className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    <span>Next of Kin Registers ({selectedClient.next_of_kin_list?.length || 0})</span>
                  </span>
                  <div className="flex flex-col gap-2">
                    {(!selectedClient.next_of_kin_list || selectedClient.next_of_kin_list.length === 0) ? (
                      <span className="text-zinc-400 text-[11px] italic">No next of kin recorded.</span>
                    ) : (
                      selectedClient.next_of_kin_list.map((kin, i) => (
                        <div key={i} className="flex flex-col sm:flex-row justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/20">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 dark:text-zinc-200">{kin.fullName}</span>
                            <span className="text-[10px] text-zinc-400">Relationship: {kin.relationship} • ID: {kin.idNo || "N/A"}</span>
                          </div>
                          <div className="flex flex-col text-left sm:text-right mt-1 sm:mt-0">
                            <span className="font-mono text-zinc-700 dark:text-zinc-300">{kin.phone}</span>
                            <span className="text-[10px] text-zinc-400">{kin.address || "No address"}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 5. Collateral assets list */}
                <div className="space-y-2">
                  <span className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <FileSpreadsheet className="size-3.5" />
                    <span>Schedule of Collateral Properties</span>
                  </span>
                  <div className="flex flex-col gap-2">
                    {(!selectedClient.properties_list || selectedClient.properties_list.length === 0) ? (
                      <span className="text-zinc-400 text-[11px] italic">No collateral registered.</span>
                    ) : (
                      selectedClient.properties_list.map((prop, i) => (
                        <div key={i} className="flex justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/20">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 dark:text-zinc-200">{prop.description}</span>
                            <span className="text-[10px] text-zinc-400">Model: {prop.makeModel || "N/A"} • Serial: {prop.serialNo || "N/A"}</span>
                          </div>
                          <div className="flex items-center shrink-0">
                            <span className="font-bold text-emerald-600 text-xs">
                              KES {parseFloat(prop.estValue).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 6. Guarantor details */}
                <div className="space-y-2">
                  <span className="text-[#0D44A2] font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" />
                    <span>Assigned Guarantor Details</span>
                  </span>
                  <div className="grid grid-cols-2 gap-3 bg-zinc-50/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Guarantor Name</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">
                        {selectedClient.guarantor_first_name} {selectedClient.guarantor_middle_name || ""} {selectedClient.guarantor_surname}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Guarantor Phone</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.guarantor_phone || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Relationship / Job</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">
                        {selectedClient.guarantor_relationship || "N/A"} / {selectedClient.guarantor_occupation || "N/A"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Period Known</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.guarantor_period_known || "N/A"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-semibold">Guarantor Address</span>
                      <span className="font-bold text-zinc-850 dark:text-zinc-200">{selectedClient.guarantor_address || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Close action */}
            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 mt-6">
              <Button
                onClick={() => setSelectedClient(null)}
                className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 cursor-pointer shadow"
              >
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
