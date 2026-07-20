import React from "react";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AppLogo({ className, iconOnly = false, size = "md" }: AppLogoProps) {
  const sizeClasses = {
    sm: { icon: "h-8 w-8", text: "text-lg" },
    md: { icon: "h-12 w-12", text: "text-2xl" },
    lg: { icon: "h-16 w-16", text: "text-3xl" },
  };

  const selectedSize = sizeClasses[size];

  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      {/* SVG Shield Logo */}
      <svg
        className={cn(selectedSize.icon, "shrink-0")}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield Body (Blue: #0D44A2) */}
        <path
          d="M10 20C10 20 60 10 110 20C110 50 110 85 60 110C10 85 10 50 10 20Z"
          fill="#0D44A2"
        />

        {/* Handshake Icon (White) */}
        {/* Left hand sleeve/wrist */}
        <path
          d="M25 45H32V57H25V45Z"
          fill="white"
        />
        {/* Right hand sleeve/wrist */}
        <path
          d="M88 45H95V57H88V45Z"
          fill="white"
        />
        {/* Stylized Handshake fingers and clasp */}
        <path
          d="M36 43C36 40.7909 37.7909 39 40 39H48C50.2091 39 52 40.7909 52 43V59C52 61.2091 50.2091 63 48 63H40C37.7909 63 36 61.2091 36 59V43Z"
          fill="white"
        />
        <path
          d="M54 47C54 44.7909 55.7909 43 58 43H66C68.2091 43 70 44.7909 70 47V63C70 65.2091 68.2091 67 66 67H58C55.7909 67 54 65.2091 54 63V47Z"
          fill="white"
        />
        {/* Connection fingers clasp details */}
        <path
          d="M48 45H72V52H48V45Z"
          fill="white"
        />
        <path
          d="M42 51H78V57H42V51Z"
          fill="white"
        />
        <path
          d="M45 56H75V62H45V56Z"
          fill="white"
        />

        {/* Upward Zig-Zag Arrow (Orange: #F57424) */}
        <path
          d="M20 90L45 65L65 75L102 38"
          stroke="#F57424"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Arrow Head */}
        <path
          d="M87 37H104V54"
          stroke="#F57424"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Typography: FARAJA $OLUTIONS */}
      {!iconOnly && (
        <div className="flex flex-col leading-none font-sans font-extrabold tracking-tight">
          <span className="text-[#0D44A2] block uppercase" style={{ fontSize: size === "sm" ? "14px" : size === "md" ? "20px" : "28px" }}>
            Faraja
          </span>
          <span className="text-[#F57424] block uppercase" style={{ fontSize: size === "sm" ? "14px" : size === "md" ? "20px" : "28px", marginTop: "2px" }}>
            $olutions
          </span>
        </div>
      )}
    </div>
  );
}
