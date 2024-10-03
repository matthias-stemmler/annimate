// Highlighting of elements for screenshots in the manual
// Activate by uncommenting the corresponding `<script>` element in `index.html`

interface Window {
  h: (el: HTMLElement) => void;
}

type Action = {
  type: 'highlight' | 'unhighlight';
  el: HTMLElement;
};

const actions: Action[] = [];

let id = 0;
let paddingPx = 5;

const highlight = (el: HTMLElement, options: { history?: boolean } = {}) => {
  id++;
  el.dataset.highlightId = `${id}`;

  const bounds = el.getBoundingClientRect();

  const highlight = document.createElement('div');
  highlight.id = `highlight-${id}`;
  highlight.style.zIndex = '99999';
  highlight.style.pointerEvents = 'none';
  highlight.style.border = '2px dashed red';
  highlight.style.borderRadius = '6px';
  highlight.style.position = 'fixed';
  highlight.style.left = `${bounds.left - paddingPx}px`;
  highlight.style.top = `${bounds.top - paddingPx}px`;
  highlight.style.width = `${bounds.width + 2 * paddingPx}px`;
  highlight.style.height = `${bounds.height + 2 * paddingPx}px`;
  document.body.appendChild(highlight);

  if (options.history) {
    actions.push({ type: 'highlight', el });
  }
};

const unhighlight = (el: HTMLElement, options: { history?: boolean } = {}) => {
  const existingHighlightId = el.dataset.highlightId;
  if (existingHighlightId === undefined) {
    return false;
  }

  delete el.dataset.highlightId;

  const existingHighlight = document.getElementById(
    `highlight-${existingHighlightId}`,
  );

  if (existingHighlight !== null) {
    existingHighlight.remove();
  }

  if (options.history) {
    actions.push({ type: 'unhighlight', el });
  }

  return true;
};

const toggleHighlight = (el: HTMLElement) => {
  if (!unhighlight(el, { history: true })) {
    highlight(el, { history: true });
  }
};

window.addEventListener('click', (event) => {
  if (event.target instanceof HTMLElement && event.ctrlKey) {
    event.preventDefault();
    toggleHighlight(event.target);
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'u' && event.ctrlKey) {
    event.preventDefault();

    const action = actions.pop();
    if (action !== undefined) {
      if (action.type === 'highlight') {
        unhighlight(action.el, { history: false });
      } else {
        highlight(action.el, { history: false });
      }
    }
  }

  if (event.key === 'ArrowUp' && event.ctrlKey) {
    paddingPx++;
    console.log(`Increased highlight padding to ${paddingPx}px`);
  }

  if (event.key === 'ArrowDown' && event.ctrlKey && paddingPx > 0) {
    paddingPx--;
    console.log(`Decreased highlight padding to ${paddingPx}px`);
  }
});

window.h = toggleHighlight;
