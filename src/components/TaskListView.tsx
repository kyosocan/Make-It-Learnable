import React from 'react';
import { LearningMaterial, StudyPlan, LearningUnit, TaskType } from '../types';
import { CheckCircle2, Circle, BookOpen, FileText, Video, Sparkles, Brain, ClipboardCheck } from 'lucide-react';
import clsx from 'clsx';

interface TaskListViewProps {
  materials: LearningMaterial[];
  plans: StudyPlan[];
  onToggleUnit: (unitId: string, patch?: Partial<LearningUnit>) => void;
  onSelectMaterial: (materialId: string) => void;
  onOpenPdf?: (page?: number, materialId?: string) => void;
}

const TaskListView: React.FC<TaskListViewProps> = ({ 
  materials, 
  plans, 
  onToggleUnit,
  onSelectMaterial,
  onOpenPdf
}) => {
  // 聚合所有计划，按天分组
  const tasksByDay: Record<number, { unit: LearningUnit; material: LearningMaterial | null }[]> = {};
  
  plans.forEach(plan => {
    plan.days.forEach(day => {
      if (!tasksByDay[day.dayIndex]) {
        tasksByDay[day.dayIndex] = [];
      }
      day.units.forEach(unit => {
        const material = materials.find(m => m.id === unit.materialId) || null;
        tasksByDay[day.dayIndex].push({ unit, material });
      });
    });
  });

  const sortedDays = Object.keys(tasksByDay).map(Number).sort((a, b) => a - b);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const getTaskIcon = (type?: TaskType, materialType?: string) => {
    if (type === 'flashcard') return <Brain size={14} className="text-pink-500" />;
    if (type === 'exercise') return <ClipboardCheck size={14} className="text-orange-500" />;
    
    switch (materialType) {
      case 'pdf': return <BookOpen size={14} className="text-blue-500" />;
      case 'exercise': return <FileText size={14} className="text-orange-500" />;
      default: return <BookOpen size={14} className="text-slate-400" />;
    }
  };

  const getTaskBadge = (type?: TaskType) => {
    return '练习';
  };

  if (sortedDays.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
        <p>暂无学习计划，请先上传资料</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 relative before:absolute before:left-[2.25rem] before:top-4 before:bottom-12 before:w-0.5 before:bg-slate-100 before:hidden md:before:block">
      {sortedDays.map(dayIndex => {
        const dayTasks = tasksByDay[dayIndex];
        const dayDate = dayTasks[0]?.unit && (plans.find(p => p.days.some(d => d.dayIndex === dayIndex))?.days.find(d => d.dayIndex === dayIndex)?.date);

        return (
          <div key={dayIndex} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                <h2 className="text-lg font-black text-slate-800">
                  第 {dayIndex} 天
                </h2>
                {dayDate && (
                  <span className="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded-lg">
                    {formatDate(dayDate)}
                  </span>
                )}
              </div>
              <div className="h-[2px] flex-1 bg-slate-100 rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayTasks.map(({ unit, material }) => (
              <div 
                key={unit.id}
                onClick={() => {
                  if (unit.pageNumber && onOpenPdf) {
                    onOpenPdf(unit.pageNumber, material?.id);
                  }
                }}
                className={clsx(
                  "flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer group relative overflow-hidden",
                  unit.status === 'done' 
                    ? "bg-green-50/50 border-green-100 text-green-700" 
                    : "bg-white border-slate-100 text-slate-700 hover:border-primary-200 hover:shadow-md"
                )}
              >
                <div 
                  className="mr-3 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleUnit(unit.id);
                  }}
                >
                  {unit.status === 'done' ? (
                    <CheckCircle2 className="text-green-500" size={24} />
                  ) : (
                    <Circle className="text-slate-200 group-hover:text-primary-300" size={24} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getTaskBadge(unit.type) && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-orange-100 text-orange-600">
                        {getTaskBadge(unit.type)}
                      </span>
                    )}
                    <span className={clsx(
                      "font-bold block flex-1 whitespace-normal break-words leading-snug",
                      unit.status === 'done' && "line-through opacity-50 text-slate-400"
                    )}>
                      {unit.title}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    {material && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMaterial(material.id);
                        }}
                        className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        {getTaskIcon(unit.type, material.type)}
                        <span className="text-[10px] font-bold text-slate-500 whitespace-normal break-words leading-snug max-w-[220px]">
                          {material.title}
                        </span>
                      </div>
                    )}
                    {material?.id.startsWith('m-ai-') && (
                      <Sparkles size={12} className="text-purple-400" />
                    )}
                  </div>
                </div>

                {unit.status !== 'done' && (
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end gap-1">
                    {unit.pageNumber && (
                      <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 mb-1">
                        P.{unit.pageNumber}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-primary-500">点击查看内容</span>
                  </div>
                )}
                {unit.status === 'done' && unit.pageNumber && (
                  <div className="ml-auto text-[9px] font-black text-slate-300">
                    P.{unit.pageNumber}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default TaskListView;

