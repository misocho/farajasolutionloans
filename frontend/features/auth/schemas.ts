import { z } from "zod";

export const loginSchema = z.object({
  employee_number: z
    .string()
    .min(1, "Employee number is required"),

  password: z
    .string()
    .min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
