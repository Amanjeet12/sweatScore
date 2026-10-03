export function pointsLabel(value: number | undefined, uppercase = false) {
  const label = value === 1 ? 'pt' : 'pts';
  return uppercase ? label.toUpperCase() : label;
}
