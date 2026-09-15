import { useLayoutEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, SVGRenderer]);

export function WeaknessEChart({ option, className = '', ariaLabel }: {
  option: EChartsCoreOption;
  className?: string;
  ariaLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ensureRef = useRef<(() => void) | null>(null);
  const optionRef = useRef(option);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let chart: ReturnType<typeof echarts.init> | undefined;
    let appliedOption: EChartsCoreOption | undefined;
    let frame = 0;
    const ensure = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) return;
      chart ??= echarts.getInstanceByDom(container) ?? echarts.init(container, undefined, {
        renderer: 'svg', width, height,
      });
      if (appliedOption !== optionRef.current) {
        chart.setOption({ ...optionRef.current, animation: false }, { notMerge: true, lazyUpdate: false });
        appliedOption = optionRef.current;
      }
      chart.resize({ width, height, animation: { duration: 0 } });
    };
    const resizeForPrint = () => {
      ensure();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(ensure);
    };
    ensureRef.current = ensure;
    const observer = new ResizeObserver(ensure);
    observer.observe(container);
    const printMedia = window.matchMedia('print');
    printMedia.addEventListener('change', resizeForPrint);
    window.addEventListener('beforeprint', resizeForPrint);
    window.addEventListener('afterprint', resizeForPrint);
    ensure();
    return () => {
      ensureRef.current = null;
      observer.disconnect();
      printMedia.removeEventListener('change', resizeForPrint);
      window.removeEventListener('beforeprint', resizeForPrint);
      window.removeEventListener('afterprint', resizeForPrint);
      cancelAnimationFrame(frame);
      chart?.dispose();
    };
  }, []);

  useLayoutEffect(() => {
    optionRef.current = option;
    ensureRef.current?.();
  }, [option]);

  return <div ref={containerRef} className={`weakness-echart ${className}`} role="img" aria-label={ariaLabel} />;
}
