import React, { useState, useEffect } from 'react';

export default function WaitingTimer({ timestamp, className }: { timestamp: any, className?: string }) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const calculate = () => {
      if (!timestamp) return;
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const diff = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60));
      setMinutes(Math.max(0, diff));
    };

    calculate();
    // Update every 30 seconds to keep it fresh
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span className={className}>{minutes} min</span>;
}
