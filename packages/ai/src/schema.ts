import { CONTRACT_VERSION } from "@handwerk/contracts";
import type { EvidenceAuthority, SourceType, Unit } from "@handwerk/contracts";
import { z } from "zod";

const unitSchema = z.enum(["M2", "M", "STK", "STD", "PAUSCHALE"]);
const statusSchema = z.enum([
  "CONFIRMED",
  "UNCERTAIN",
  "UNKNOWN",
  "CONTRADICTORY",
]);
const sourceTypeSchema = z.enum([
  "TRANSCRIPT_SEGMENT",
  "EXPLICIT_MEASUREMENT",
  "USER_ANSWER",
  "COMPANY_RULE",
  "PHOTO_CONTEXT",
]);
const authoritySchema = z.enum(["AUTHORITATIVE", "CONTEXT_ONLY"]);
const prohibitedCommercialKey =
  /(?:price|preis|cost|amount|betrag|commercial|price.?book|approved.?item|item.?code|sku|tax|steuer|currency|währung|waehrung)/i;

export const sourceLocatorSchema = z
  .object({
    sourceType: sourceTypeSchema,
    sourceEntityId: z.string().min(1),
    locator: z.string().min(1),
    authority: authoritySchema,
  })
  .strict()
  .superRefine((locator, context) => {
    if (
      locator.sourceType === "PHOTO_CONTEXT" &&
      locator.authority !== "CONTEXT_ONLY"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["authority"],
        message: "Photo context cannot be authoritative",
      });
    }

    if (
      locator.sourceType === "EXPLICIT_MEASUREMENT" &&
      locator.authority !== "AUTHORITATIVE"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["authority"],
        message: "Explicit measurements must be authoritative",
      });
    }
  });

export const extractedFactSchema = z
  .object({
    key: z.string().min(1).max(100),
    value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    unit: unitSchema.optional(),
    status: statusSchema,
    sourceLocators: z.array(sourceLocatorSchema).min(1),
  })
  .strict()
  .superRefine((fact, context) => {
    if (prohibitedCommercialKey.test(fact.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["key"],
        message: "Commercial and price-book fact keys are prohibited",
      });
    }

    if (Object.hasOwn(fact, "unit") && fact.unit === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unit"],
        message: "Unit must be omitted or contain a supported value",
      });
    }

    if (fact.status === "UNKNOWN" && fact.value !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Unknown facts cannot select a value",
      });
    }

    if (fact.status === "CONFIRMED" && fact.value === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Confirmed facts require a value",
      });
    }

    if (fact.status === "CONTRADICTORY") {
      if (fact.value !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "Contradictory facts cannot select a value",
        });
      }

      const distinctSources = new Set(
        fact.sourceLocators.map(
          (source) =>
            `${source.sourceType}:${source.sourceEntityId}:${source.locator}`,
        ),
      );
      if (distinctSources.size < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceLocators"],
          message: "Contradictory facts require two distinct sources",
        });
      }
    }

    const hasNonPhotoAuthority = fact.sourceLocators.some(
      (source) =>
        source.authority === "AUTHORITATIVE" &&
        source.sourceType !== "PHOTO_CONTEXT",
    );
    if (
      (fact.unit !== undefined || typeof fact.value === "number") &&
      !hasNonPhotoAuthority
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceLocators"],
        message: "Measured facts need a non-photo authoritative source",
      });
    }

    if (
      fact.status === "CONFIRMED" &&
      fact.sourceLocators.every((source) => source.authority === "CONTEXT_ONLY")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Context-only evidence cannot confirm a fact",
      });
    }
  });

export const extractionResultSchema = z
  .object({
    contractVersion: z.literal(CONTRACT_VERSION),
    facts: z.array(extractedFactSchema),
    missingFields: z.array(z.string().min(1).max(100)),
  })
  .strict()
  .superRefine((result, context) => {
    const factKeys = new Set<string>();
    for (const [index, fact] of result.facts.entries()) {
      if (factKeys.has(fact.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["facts", index, "key"],
          message: "Fact keys must be unique",
        });
      }
      factKeys.add(fact.key);
    }

    const missingFields = new Set<string>();
    for (const [index, field] of result.missingFields.entries()) {
      if (prohibitedCommercialKey.test(field)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["missingFields", index],
          message: "Commercial and price-book missing fields are prohibited",
        });
      }
      if (missingFields.has(field)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["missingFields", index],
          message: "Missing fields must be unique",
        });
      }
      missingFields.add(field);
    }
  });

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type ExtractedFactResult = z.infer<typeof extractedFactSchema>;
export type SourceLocatorResult = z.infer<typeof sourceLocatorSchema>;

interface FrozenExtractionResultShape {
  contractVersion: typeof CONTRACT_VERSION;
  facts: Array<{
    key: string;
    value: string | number | boolean | null;
    unit?: Unit | undefined;
    status: "CONFIRMED" | "UNCERTAIN" | "UNKNOWN" | "CONTRADICTORY";
    sourceLocators: Array<{
      sourceType: SourceType;
      sourceEntityId: string;
      locator: string;
      authority: EvidenceAuthority;
    }>;
  }>;
  missingFields: string[];
}

const assertFrozenContractCompatibility = <
  T extends FrozenExtractionResultShape,
>(): void => undefined;
assertFrozenContractCompatibility<ExtractionResult>();

export interface SanitisedValidationIssue {
  code: string;
  path: string;
}

export class ExtractionValidationError extends Error {
  readonly issues: SanitisedValidationIssue[];

  constructor(issues: SanitisedValidationIssue[]) {
    super("AI extraction output failed strict validation");
    this.name = "ExtractionValidationError";
    this.issues = issues;
  }
}

export function parseExtractionResult(raw: unknown): ExtractionResult {
  let candidate = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw) as unknown;
    } catch {
      throw new ExtractionValidationError([
        { code: "invalid_json", path: "$" },
      ]);
    }
  }

  const parsed = extractionResultSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ExtractionValidationError(
      parsed.error.issues.map((issue) => ({
        code: issue.code,
        path:
          issue.path.length === 0
            ? "$"
            : `$.${issue.path.map(String).join(".")}`,
      })),
    );
  }

  return parsed.data;
}
