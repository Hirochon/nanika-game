import './style.css';

function setupApp(element: HTMLElement) {
  element.innerHTML = `
    <h1>Nanika Game</h1>
    <p>Welcome to your Vite + TypeScript project!</p>
  `;
}

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  setupApp(app);
}