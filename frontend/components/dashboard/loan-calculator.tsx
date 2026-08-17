"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Loader2, Minus } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fetchLoanProductsApi, fetchLoanQuoteApi, type LoanProduct, type LoanQuote } from "@/features/clients/api";
import { formatKES } from "@/app/lib/format";

// ── Loan Calculator ──────────────────────────────────────────────────────────
// Floating widget on the dashboard. Estimates come from GET /loan-products/{id}/quote
// (the same math used at disbursement) — rate and installments come from the
// product plan, never edited here.

const MIN_AMOUNT = 4000;

const fmtPct = (rate: number) => `${(rate * 100).toFixed(0)}%`;

export function LoanCalculator() {
  const [open, setOpen] = useState(true);
  const [amount, setAmount] = useState("");
  const [productId, setProductId] = useState("");
  const [clientType, setClientType] = useState<"new" | "existing">("new");
  const [result, setResult] = useState<LoanQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["loan-products"],
    queryFn: fetchLoanProductsApi,
  });

  const product = products.find((p: LoanProduct) => p.id === productId);

  const handleCalculate = async () => {
    const amountNum = Number(amount);
    setError(null);

    if (!Number.isFinite(amountNum) || amountNum < MIN_AMOUNT) {
      setError(`Enter an amount of KES ${MIN_AMOUNT.toLocaleString()} or more`);
      setResult(null);
      return;
    }
    if (!productId) {
      setError("Select a loan product first");
      setResult(null);
      return;
    }

    setLoading(true);
    try {
      const quote = await fetchLoanQuoteApi(productId, amountNum);
      setResult(quote);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not calculate the estimate. Try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setResult(null);
    setError(null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open loan calculator"
        className="fixed bottom-4 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors cursor-pointer hover:bg-[#0A3682]"
      >
        <Calculator className="size-5" />
      </button>
    );
  }

  const fee = result ? (clientType === "new" ? result.application_fee_new : result.application_fee_existing) : null;

  const resultRows = result
    ? [
        { label: "Interest (flat)", value: formatKES(result.interest_amount) },
        { label: "Total repayable", value: formatKES(result.total_repayable) },
        { label: `Weekly installment × ${result.num_installments}`, value: formatKES(result.installment_amount) },
      ]
    : [
        { label: "Interest (flat)", value: "—" },
        { label: "Total repayable", value: "—" },
        { label: "Weekly installment", value: "—" },
      ];

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm select-text">
      <div className="flex flex-col gap-3.5 rounded-[20px] sm:rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col text-left">
            <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50">
              <span className="rounded-xl bg-[#0D44A2]/10 p-1.5 text-[#0D44A2]">
                <Calculator className="size-4" />
              </span>
              Loan Calculator
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
              Estimate repayments for a new loan
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse loan calculator"
            className="cursor-pointer rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Minus className="size-4 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Loan amount (KES)</Label>
          <Input
            type="number"
            min={MIN_AMOUNT}
            value={amount}
            onChange={handleInputChange(setAmount)}
            placeholder="e.g. 50000"
            className="h-10 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Loan product</Label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setResult(null);
              setError(null);
            }}
            className="h-10 w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">Select product…</option>
            {products.map((p: LoanProduct) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.duration_days} days @ {(p.interest_rate * 100).toFixed(0)}%
              </option>
            ))}
          </select>
        </div>

        {product && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[#0D44A2]/5 px-3 py-2 text-[11px] font-semibold text-[#0D44A2] dark:bg-[#0D44A2]/10">
            <span>{fmtPct(product.interest_rate)} flat interest</span>
            <span aria-hidden="true">·</span>
            <span>{Math.max(1, Math.floor(product.duration_days / 7))} weekly installments</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleCalculate}
          disabled={loading}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-white transition-colors hover:bg-[#0A3682] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Calculating…" : "Calculate estimate"}
        </button>

        <div className="space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Estimate</p>
          {error ? (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          ) : (
            <>
              {resultRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">{row.label}</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-100">{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400">Application fee</span>
                <span className="font-black text-zinc-900 dark:text-zinc-100">
                  {fee != null ? formatKES(fee) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-zinc-400">Client type</span>
                <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
                  {(["new", "existing"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setClientType(t)}
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold capitalize transition-colors cursor-pointer ${
                        clientType === t
                          ? "bg-white text-[#0D44A2] shadow-sm dark:bg-zinc-700 dark:text-white"
                          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <p className="border-t border-zinc-100 pt-1 text-[10px] text-zinc-400 dark:border-zinc-800">
            Estimates only — final figures are confirmed at application.
          </p>
        </div>
      </div>
    </div>
  );
}
