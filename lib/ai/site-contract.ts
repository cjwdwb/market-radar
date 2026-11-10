import { z } from "zod";
import { PrivateInterpretationSchema, validateFrozenInterpretation } from "./private-contract";

// Browser-safe wire identities. A site pilot is not a normal-production spending policy.
export const SiteInterpretationSchema = PrivateInterpretationSchema.extend({
  format: z.literal("site-interpretation-v1"), deploymentMode: z.literal("site_pilot"),
}).strict();
export type SiteInterpretation = z.infer<typeof SiteInterpretationSchema>;
export function parseSiteInterpretation(input: unknown): SiteInterpretation {
  const result = SiteInterpretationSchema.parse(input);
  validateFrozenInterpretation(result);
  return result;
}
export const SiteCapabilitySchema = z.object({
  format: z.literal("site-ai-capability-v1"), mode: z.literal("site_controlled"), auth: z.literal("site_session"),
  deploymentMode: z.literal("site_pilot"), admission: z.enum(["ready", "blocked"]), reason: z.string().regex(/^[a-z_]{1,80}$/).optional(),
  allowedSymbols: z.array(z.literal("BTC-USDT")).max(1), realProviderEnabled: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (value.admission === "ready" ? !value.realProviderEnabled || value.allowedSymbols.length !== 1 || value.reason !== undefined : value.realProviderEnabled || !value.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_capability" });
  }
});
export type SiteCapability = z.infer<typeof SiteCapabilitySchema>;
export const parseSiteCapability = (input: unknown): SiteCapability => SiteCapabilitySchema.parse(input);
