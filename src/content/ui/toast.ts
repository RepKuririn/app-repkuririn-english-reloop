const TOAST_DURATION = 3000;
const TOAST_CONTAINER_ID = 'sl-toast-container';

/**
 * Show a toast notification
 */
export function showToast(message: string): void {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'sl-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'sl-toast';
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('sl-toast-show');
  });

  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('sl-toast-show');
    toast.classList.add('sl-toast-hide');

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, TOAST_DURATION);
}
