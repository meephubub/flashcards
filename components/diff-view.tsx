import { diffChars, Change } from 'diff';
import React from 'react';

interface DiffViewProps {
  oldValue: string;
  newValue: string;
}

const DiffView: React.FC<DiffViewProps> = ({ oldValue, newValue }) => {
  const differences = diffChars(oldValue, newValue);

  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'monospace', fontSize: '0.875em' }}>
      {differences.map((part, index) => {
        const style: React.CSSProperties = {};
        if (part.added) {
          style.backgroundColor = 'rgba(46, 160, 67, 0.2)'; // Light green background
          style.color = '#3fb950'; // Green text
        } else if (part.removed) {
          style.backgroundColor = 'rgba(248, 81, 73, 0.2)'; // Light red background
          style.color = '#f85149'; // Red text
          style.textDecoration = 'line-through';
        } else {
          style.color = 'inherit'; // Default text color (e.g., text-neutral-300 or similar)
        }
        return (
          <span key={index} style={style}>
            {part.value}
          </span>
        );
      })}
    </pre>
  );
};

export default DiffView;
