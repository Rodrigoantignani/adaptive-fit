import { render } from 'preact';
import { App } from './app';
import { loadState } from './data/store';
import { setupPwa } from './pwa';
import './styles.css';

setupPwa();
void loadState();
render(<App />, document.getElementById('app')!);
