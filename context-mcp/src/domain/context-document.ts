import { z } from "zod";

export const metadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  repository: z.string().min(1),
  kind: z.enum(["repository", "standard", "contract", "policy", "decision"]).default("contract"),
  path: z.string().min(1),
  uri: z.string().min(1),
  owner: z.string().min(1),
  version: z.string().min(1),
  updatedAt: z.iso.date(),
  status: z.enum(["active", "deprecated"]),
  supersededBy: z.string().nullable(),
  keywords: z.array(z.string()),
  summary: z.string(),
});

export const documentSchema = metadataSchema.extend({
  content: z.string(),
  sha256: z.string(),
  warning: z.string().nullable(),
});

export type Metadata = z.infer<typeof metadataSchema>;
export type ContextDocument = z.infer<typeof documentSchema>;

export interface SearchInput {
  query: string;
  repository?: string | undefined;
  includeDeprecated?: boolean | undefined;
  limit: number;
}

export interface SearchHit extends Metadata {
  score: number;
  excerpt: string;
}
