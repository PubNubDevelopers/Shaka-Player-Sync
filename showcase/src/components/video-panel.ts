/**
 * Floating video player panel — glass-morphism card with progress bar.
 */

export interface VideoPanelConfig {
  city: string;
  isHost: boolean;
  /** 0–1 progress position */
  progress: number;
  /** Display time string e.g. "1:23" */
  timeStr: string;
  /** 'playing' | 'paused' | 'buffering' */
  state: 'playing' | 'paused' | 'buffering';
  /** CSS left */
  x: number;
  /** CSS top */
  y: number;
}

export function createVideoPanel(config: VideoPanelConfig): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'video-panel';
  if (config.state === 'buffering' || config.state === 'paused') {
    panel.classList.add('warning');
  }
  panel.style.left = `${config.x}px`;
  panel.style.top = `${config.y}px`;
  panel.style.opacity = '0';

  // Thumbnail area
  const thumb = document.createElement('div');
  thumb.className = 'video-panel__thumb';

  // Animated waveform bars (faux video playing indicator)
  const barsContainer = document.createElement('div');
  barsContainer.className = 'video-panel__thumb-bars';
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement('div');
    bar.className = `video-panel__thumb-bar${config.state === 'playing' ? ' active' : ''}`;
    barsContainer.appendChild(bar);
  }
  thumb.appendChild(barsContainer);

  // Buffering spinner
  const spinner = document.createElement('div');
  spinner.className = `video-panel__spinner${config.state === 'buffering' ? ' visible' : ''}`;
  const ring = document.createElement('div');
  ring.className = 'video-panel__spinner-ring';
  spinner.appendChild(ring);
  thumb.appendChild(spinner);

  // Paused icon
  const pausedIcon = document.createElement('div');
  pausedIcon.className = `video-panel__paused-icon${config.state === 'paused' ? ' visible' : ''}`;
  pausedIcon.textContent = '⏸';
  thumb.appendChild(pausedIcon);

  panel.appendChild(thumb);

  // Progress bar
  const progressContainer = document.createElement('div');
  progressContainer.className = 'video-panel__progress';

  const progressFill = document.createElement('div');
  progressFill.className = 'video-panel__progress-fill';
  progressFill.style.width = `${config.progress * 100}%`;
  progressContainer.appendChild(progressFill);

  const progressHead = document.createElement('div');
  progressHead.className = 'video-panel__progress-head';
  progressHead.style.left = `${config.progress * 100}%`;
  progressContainer.appendChild(progressHead);

  panel.appendChild(progressContainer);

  // Info row
  const info = document.createElement('div');
  info.className = 'video-panel__info';

  const cityEl = document.createElement('div');
  cityEl.className = 'video-panel__city';
  const dot = document.createElement('span');
  dot.className = `video-panel__city-dot${config.isHost ? ' host' : ''}`;
  cityEl.appendChild(dot);
  const cityName = document.createElement('span');
  cityName.textContent = config.isHost ? `👑 ${config.city}` : config.city;
  cityEl.appendChild(cityName);
  info.appendChild(cityEl);

  const timeEl = document.createElement('div');
  timeEl.className = 'video-panel__time';
  timeEl.textContent = config.timeStr;
  info.appendChild(timeEl);

  panel.appendChild(info);

  // Store refs as data attributes for later animation
  panel.dataset.city = config.city;

  return panel;
}

/**
 * Gets the progress fill + head elements for animating.
 */
export function getProgressElements(panel: HTMLElement) {
  return {
    fill: panel.querySelector('.video-panel__progress-fill') as HTMLElement,
    head: panel.querySelector('.video-panel__progress-head') as HTMLElement,
    time: panel.querySelector('.video-panel__time') as HTMLElement,
    panel,
  };
}
