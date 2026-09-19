import { animate, useMotionValue } from 'motion/react';
import { useEffect, useState } from 'react';

/** Counts smoothly from the previous to the new value (spring-like ease). */
export function AnimatedNumber({
  value,
  format,
  duration = 0.7,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const mv = useMotionValue(value);
  const [text, setText] = useState(() => format(value));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setText(format(v)),
    });
    return () => controls.stop();
  }, [value, mv, duration, format]);

  return <span className="tabular">{text}</span>;
}
