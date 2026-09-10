// The single normalization used everywhere a quote is compared with page text.
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/­/g, "") // soft hyphen
    .replace(/[‐‑‒−]/g, "-") // hyphen and minus variants (en/em dashes are kept)
    .replace(/\s+/g, " ")
    .trim();
}
