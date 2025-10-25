import state from '../state.js';

export function generateOutline(markdownText) {
  const lines = markdownText.split('\n');
  const outline = [];
  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.*)/);
    if (match) {
      outline.push({
        level: match[1].length,
        text: match[2],
        lineNumber: index,
        collapsed: false,
      });
    }
  });
  return outline;
}

export function renderOutline(outline) {
  const list = document.getElementById('outline-list');
  if (!list) return;
  list.innerHTML = '';
  const stack = [];

  outline.forEach((item) => {
    const li = document.createElement('li');
    li.style.paddingLeft = (item.level - 1) * 10 + 'px';
    li.textContent = item.text;
    li.dataset.lineNumber = item.lineNumber;
    li.dataset.level = item.level;

    li.addEventListener('click', () => {
      if (state.editor) {
        state.editor.focus();
        state.editor.setCursor({ line: item.lineNumber, ch: 0 });
        state.editor.scrollIntoView({ line: item.lineNumber, ch: 0 }, 100);
      }
    });

    li.addEventListener('dblclick', () => {
      item.collapsed = !item.collapsed;
      renderOutline(outline);
    });

    li.classList.toggle('collapsed', item.collapsed);

    let visible = true;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].collapsed && item.level > stack[i].level) {
        visible = false;
        break;
      } else if (item.level <= stack[i].level) {
        stack.splice(i);
      }
    }

    if (visible) list.appendChild(li);
    stack.push(item);
  });
}

export function highlightCurrentHeading() {
  if (!state.editor) return;
  const listItems = document.querySelectorAll('#outline-list li');
  const cursor = state.editor.getCursor().line;
  listItems.forEach((li) => li.classList.remove('active'));
  let current = null;
  listItems.forEach((li) => {
    if (parseInt(li.dataset.lineNumber) <= cursor) current = li;
  });
  if (current) current.classList.add('active');
}

function setupOutline() {
  if (!state.editor) return;
  const render = () => {
    const outline = generateOutline(state.editor.getValue());
    renderOutline(outline);
    highlightCurrentHeading();
  };
  state.editor.on('change', render);
  state.editor.on('cursorActivity', highlightCurrentHeading);
  render();
}

export function setupOutlineWhenReady() {
  if (state.editor) {
    setupOutline();
  } else {
    setTimeout(setupOutlineWhenReady, 100);
  }
}
