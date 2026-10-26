import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// Renders an ECharts instance. `onInit` is called once with the ready instance so
// callers can bind their own events (e.g. updateAxisPointer / click) for linkage.
export default function Chart({ option, height = 300, className = '', onInit = null }) {
  const ref = useRef(null);
  const inst = useRef(null);
  const initRef = useRef(onInit);
  initRef.current = onInit;

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current);
    inst.current = c;
    if (initRef.current) initRef.current(c);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); c.dispose(); inst.current = null; };
  }, []);

  useEffect(() => {
    if (inst.current && option) inst.current.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={'chart ' + className} style={{ height }} />;
}
