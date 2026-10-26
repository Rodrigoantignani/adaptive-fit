import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { useEffect, useRef } from 'preact/hooks';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip, Filler);

Chart.defaults.color = '#9ca3af';
Chart.defaults.borderColor = '#2a303c';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.maintainAspectRatio = false;

export const COLORS = { primary: '#ff9800', info: '#3b82f6', success: '#10b981', danger: '#ef4444', muted: '#9ca3af' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ChartCanvas({ config, height = 230 }: { config: ChartConfiguration<any, any, any>; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, config);
    return () => chart.destroy();
  }, [config]);
  return (
    <div class="chart-wrap" style={{ height }}>
      <canvas ref={ref} />
    </div>
  );
}
