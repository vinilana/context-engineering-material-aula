const stopwords = new Set(["a", "as", "o", "os", "de", "do", "da", "dos", "das", "e", "em", "um", "uma", "para", "com", "por", "the", "of", "and", "to", "in", "for"]);

export function contextSearchTerms(text: string): string[] {
  return [...new Set(text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().match(/[a-z0-9]+/g) ?? [])]
    .filter((word) => word.length > 1 && !stopwords.has(word)).slice(0, 64);
}
