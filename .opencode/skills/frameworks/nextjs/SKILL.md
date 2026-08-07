---
name: nextjs
description: HumbleBee Next.js + shadcn/ui frontend conventions — App Router, server components, shadcn components, styling, and accessibility.
---

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + **shadcn/ui** components.

## Conventions

- **App Router** under `app/`; prefer **Server Components** by default and add `"use client"` only
  where interactivity actually needs it.
- **shadcn/ui**: add components with `npx shadcn@latest add <component>`; keep primitives in
  `components/ui/` and compose app components on top — don't fork the primitives unless necessary.
- **Tailwind** for styling; use the design tokens / CSS variables shadcn sets up rather than ad-hoc colors.
- **Data fetching** in Server Components / route handlers; keep secrets server-side, never in client bundles.
- **`next/image`**, **`next/font`**, and **`next/link`** instead of raw tags for images, fonts, and navigation.
- **Accessibility**: semantic elements, labels, visible focus states, and keyboard support on every interactive control.
- **TypeScript strict**; type props and API responses — no `any` at boundaries.

## Use with

Load alongside the `frontend` and `testing` skills. Use the `playwright` MCP to verify flows in a real browser.
