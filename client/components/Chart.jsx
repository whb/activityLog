import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function Chart({ option, height = 300, className = '' }) {
  const ref = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current);
    inst.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); c.dispose(); };
  }, []);

  useEffect(() => {
    if (inst.current && option) inst.current.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={'chart ' + className} style={{ height }} />;
}
