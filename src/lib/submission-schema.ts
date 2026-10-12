import { z } from "zod";
import { getCategory } from "@/lib/categories";

// Shared by the form (client) and the API route (server). The database enforces the same
// limits again with CHECK constraints, so bypassing this code doesn't bypass validation.

export const SUBMISSION_IMAGE_BUCKET = "business-submission-images";
export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const submissionSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the business name").max(120),
  categorySlug: z.string().refine((s) => Boolean(getCategory(s)), "Choose a category"),
  townName: z.string().trim().min(2, "Enter the town or suburb").max(80),
  address: z.string().trim().min(5, "Enter a street address or clear directions").max(200),
  description: z.string().trim().min(20, "Tell people a little more (at least 20 characters)").max(1000),
  contactNumber: z
    .string()
    .trim()
    .regex(/^(\+27|0)[\d\s-]{8,13}$/, "Enter a South African number, e.g. 071 234 5678")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z.string().trim().email("Enter a valid email").max(160).optional().or(z.literal("").transform(() => undefined)),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Website must start with http:// or https://")
    .optional(),
  openingHours: optionalText(200),
  imagePaths: z
    .array(z.string().regex(/^pending\/[0-9a-f-]{36}\/[a-z0-9-]{1,60}\.(jpg|jpeg|png|webp)$/i))
    .max(MAX_IMAGES)
    .default([]),
  isOwner: z.boolean().default(false),
  consent: z.literal(true, { message: "Please confirm the information is accurate" }),
  /** honeypot — real people never fill this in */
  company: z.string().max(0).optional(),
});

export type SubmissionInput = z.input<typeof submissionSchema>;
