import type { ContextDocument, SearchHit, SearchInput } from "../domain/context-document.js";

export interface ContextRepository {
  get(id: string, signal: AbortSignal): Promise<ContextDocument | null>;
  search(input: SearchInput, signal: AbortSignal): Promise<SearchHit[]>;
}
