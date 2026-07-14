export function deriveConstraints(basePersona: { constraints?: string[] }, moduleConstraints: string[] = []): string[] {
  const constraints = [ ...(basePersona.constraints ?? []), ...moduleConstraints ];
  return constraints.filter((value, index) => constraints.indexOf(value) === index);
}
