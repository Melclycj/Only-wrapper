import ReactDOM from 'react-dom/client';
import '../shared/api-types'; // Window.api augmentation
import { TerminalPane } from './TerminalPane';
import './terminal.css';

// v1 = a single full-window xterm terminal that auto-starts a live session on
// mount (D-02). No sidebar/tabs chrome yet (Phase 4). TerminalPane owns the
// whole PTY round-trip; this entry just mounts it into #root.
const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(<TerminalPane />);
