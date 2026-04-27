/**
 * Strips HTML tags and Markdown formatting from a string.
 * Also removes image tags and markdown image syntax.
 */
export function stripFormatting(text: string): string {
  if (!text) return "";

  // 1. Remove HTML tags (including images)
  let result = text.replace(/<[^>]*>/g, " ");

  // 2. Remove Markdown images: ![alt](url)
  result = result.replace(/!\[.*?\]\(.*?\)/g, " ");

  // 3. Remove Markdown links: [text](url) -> text
  result = result.replace(/\[(.*?)\]\(.*?\)/g, "$1");

  // 4. Remove Markdown bold/italic: **bold**, *italic*, __bold__, _italic_
  result = result.replace(/(\*\*|__)(.*?)\1/g, "$2");
  result = result.replace(/(\*|_)(.*?)\1/g, "$2");

  // 5. Remove Markdown code blocks and inline code
  result = result.replace(/`{3,}.*?`{3,}/gs, " ");
  result = result.replace(/`(.+?)`/g, "$1");

  // 6. Remove Markdown headings
  result = result.replace(/^#+\s+/gm, "");

  // 7. Cleanup whitespace
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

/**
 * Parses a comma-separated tag string into a clean array of tags.
 */
export function parseTags(tagStr: string | null): string[] {
  if (!tagStr) return [];
  return tagStr
    .split(",")
    .map(t => t.trim())
    .filter(t => t && t !== "");
}

/**
 * Extracts all unique tags from a list of items that have a 'tag' property.
 */
export function getUniqueTags(items: { tag?: string | null }[]): string[] {
  const tags = new Set<string>();
  items.forEach(item => {
    parseTags(item.tag).forEach(t => tags.add(t));
  });
  return Array.from(tags).sort();
}
