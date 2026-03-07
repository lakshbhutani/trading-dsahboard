import React from 'react';
import './ConnectionStatus.css';

interface Props {
  status: 'connected' | 'reconnecting' | 'disconnected';
}

const ConnectionStatus: React.FC<Props> = ({ status }) => {
  return (
    <div className={`conn-status ${status}`}>{status.toUpperCase()}</div>
  );
};

export default ConnectionStatus;