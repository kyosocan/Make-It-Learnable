import React from 'react';
import { LearningMaterial } from '../types';
import { BookOpen, FileText, ChevronRight, Sparkles, Trash2, PlusCircle } from 'lucide-react';
import clsx from 'clsx';

interface MaterialCardProps {
  material: LearningMaterial;
  onSelect: () => void;
  onDelete?: () => void;
  onAddToPlan?: () => void;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ material, onSelect, onDelete, onAddToPlan }) => {
  const doneCount = material.units.filter(u => u.status === 'done').length;
  const isParsing = material.status === 'parsing';
  const progress = material.totalUnits > 0 ? Math.round((doneCount / material.totalUnits) * 100) : 0;
  const parsingProgress = material.parsingProgress || 0;
  const isAIProcessed = material.id.startsWith('m-ai-');

  const getIcon = () => {
    switch (material.type) {
      case 'pdf': return <BookOpen className="text-blue-500" />;
      case 'exercise': return <FileText className="text-orange-500" />;
      default: return <BookOpen className="text-slate-400" />;
    }
  };

  const getLabel = () => {
    if (isAIProcessed) return 'AI 智能解析';
    switch (material.type) {
      case 'pdf': return 'PDF 教材';
      case 'exercise': return '练习集';
      default: return '学习资料';
    }
  };

  return (
    <div 
      onClick={isParsing ? undefined : onSelect}
      className={clsx(
        "bg-white rounded-[32px] p-8 border-2 transition-all relative overflow-hidden group h-[280px] flex flex-col",
        isParsing ? "opacity-80 grayscale cursor-wait border-slate-100" : "hover:border-primary-400 cursor-pointer shadow-sm hover:shadow-xl border-transparent"
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(220%); }
        }
      `}} />
      
      {onDelete && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 z-10"
        >
          <Trash2 size={18} />
        </button>
      )}

      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-primary-50 transition-colors shrink-0">
          {getIcon()}
        </div>
        <div className="flex flex-col min-w-0">
          <span className={clsx(
            "text-[10px] font-black px-2 py-0.5 rounded-full w-fit mb-1 shrink-0",
            isAIProcessed ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-600"
          )}>
            {getLabel()}
          </span>
          <h3 className="text-lg font-black text-slate-800 leading-tight truncate">{material.title}</h3>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <p className="text-xs font-bold text-slate-400">包含 {material.totalUnits} 个学习单元</p>
      </div>

      <div className="space-y-2 flex-1">
        <div className="flex justify-between text-[10px] font-black text-slate-500">
          <span>{isParsing ? `AI 解析中 ${parsingProgress}%` : `学习进度 ${progress}%`}</span>
          <span>{isParsing ? '' : (material.totalUnits > 0 ? `${doneCount}/${material.totalUnits}` : '--')}</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={clsx(
              "h-full transition-all duration-500",
              isParsing ? "bg-purple-500" : "bg-primary-500"
            )}
            style={{ width: `${isParsing ? parsingProgress : progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between shrink-0">
        {!isParsing ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlan?.();
            }}
            className="flex items-center gap-1.5 text-xs font-black text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <PlusCircle size={14} />
            加入计划
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-black text-purple-400 bg-purple-50 px-3 py-1.5 rounded-lg">
            <Sparkles size={14} className="animate-pulse" />
            解析中...
          </div>
        )}
        <div className="flex items-center gap-1 text-[10px] font-black text-slate-400">
          {isParsing ? '请稍候' : '查看详情'} <ChevronRight size={12} />
        </div>
      </div>
    </div>
  );
};

export default MaterialCard;
