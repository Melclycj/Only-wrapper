import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../shared/api-types'; // Window.api augmentation

function App() {
  const [version, setVersion] = useState<string>('...');

  useEffect(() => {
    window.api.getVersion().then(setVersion);
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <p>Just-Wrapper v{version}</p>
    </div>
  );
}

const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(<App />);
