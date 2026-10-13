import { Badge, Btn } from './ui';
import { STAGES } from '../data';
import { eventTime, fmtDate, fmtTime, statusOf } from '../lib';
import type { Order } from '../types';

export function Timeline({ order, onSimulate }: { order: Order; onSimulate?: () => void }) {
  const done = order.progress >= 8;
  return (
    <div>
      <ol className="relative">
        {STAGES.map((s, i) => {
          const state = i < order.progress ? 'done' : i === order.progress ? 'now' : 'todo';
          const last = i === STAGES.length - 1;
          return (
            <li key={s.label} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && <span className={'absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 ' + (state === 'done' ? 'bg-emerald-400' : 'bg-slate-200')} />}
              <span className={'z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ' + (state === 'done' ? 'bg-emerald-100' : state === 'now' ? 'animate-pulse bg-indigo-100 ring-4 ring-indigo-200' : 'bg-slate-100 grayscale')}>
                {state === 'done' ? (last ? '🎉' : '✔️') : s.icon}
              </span>
              <div className={'flex-1 ' + (state === 'todo' ? 'opacity-50' : '')}>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold">{s.label}</h4>
                  {state === 'now' && <Badge color="indigo">In Progress</Badge>}
                  {state === 'done' && last && <Badge color="green">Successfully delivered</Badge>}
                </div>
                <p className="text-sm text-slate-500">{s.desc}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                  {state === 'done' ? `${fmtDate(eventTime(order, i))} · ${fmtTime(eventTime(order, i))}` : state === 'now' ? 'Awaiting update…' : 'Pending'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {onSimulate && (
        <div className="mt-6">
          <Btn onClick={onSimulate} disabled={done}>{done ? 'Shipment delivered ✓' : '⏩ Simulate Next Tracking Update'}</Btn>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ o }: { o: Order }) {
  return <Badge color={o.progress >= 8 ? 'green' : o.progress <= 2 ? 'violet' : 'indigo'}>{statusOf(o)}</Badge>;
}
