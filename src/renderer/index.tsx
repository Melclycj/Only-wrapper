import ReactDOM from 'react-dom/client';
import '../shared/api-types'; // Window.api augmentation

// Fonts FIRST (D-05) — the weights the UI actually uses. Each is the latin
// subset by default with font-display:swap baked into the generated @font-face.
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

// Token layer (D-02) BEFORE the consuming stylesheet, so @font-face + :root vars
// are defined when terminal.css parses.
import './tokens.css';
import './terminal.css';
import './sidebar.css';

import { SessionManager } from './SessionManager';

// v1 (03-02) = the multi-session IDE layout: a basic DESIGN.md sidebar (icon +
// name + live status badge, click-to-switch, add-session) + a viewport stack of
// kept-alive SessionViews. SessionManager owns the session list + activeId and is
// the sole spawn owner (exactly one ptyCreate per add). The old single-pane
// component remains in the tree as the extraction source (no longer mounted)
// until a later cleanup.
const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(<SessionManager />);
