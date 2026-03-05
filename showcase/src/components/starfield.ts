/**
 * Creates a CSS star field — scattered dots with varying opacity/size.
 */
export function createStarfield(container: HTMLElement, count: number): void {
  const field = document.createElement('div');
  field.className = 'starfield';

  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    const bright = Math.random() > 0.85;
    star.className = bright ? 'star star--bright' : 'star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.opacity = `${0.15 + Math.random() * (bright ? 0.5 : 0.35)}`;
    field.appendChild(star);
  }

  container.appendChild(field);
}
