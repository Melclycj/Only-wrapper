import ReactDOM from 'react-dom/client';
import '../shared/api-types'; // Window.api augmentation
import { SessionManager } from './SessionManager';
import './terminal.css';

// v1 (03-02) = the multi-session IDE layout: a basic DESIGN.md sidebar (icon +
// name + live status badge, click-to-switch, add-session) + a viewport stack of
// kept-alive SessionViews. SessionManager owns the session list + activeId and is
// the sole spawn owner (exactly one ptyCreate per add). The old single-pane
// component remains in the tree as the extraction source (no longer mounted)
// until a later cleanup.
const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(<SessionManager />);
