import React, { useState, useEffect } from 'react';
import { X, Sparkles, Calendar, Clock } from 'lucide-react';

interface PlanGeneratorModalProps {
  materialTitle: string;
  totalUnits: number;
  onClose: () => void;
  onGenerate: (config: { days: number; endDate?: string; availableDays: number[] }) => void;
}

const PlanGeneratorModal: React.FC<PlanGeneratorModalProps> = ({ 
  materialTitle, 
  totalUnits,
  onClose, 
  onGenerate 
}) => {
  const [mode, setMode] = useState<'duration' | 'date'>('duration');
  const [days, setDays] = useState(7);
  const [endDate, setEndDate] = useState('');
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]); // 0-6, Sunday is 0
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const weekDays = [
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 },
    { label: '周日', value: 0 },
  ];

  const toggleDay = (day: number) => {
    setAvailableDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleStartGenerate = () => {
    setIsGenerating(true);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          onGenerate({ days, endDate, availableDays });
        }, 500);
      } else {
        setProgress(currentProgress);
      }
    }, 200);
  };

  // 计算实际的学习天数
  const getActualStudyDays = () => {
    if (availableDays.length === 0) return 0;
    if (mode === 'duration') {
      // 简化逻辑：按比例估算
      return Math.ceil(days * (availableDays.length / 7));
    } else {
      // 按截止日期计算
      if (!endDate) return 0;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      let count = 0;
      let current = new Date(start);
      while (current <= end) {
        if (availableDays.includes(current.getDay())) count++;
        current.setDate(current.getDate() + 1);
      }
      return count;
    }
  };

  const actualStudyDays = getActualStudyDays();
  const unitsPerDay = actualStudyDays > 0 ? totalUnits / actualStudyDays : 0;
  // 假设 1 个单元 15 分钟
  const estimatedMinsPerDay = Math.round(unitsPerDay * 15);
  const formattedTime = estimatedMinsPerDay >= 60 
    ? `${Math.floor(estimatedMinsPerDay / 60)} 小时 ${estimatedMinsPerDay % 60} 分钟`
    : `${estimatedMinsPerDay} 分钟`;

  // 根据结束日期计算天数
  useEffect(() => {
    if (mode === 'date' && endDate) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) setDays(diffDays);
    }
  }, [endDate, mode]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <Sparkles size={20} className="text-purple-500" /> AI 智能规划
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
              <div className="relative">
                <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center">
                  <Sparkles size={40} className="text-primary-500 animate-spin-slow" />
                </div>
                <svg className="absolute inset-0 w-24 h-24 -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-slate-100"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeDasharray={282.7}
                    strokeDashoffset={282.7 - (282.7 * progress) / 100}
                    className="text-primary-500 transition-all duration-300 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-800">正在通过 AI 生成计划...</h3>
                <p className="text-sm font-bold text-slate-400">正在分析资料内容并编排每日任务 ({Math.round(progress)}%)</p>
              </div>
              <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Target Objective</div>
                <div className="text-2xl font-black text-primary-600 leading-tight">《{materialTitle}》</div>
              </div>

              <div className="space-y-8">
                {/* 模式切换 */}
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button 
                    onClick={() => setMode('duration')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${mode === 'duration' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    <Clock size={18} /> 按学习周期
                  </button>
                  <button 
                    onClick={() => setMode('date')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${mode === 'date' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    <Calendar size={18} /> 按截止日期
                  </button>
                </div>

                {/* 参数设置 */}
                <div className="space-y-6">
                  {mode === 'duration' ? (
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-4">你想学多久？</label>
                      <div className="flex items-center justify-between gap-2">
                        {[3, 7, 14, 30].map(d => (
                          <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${
                              days === d 
                                ? 'bg-primary-50 border-primary-500 text-primary-600' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                            }`}
                          >
                            {d} 天
                          </button>
                        ))}
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            value={days} 
                            onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                            className="w-full py-4 px-2 rounded-2xl border-2 border-slate-100 text-center font-black text-slate-700 outline-none focus:border-primary-500"
                            placeholder="自定义"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-4">目标完成日期</label>
                      <input 
                        type="date" 
                        value={endDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full py-4 px-6 rounded-2xl border-2 border-slate-100 font-black text-slate-700 outline-none focus:border-primary-500"
                      />
                      {days > 0 && <p className="text-xs font-bold text-primary-500 mt-2 ml-2">预计学习时长：{days} 天</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-4">每周哪几天可以学习？</label>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                      {weekDays.map(day => (
                        <button
                          key={day.value}
                          onClick={() => toggleDay(day.value)}
                          className={`py-3 rounded-xl text-xs font-black transition-all border-2 ${
                            availableDays.includes(day.value)
                              ? 'bg-purple-50 border-purple-400 text-purple-600 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-300'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    {availableDays.length === 0 && (
                      <p className="text-[10px] text-red-400 mt-2 font-bold italic">请至少选择一天！</p>
                    )}
                  </div>
                </div>

            <div className="bg-primary-50 rounded-2xl p-5 text-primary-700 border border-primary-100 space-y-3">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="mt-0.5 text-primary-500" />
                <p className="text-xs font-bold leading-relaxed">
                  AI 将根据您的时间安排（每周 {availableDays.length} 天）自动优化任务量，确保计划可执行且不拖延。
                </p>
              </div>
              <div className="pt-3 border-t border-primary-100 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider opacity-60">预计每日用时</span>
                <span className="text-sm font-black text-primary-600 bg-white px-3 py-1 rounded-lg shadow-sm">
                  {availableDays.length > 0 && days > 0 ? formattedTime : '--'}
                </span>
              </div>
            </div>
          </div>

              <button
                onClick={handleStartGenerate}
                disabled={availableDays.length === 0 || days <= 0}
                className="w-full mt-8 py-5 bg-primary-600 text-white font-black rounded-[2rem] hover:bg-primary-700 transition-all shadow-xl shadow-primary-100 disabled:opacity-50 disabled:shadow-none active:scale-95"
              >
                开始生成智能计划
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanGeneratorModal;
