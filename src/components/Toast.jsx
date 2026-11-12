import { useEffect } from 'react';
import { Panel } from './Glass.jsx';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div role="status" aria-live="polite">
      {message && <Panel className="toast" spot={false}>{message}</Panel>}
    </div>
  );
}
