import { useLayoutEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
echarts.use([BarChart,GridComponent,LegendComponent,TooltipComponent,SVGRenderer]);
export function DashboardEChart({option,ariaLabel,className='h-72'}:{option:EChartsCoreOption;ariaLabel:string;className?:string}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;const chart=echarts.init(el,undefined,{renderer:'svg'});chart.setOption({...option,animation:false});const observer=new ResizeObserver(()=>chart.resize());observer.observe(el);return()=>{observer.disconnect();chart.dispose();};},[option]);
 return <div ref={ref} className={className} role="img" aria-label={ariaLabel}/>;
}
