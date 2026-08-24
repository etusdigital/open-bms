const VARIABLE_PATTERN = /%([A-Za-z0-9_]+)%/g;

const SAMPLE_VALUES: Record<string, string> = {
  NAME: 'Maria',
  FIRSTNAME: 'Maria',
  LASTNAME: 'Silva',
  FULLNAME: 'Maria Silva',
  EMAIL: 'maria@exemplo.com',
  PHONE: '+5511999999999',
  LINK: 'https://exemplo.com',
};

export function extractTemplateVariables(body: string): string[] {
  const names: string[] = [];
  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    const name = match[1].toUpperCase();
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export function toMetaBody(body: string): { text: string; variables: string[]; examples: string[] } {
  const variables = extractTemplateVariables(body);
  const text = body.replace(VARIABLE_PATTERN, (_, name: string) => `{{${variables.indexOf(name.toUpperCase()) + 1}}}`);
  const examples = variables.map((name) => SAMPLE_VALUES[name] ?? 'exemplo');
  return { text, variables, examples };
}
