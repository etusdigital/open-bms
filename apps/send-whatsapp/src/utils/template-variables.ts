const VARIABLE_PATTERN = /%([A-Za-z0-9_]+)%/g;
const EMPTY_PARAMETER_FALLBACK = '-';

export function extractTemplateVariables(body: string): string[] {
  const names: string[] = [];
  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    const name = match[1].toUpperCase();
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export function extractTemplateBody(content?: string | null): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed.body ?? '') : content;
  } catch {
    return content;
  }
}

export function sanitizeParameterText(value: unknown): string {
  const text = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim();
  return text || EMPTY_PARAMETER_FALLBACK;
}
