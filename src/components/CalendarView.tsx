import React, { useState } from 'react';
import { LearningMaterial, StudyPlan, LearningUnit } from '../types';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface CalendarViewProps {
  materials: LearningMaterial[];
  plans: StudyPlan[];
  onToggleUnit: (unitId: string, patch?: Partial<LearningUnit>) => void;
  onOpenPdf?: (page?: number, materialId?: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ materials, plans, onToggleUnit, onOpenPdf }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // 获取当月第一天
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  // 获取当月最后一天
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // 日历起始：当月第一天所在的周日（或周一，这里用周日）
  const startDay = new Date(firstDayOfMonth);
  startDay.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

  // 日历结束：当月最后一天所在的周六
  const endDay = new Date(lastDayOfMonth);
  endDay.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()));

  const days: Date[] = [];
  let day = new Date(startDay);
  while (day <= endDay) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  // 聚合任务到日期
  const tasksByDate: Record<string, { unit: LearningUnit; material: LearningMaterial | null }[]> = {};
  plans.forEach(plan => {
    plan.days.forEach(d => {
      const dateKey = d.date;
      if (dateKey) {
        if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
        d.units.forEach(u => {
          const material = materials.find(m => m.id === u.materialId) || null;
          tasksByDate[dateKey].push({ unit: u, material });
        });
      }
    });
  });

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="flex flex-col h-full bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-8 py-6 border-b">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <p className="text-sm font-bold text-slate-400">学习计划月视图</p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
            <ChevronLeft size={24} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b">
        {weekDays.map(d => (
          <div key={d} className="py-3 text-center text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
            {d}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 overflow-y-auto custom-scrollbar">
        {days.map((date, i) => {
          const dateStr = date.toISOString().split('T')[0];
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const isToday = new Date().toISOString().split('T')[0] === dateStr;
          const tasks = tasksByDate[dateStr] || [];

          return (
            <div 
              key={i} 
              className={clsx(
                "min-h-[120px] p-2 border-r border-b group transition-colors",
                !isCurrentMonth ? "bg-slate-50/30" : "bg-white",
                (i + 1) % 7 === 0 && "border-r-0"
              )}
            >
              <div className="flex justify-between items-center mb-1 px-1">
                <span className={clsx(
                  "text-sm font-black w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                  isToday ? "bg-primary-500 text-white shadow-lg shadow-primary-100" : isCurrentMonth ? "text-slate-800" : "text-slate-300"
                )}>
                  {date.getDate()}
                </span>
                {tasks.length > 0 && (
                  <span className="text-[10px] font-black text-slate-300">
                    {tasks.filter(t => t.unit.status === 'done').length}/{tasks.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {tasks.slice(0, 3).map((t, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (t.unit.pageNumber && onOpenPdf) {
                        onOpenPdf(t.unit.pageNumber, t.material?.id);
                      } else {
                        onToggleUnit(t.unit.id);
                      }
                    }}
                    className={clsx(
                      "px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-start justify-between gap-2 group/task whitespace-normal break-words",
                      t.unit.status === 'done' 
                        ? "bg-green-50 text-green-600 line-through opacity-60" 
                        : "bg-primary-50 text-primary-600 hover:scale-105"
                    )}
                    title={t.unit.title}
                  >
                    <div className="flex-1 whitespace-normal break-words leading-snug">
                      {t.unit.status === 'done' && <CheckCircle2 size={10} className="inline mr-1" />}
                      {t.unit.title}
                    </div>
                    {t.unit.pageNumber && (
                      <span className="text-[8px] opacity-0 group-hover/task:opacity-100 ml-1 font-black bg-white/50 px-1 rounded">P{t.unit.pageNumber}</span>
                    )}
                  </div>
                ))}
                {tasks.length > 3 && (
                  <div className="text-[10px] text-slate-300 font-bold px-2">
                    还有 {tasks.length - 3} 个任务...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;

