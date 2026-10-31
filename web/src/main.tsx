import { render } from 'preact';
import './styles/tokens.css';
import './styles/global.css';
import { mode } from './state/store';
import { start } from './state/transport';
import { App } from './views/App';

// The TV scale tokens key off this attribute.
document.documentElement.dataset.mode = mode.value;
start();
render(<App />, document.getElementById('app')!);
