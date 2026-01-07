import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StudyPlan, StudyDay, LearningMaterial, LearningUnit, TaskType } from '../types';
import { CheckCircle2, Circle, ChevronDown, ChevronRight, ChevronLeft, BookOpen, Trophy, Brain, ClipboardCheck, Video, LayoutGrid, FileText, Image as ImageIcon, Sparkles, Layers, X, PlayCircle, ArrowRight, RotateCcw, FolderPlus } from 'lucide-react';
import clsx from 'clsx';

import CalendarView from './CalendarView';
import ParsePreviewModal from './ParsePreviewModal';

interface StudyDashboardProps {
  material: LearningMaterial;
  plan?: StudyPlan;
  onToggleUnit: (unitId: string, patch?: Partial<LearningUnit>) => void;
  onOpenPdf?: (page?: number, materialId?: string) => void;
  onSelectMaterial?: (materialId: string) => void;
  onReparseMaterialWithScreenshots?: (materialId: string) => void;
  materials: LearningMaterial[];
  plans: StudyPlan[];
  onOpenGenerator?: () => void;
  onAddMaterial?: () => void;
}

const StudyDashboard: React.FC<StudyDashboardProps> = ({ 
  material, 
  plan, 
  onToggleUnit,
  onOpenPdf,
  onSelectMaterial,
  onReparseMaterialWithScreenshots,
  materials,
  plans,
  onOpenGenerator,
  onAddMaterial
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(1);
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<'tasks' | 'materials' | 'calendar'>(() => {
    if (plan) return 'tasks';
    return 'materials';
  });
  const [activeTask, setActiveTask] = useState<LearningUnit | null>(null);
  const [subStepIndex, setSubStepIndex] = useState(0);
  const [previewMaterial, setPreviewMaterial] = useState<LearningMaterial | null>(null);
  const [unitStartedAtMs, setUnitStartedAtMs] = useState<number | null>(null);

  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const cardShownAtRef = useRef<number>(0);
  const [cardResults, setCardResults] = useState<Array<{ card_id: string; result: 'known' | 'unknown'; response_time: number }>>([]);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const questionShownAtRef = useRef<number>(0);
  const [questionResults, setQuestionResults] = useState<Array<{ question_id: string; is_correct: boolean; answer: string; time_spent: number }>>([]);

  // 连线题状态
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});
  const [shuffledRightItems, setShuffledRightItems] = useState<string[]>([]);
  const [selectedLeftItem, setSelectedLeftItem] = useState<string | null>(null);

  // 仿写题状态
  const [imitationInput, setImitationInput] = useState<string>('');

  const allUnits = plan ? plan.days.flatMap(d => d.units) : [];
  const doneCount = allUnits.filter(u => u.status === 'done').length;
  const totalUnits = allUnits.length;
  const progress = totalUnits > 0 ? Math.round((doneCount / totalUnits) * 100) : 0;

  const toggleDayCollapse = (index: number) => {
    setCollapsedDays(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const isDayCompleted = (day: StudyDay) => {
    return day.units.every(u => u.status === 'done');
  };

  const selectedDay = plan?.days.find(d => d.dayIndex === selectedDayIndex);

  const getTaskIcon = (type?: TaskType) => {
    switch (type) {
      case 'flashcard': return <Brain className="text-pink-500" size={28} />;
      case 'exercise': return <ClipboardCheck className="text-orange-500" size={28} />;
      default: return <Circle className="text-slate-200" size={28} />;
    }
  };

  const handleTaskClick = (unit: LearningUnit) => {
    setActiveTask(unit);
    setSubStepIndex(0);
    setUnitStartedAtMs(Date.now());
    // 重置所有题目状态
    setIsCardFlipped(false);
    setSubmitted(false);
    setSelectedOption(null);
    setUserInput('');
    setMatchingSelections({});
    setShuffledRightItems([]);
    setSelectedLeftItem(null);
    setImitationInput('');
  };

  const activePayload = activeTask?.payload as any;

  const currentTaskItems = useMemo(() => {
    if (!activeTask || !activePayload) return [];
    
    // 1. 如果 payload 本身就是个数组，直接返回
    if (Array.isArray(activePayload)) return activePayload;

    // 2. 尝试从常见的数组字段中提取
    const arrayFields = ['questions', 'cards', 'items', 'list', 'units'];
    for (const field of arrayFields) {
      if (Array.isArray(activePayload[field]) && activePayload[field].length > 0) {
        return activePayload[field];
      }
    }

    // 3. 如果没有数组，但有 content 或 payload 本身包含题目字段，将其包装为单条任务
    const item = activePayload as any;
    if (item.question || item.q || item.front || item.title || item.original || item.sentence) {
      return [item];
    }

    // 4. 回退逻辑
    if (activeTask.type === 'flashcard') {
      return [{
        front: String(item.front || item.question || item.q || '暂无内容'),
        back: String(item.back || item.answer || item.explanation || '暂无内容'),
      }];
    }
    if (activeTask.type === 'exercise') {
      return [{
        q: String(item.question || item.q || item.original || '请完成以下练习'),
        options: Array.isArray(item.options) ? item.options : [],
        correct: typeof item.correct === 'number' ? item.correct : 0,
      }];
    }
    return [];
  }, [activeTask, activePayload]);

  const currentItem = currentTaskItems[subStepIndex];

  const needsSubmission = useMemo(() => {
    if (!currentItem) return false;
    const payloadType = (activeTask?.payload as any)?.type;
    return ['qa', 'spelling', 'fill_blank', 'choice', 'reading_comprehension', 'matching', 'imitation'].includes(payloadType) || 
           (currentItem as any).options || (currentItem as any).choices;
  }, [currentItem, activeTask]);

  const handleNext = () => {
    if (subStepIndex < currentTaskItems.length - 1) {
      setSubStepIndex(prev => prev + 1);
      setIsCardFlipped(false);
      setSubmitted(false);
      setSelectedOption(null);
      setUserInput('');
      setMatchingSelections({});
      setShuffledRightItems([]);
      setSelectedLeftItem(null);
      setImitationInput('');
    } else {
      completeUnitWithResult();
    }
  };

  const handlePrev = () => {
    if (subStepIndex > 0) {
      setSubStepIndex(prev => prev - 1);
      setIsCardFlipped(false);
      setSubmitted(false);
      setSelectedOption(null);
      setUserInput('');
      setMatchingSelections({});
      setShuffledRightItems([]);
      setSelectedLeftItem(null);
      setImitationInput('');
    }
  };

  const completeUnitWithResult = () => {
    if (!activeTask) return;
    onToggleUnit(activeTask.id, { status: 'done' });
    setActiveTask(null);
  };

  const renderTaskContent = () => {
    if (!currentItem) return (
      <div className="text-slate-400 font-black text-xl italic">暂无内容</div>
    );

    const payloadType = activePayload?.type;
    const item = currentItem as any;

    // 1. 问答 / 阅读理解
    const isQA = payloadType === 'qa' || 
                 payloadType === 'reading_comprehension' || 
                 (!item.options && !item.choices && (item.front || item.question || item.q));

    if (isQA) {
      const question = item.question || item.q || item.front || item.title || '暂无内容';
      const answer = item.answer || item.back || item.explanation || item.result || '暂无解析';
      
      return (
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <div className="bg-white p-12 rounded-[3rem] shadow-xl border-4 border-slate-100 flex flex-col gap-8">
            <div>
              <span className="text-xs font-black text-slate-300 uppercase tracking-widest block mb-4">问题</span>
              <h4 className="text-3xl font-black text-slate-800 leading-tight">{question}</h4>
            </div>
            
            {submitted && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="h-1 bg-slate-100 rounded-full" />
                <div>
                  <span className="text-xs font-black text-green-400 uppercase tracking-widest block mb-4">参考答案</span>
                  <div className="p-6 bg-green-50 rounded-2xl border-2 border-green-100 text-green-700 text-2xl font-black">
                    {answer}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 2. 拼写检测
    if (payloadType === 'spelling') {
      const spell = item as { word: string; quiz: string; answer: string; pinyin?: string; meaning?: string };
      const isCorrect = userInput.trim() === spell.answer.trim();

      return (
        <div className="w-full max-w-2xl flex flex-col gap-8 items-center">
          <div className="bg-white w-full p-12 rounded-[3rem] shadow-xl border-4 border-slate-100 flex flex-col items-center gap-6 text-center">
             <div className="text-6xl font-black text-slate-800 tracking-widest mb-4">
               {submitted ? spell.word : spell.quiz}
             </div>
             {spell.pinyin && <div className="text-2xl font-bold text-primary-500 font-mono">{spell.pinyin}</div>}
             {spell.meaning && <div className="text-slate-400 font-medium italic mt-2">“{spell.meaning}”</div>}
          </div>
          
          {!submitted ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && userInput.trim() && setSubmitted(true)}
                placeholder="请输入缺失的字词"
                className="w-64 px-6 py-4 bg-white border-4 border-slate-100 rounded-2xl text-2xl font-black text-center focus:border-primary-400 outline-none transition-all shadow-inner"
                autoFocus
              />
            </div>
          ) : (
             <div className="flex flex-col items-center gap-4 animate-in zoom-in">
               <div className={clsx(
                 "flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xl border-4",
                 isCorrect ? "bg-green-50 border-green-500 text-green-600" : "bg-rose-50 border-rose-500 text-rose-600"
               )}>
                 {isCorrect ? <CheckCircle2 size={28} /> : <X size={28} />}
                 {isCorrect ? '回答正确！' : `回答错误，正确答案是：${spell.answer}`}
               </div>
               {!isCorrect && (
                 <button 
                   onClick={() => {
                     setSubmitted(false);
                     setUserInput('');
                   }}
                   className="text-primary-500 font-bold hover:underline"
                 >
                   再试一次
                 </button>
               )}
             </div>
          )}
        </div>
      );
    }

    // 3. 选择题
    const options = Array.isArray(item.options) ? item.options : Array.isArray(item.choices) ? item.choices : [];
    if (payloadType === 'choice' || options.length > 0) {
      const question = item.q || item.question || item.title || '请选择正确答案';
      const correctIndex = typeof item.correct === 'number' ? item.correct : 
                          typeof item.answer === 'number' ? item.answer : 0;
      
      return (
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-100">
            <h4 className="text-2xl font-black text-slate-800 leading-snug">{question}</h4>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {options.map((option: string, idx: number) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === correctIndex;
              const showResult = submitted;
              
              return (
                <button
                  key={idx}
                  disabled={submitted}
                  onClick={() => {
                    setSelectedOption(idx);
                    setSubmitted(true);
                  }}
                  className={clsx(
                    "p-6 rounded-2xl border-4 transition-all flex items-center gap-4 text-left font-bold text-lg",
                    !showResult && "bg-white border-slate-100 hover:border-primary-200 hover:bg-slate-50",
                    showResult && isCorrect && "bg-green-50 border-green-500 text-green-700",
                    showResult && isSelected && !isCorrect && "bg-rose-50 border-rose-500 text-rose-700",
                    showResult && !isSelected && !isCorrect && "bg-slate-50 border-slate-100 opacity-50"
                  )}
                >
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black",
                    !showResult && "bg-slate-100 text-slate-400",
                    showResult && isCorrect && "bg-green-500 text-white",
                    showResult && isSelected && !isCorrect && "bg-rose-500 text-white",
                    showResult && !isSelected && !isCorrect && "bg-slate-200 text-slate-400"
                  )}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  {option}
                </button>
              );
            })}
          </div>
          {submitted && (item.explanation || item.analysis) && (
            <div className="bg-amber-50 p-6 rounded-2xl border-2 border-amber-100 animate-in fade-in slide-in-from-top-2">
              <p className="text-amber-800 text-sm font-bold leading-relaxed">
                <span className="uppercase tracking-wider mr-2">解析:</span>
                {item.explanation || item.analysis}
              </p>
            </div>
          )}
        </div>
      );
    }

    // 4. 连线 / 匹配 (常用于近反义词) - 改进版
    if (payloadType === 'matching') {
      const allItems = currentTaskItems as Array<{ left: string; right: string }>;
      
      // 初始化打乱的右侧列表
      if (shuffledRightItems.length === 0 && allItems.length > 0) {
        const rights = allItems.map(i => i.right);
        const shuffled = [...rights].sort(() => Math.random() - 0.5);
        setShuffledRightItems(shuffled);
      }

      const correctCount = allItems.filter(i => matchingSelections[i.left] === i.right).length;
      const allMatched = Object.keys(matchingSelections).length === allItems.length;
      const allCorrect = correctCount === allItems.length;
      
      return (
        <div className="w-full max-w-4xl flex flex-col gap-6 h-full max-h-[70vh]">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-4 border-slate-100 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <span className="text-sm font-black text-slate-400 uppercase tracking-widest">
                连线匹配 - 点击左侧词语，再点击右侧匹配项
              </span>
              {submitted && (
                <span className={clsx(
                  "px-4 py-2 rounded-xl font-black text-sm",
                  allCorrect ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                )}>
                  正确 {correctCount}/{allItems.length}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-8 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              {/* 左侧词语列表 */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-300 uppercase mb-2">词语</span>
                {allItems.map((matchItem, idx) => {
                  const isSelected = selectedLeftItem === matchItem.left;
                  const hasMatch = matchingSelections[matchItem.left];
                  const isCorrect = submitted && matchingSelections[matchItem.left] === matchItem.right;
                  const isWrong = submitted && hasMatch && matchingSelections[matchItem.left] !== matchItem.right;
                  
                  return (
                    <button
                      key={idx}
                      disabled={submitted}
                      onClick={() => setSelectedLeftItem(isSelected ? null : matchItem.left)}
                      className={clsx(
                        "p-4 rounded-2xl border-4 font-black text-lg transition-all text-left flex items-center justify-between",
                        !submitted && isSelected && "border-primary-500 bg-primary-50 text-primary-700",
                        !submitted && !isSelected && hasMatch && "border-emerald-300 bg-emerald-50 text-emerald-700",
                        !submitted && !isSelected && !hasMatch && "border-slate-100 bg-white hover:border-slate-200",
                        isCorrect && "border-green-500 bg-green-50 text-green-700",
                        isWrong && "border-rose-500 bg-rose-50 text-rose-700"
                      )}
                    >
                      <span>{matchItem.left}</span>
                      {hasMatch && (
                        <span className={clsx(
                          "text-sm px-2 py-1 rounded-lg",
                          isCorrect ? "bg-green-100 text-green-600" : 
                          isWrong ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                        )}>
                          → {matchingSelections[matchItem.left]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* 右侧选项列表 */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-300 uppercase mb-2">匹配项</span>
                {shuffledRightItems.map((rightItem, idx) => {
                  const isUsed = Object.values(matchingSelections).includes(rightItem);
                  const matchedLeft = Object.entries(matchingSelections).find(([_, v]) => v === rightItem)?.[0];
                  const isCorrect = submitted && allItems.find(i => i.right === rightItem)?.left === matchedLeft;
                  
                  return (
                    <button
                      key={idx}
                      disabled={submitted || !selectedLeftItem}
                      onClick={() => {
                        if (selectedLeftItem) {
                          setMatchingSelections(prev => ({ ...prev, [selectedLeftItem]: rightItem }));
                          setSelectedLeftItem(null);
                        }
                      }}
                      className={clsx(
                        "p-4 rounded-2xl border-4 font-black text-lg transition-all text-left",
                        !submitted && selectedLeftItem && !isUsed && "border-slate-100 bg-white hover:border-primary-200 hover:bg-primary-50 cursor-pointer",
                        !submitted && selectedLeftItem && isUsed && "border-slate-100 bg-slate-50 text-slate-400 line-through",
                        !submitted && !selectedLeftItem && "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed",
                        submitted && isCorrect && "border-green-500 bg-green-50 text-green-700",
                        submitted && !isCorrect && isUsed && "border-rose-500 bg-rose-50 text-rose-700",
                        submitted && !isUsed && "border-slate-100 bg-slate-50 text-slate-400"
                      )}
                    >
                      {rightItem}
                    </button>
                  );
                })}
              </div>
            </div>

            {submitted && !allCorrect && (
              <div className="mt-6 p-4 bg-amber-50 rounded-2xl border-2 border-amber-100">
                <span className="text-xs font-black text-amber-500 uppercase block mb-2">正确答案</span>
                <div className="flex flex-wrap gap-2">
                  {allItems.map((i, idx) => (
                    <span key={idx} className="px-3 py-1 bg-white rounded-lg text-sm font-bold text-slate-600">
                      {i.left} → {i.right}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 4.1 单条连线显示（兼容旧格式）
    if (item.left && item.right && payloadType !== 'matching') {
      const left = item.left || '内容';
      const right = item.right || item.answer || '匹配项';
      
      return (
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <div className="bg-white p-12 rounded-[3rem] shadow-xl border-4 border-slate-100 flex flex-col gap-8">
            <div>
              <span className="text-xs font-black text-slate-300 uppercase tracking-widest block mb-4">词语</span>
              <h4 className="text-3xl font-black text-slate-800 leading-tight">{left}</h4>
            </div>
            
            {submitted && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="h-1 bg-slate-100 rounded-full" />
                <div>
                  <span className="text-xs font-black text-green-400 uppercase tracking-widest block mb-4">近义词/参考答案</span>
                  <div className="p-6 bg-green-50 rounded-2xl border-2 border-green-100 text-green-700 text-2xl font-black">
                    {right}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 5. 填空题 - 改进版
    if (payloadType === 'fill_blank') {
      const fillItem = currentItem as { sentence: string; answer: string; explanation?: string };
      // 脱敏处理：隐藏括号内容
      const displaySentence = fillItem.sentence.replace(/(\(|\uff08)[^(\uff08)]*?(\)|\uff09)/g, '______');
      const isCorrect = userInput.trim() === fillItem.answer.trim();

      return (
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border-4 border-slate-100 flex flex-col gap-6">
            <div>
              <span className="text-xs font-black text-slate-300 uppercase tracking-widest block mb-4">填空题</span>
              <h4 className="text-2xl font-black text-slate-800 leading-relaxed">
                {displaySentence.split('______').map((part, idx, arr) => (
                  <React.Fragment key={idx}>
                    {part}
                    {idx < arr.length - 1 && (
                      <span className="inline-block mx-2 px-4 py-1 bg-primary-50 border-b-4 border-primary-400 rounded-lg min-w-[80px] text-center">
                        {submitted ? (
                          <span className={isCorrect ? "text-green-600" : "text-rose-600"}>
                            {userInput || '　'}
                          </span>
                        ) : (
                          <span className="text-primary-300">?</span>
                        )}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </h4>
            </div>
            
            {!submitted ? (
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && userInput.trim() && setSubmitted(true)}
                  placeholder="请输入答案..."
                  className="w-full px-6 py-4 bg-slate-50 border-4 border-slate-100 rounded-2xl text-xl font-bold text-slate-800 focus:border-primary-400 focus:bg-white outline-none transition-all"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className={clsx(
                  "flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-lg border-4",
                  isCorrect ? "bg-green-50 border-green-500 text-green-600" : "bg-rose-50 border-rose-500 text-rose-600"
                )}>
                  {isCorrect ? <CheckCircle2 size={24} /> : <X size={24} />}
                  {isCorrect ? '回答正确！' : `回答错误，正确答案：${fillItem.answer}`}
                </div>
                {fillItem.explanation && (
                  <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-100">
                    <span className="text-xs font-black text-amber-500 uppercase block mb-2">解析</span>
                    <p className="text-amber-800 font-medium">{fillItem.explanation}</p>
                  </div>
                )}
                {!isCorrect && (
                  <button 
                    onClick={() => { setSubmitted(false); setUserInput(''); }}
                    className="text-primary-500 font-bold hover:underline flex items-center gap-2"
                  >
                    <RotateCcw size={16} /> 再试一次
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // 6. 仿写题 - 改进版
    if (payloadType === 'imitation') {
      const imitItem = currentItem as { original: string; skeleton: string; tip?: string };
      
      return (
        <div className="w-full max-w-3xl flex flex-col gap-6">
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border-4 border-slate-100 flex flex-col gap-6">
            <div>
              <span className="text-xs font-black text-slate-300 uppercase tracking-widest block mb-4">仿写练习</span>
              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-r from-primary-50 to-violet-50 rounded-2xl border-2 border-primary-100">
                  <span className="text-xs font-black text-primary-400 uppercase block mb-2">原句</span>
                  <p className="text-xl font-black text-slate-800">{imitItem.original}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                  <span className="text-xs font-black text-slate-400 uppercase block mb-2">句式结构</span>
                  <p className="text-lg font-bold text-slate-600 font-mono">{imitItem.skeleton}</p>
                </div>
                {imitItem.tip && (
                  <div className="flex items-start gap-2 text-amber-600">
                    <Sparkles size={16} className="mt-1 shrink-0" />
                    <p className="text-sm font-medium italic">{imitItem.tip}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <span className="text-xs font-black text-slate-400 uppercase">你的仿写</span>
              <textarea
                value={imitationInput}
                onChange={(e) => setImitationInput(e.target.value)}
                placeholder="请根据原句和句式结构，写出你的仿写句子..."
                className="w-full px-5 py-4 bg-slate-50 border-4 border-slate-100 rounded-2xl text-lg font-medium text-slate-800 focus:border-primary-400 focus:bg-white outline-none transition-all resize-none min-h-[120px]"
                autoFocus
              />
            </div>
            
            {submitted && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="p-5 bg-green-50 rounded-2xl border-2 border-green-100">
                  <span className="text-xs font-black text-green-500 uppercase block mb-2">你的答案</span>
                  <p className="text-lg font-bold text-green-700">{imitationInput || '（未填写）'}</p>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <CheckCircle2 size={16} className="text-green-500" />
                  仿写题为开放性题目，请自行对照原句评估
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 7. 其他通用题型（判断题等）
    const genericItem = currentItem as any;
    let title = genericItem.sentence || genericItem.original || genericItem.question || genericItem.front || genericItem.title || '练习内容';

    const answer = genericItem.answer === true ? '正确' : 
                   genericItem.answer === false ? '错误' : 
                   genericItem.answer || genericItem.back || genericItem.skeleton || genericItem.result || '无标准答案';
    const tip = genericItem.tip || genericItem.explanation;

    return (
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border-4 border-slate-100 flex flex-col gap-8">
          <div>
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest block mb-4">题目内容</span>
            <h4 className="text-3xl font-black text-slate-800 leading-tight">{title}</h4>
          </div>
          
          {submitted && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="h-1 bg-slate-100 rounded-full" />
              <div>
                <span className="text-xs font-black text-green-400 uppercase tracking-widest block mb-4">参考答案</span>
                <div className="p-6 bg-green-50 rounded-2xl border-2 border-green-100 text-green-700 text-2xl font-black">
                  {answer}
                </div>
              </div>
              {tip && (
                <div>
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest block mb-4">解析/提示</span>
                  <p className="text-slate-500 font-medium leading-relaxed italic">{tip}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 h-full min-h-0 relative">
      {/* 任务遮罩层保持原样 */}
      {activeTask && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="bg-[#F8FAFC] w-full max-w-5xl h-full max-h-[850px] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border-[12px] border-slate-800">
            <div className="px-10 py-8 flex justify-between items-center bg-white border-b border-slate-100">
              <div className="flex items-center gap-5">
                <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner", activeTask.type === 'flashcard' ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500")}>
                  <ClipboardCheck size={28} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-2xl tracking-tight">{activeTask.title}</h3>
                </div>
              </div>
              <button onClick={() => setActiveTask(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/30 p-12 items-center">
              {currentTaskItems.length > 0 && (
                <div className="w-full max-w-2xl mb-12 shrink-0">
                  <div className="flex justify-between text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">
                    <span>第 {subStepIndex + 1} / {currentTaskItems.length} 个任务</span>
                    <span>{Math.round(((subStepIndex + 1) / currentTaskItems.length) * 100)}%</span>
                  </div>
                  <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner border-2 border-white">
                    <div 
                      className="h-full bg-primary-500 transition-all duration-500 rounded-full shadow-lg" 
                      style={{ width: `${((subStepIndex + 1) / currentTaskItems.length) * 100}%` }} 
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 w-full flex flex-col items-center min-h-0 overflow-y-auto">
                {renderTaskContent()}
              </div>

              <div className="mt-12 flex items-center gap-6">
                {subStepIndex > 0 && (
                  <button 
                    onClick={handlePrev}
                    className="w-16 h-16 flex items-center justify-center bg-white border-4 border-slate-100 rounded-2xl text-slate-400 hover:border-primary-200 hover:text-primary-500 transition-all active:scale-90"
                  >
                    <ChevronLeft size={32} />
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    const payloadType = (activeTask?.payload as any)?.type;
                    // 选择题点击选项时自动提交，这里直接跳下一题
                    if (payloadType === 'choice' && submitted) {
                      handleNext();
                      return;
                    }
                    // 连线题需要检查是否完成所有匹配
                    if (payloadType === 'matching') {
                      const allItems = currentTaskItems as Array<{ left: string; right: string }>;
                      const allMatched = Object.keys(matchingSelections).length === allItems.length;
                      if (!submitted && allMatched) {
                        setSubmitted(true);
                        return;
                      }
                      if (submitted) {
                        handleNext();
                        return;
                      }
                      return;
                    }
                    // 其他需要提交的题型
                    if (!submitted && needsSubmission) {
                      setSubmitted(true);
                    } else {
                      handleNext();
                    }
                  }}
                  disabled={(() => {
                    const payloadType = (activeTask?.payload as any)?.type;
                    if (payloadType === 'spelling' && !submitted && !userInput.trim()) return true;
                    if (payloadType === 'fill_blank' && !submitted && !userInput.trim()) return true;
                    if (payloadType === 'matching' && !submitted) {
                      const allItems = currentTaskItems as Array<{ left: string; right: string }>;
                      return Object.keys(matchingSelections).length < allItems.length;
                    }
                    return false;
                  })()}
                  className={clsx(
                    "px-12 py-6 rounded-3xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center gap-3",
                    (!submitted && needsSubmission && (activeTask?.payload as any)?.type !== 'choice')
                      ? "bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800 hover:-translate-y-1"
                      : (subStepIndex < currentTaskItems.length - 1 
                          ? "bg-primary-600 text-white shadow-primary-200 hover:bg-primary-700 hover:-translate-y-1"
                          : "bg-green-600 text-white shadow-green-200 hover:bg-green-700 hover:-translate-y-1"),
                    (() => {
                      const payloadType = (activeTask?.payload as any)?.type;
                      if (payloadType === 'spelling' && !submitted && !userInput.trim()) return true;
                      if (payloadType === 'fill_blank' && !submitted && !userInput.trim()) return true;
                      if (payloadType === 'matching' && !submitted) {
                        const allItems = currentTaskItems as Array<{ left: string; right: string }>;
                        return Object.keys(matchingSelections).length < allItems.length;
                      }
                      return false;
                    })() && "opacity-50 grayscale cursor-not-allowed"
                  )}
                >
                  {(() => {
                    const payloadType = (activeTask?.payload as any)?.type;
                    if (!submitted && needsSubmission && payloadType !== 'choice') {
                      if (['qa', 'imitation'].includes(payloadType)) {
                        return <>查看结果 <ArrowRight size={24} /></>;
                      }
                      if (payloadType === 'matching') {
                        return <>检查匹配 <ArrowRight size={24} /></>;
                      }
                      return <>提交回答 <ArrowRight size={24} /></>;
                    }
                    if (subStepIndex < currentTaskItems.length - 1) {
                      return <>下一个 <ArrowRight size={24} /></>;
                    }
                    return <>完成单元 <Trophy size={24} /></>;
                  })()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center px-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-2xl text-primary-600">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">{plan?.title || material.title}</h2>
              <p className="text-xs font-bold text-slate-400">
              {activeTab === 'tasks' ? '学习计划任务' : activeTab === 'materials' ? '资料解析详情' : '周期概览'}
              </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
            {plan && (
              <button onClick={() => setActiveTab('tasks')} className={clsx("px-6 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2", activeTab === 'tasks' ? "bg-white text-primary-600 shadow-md" : "text-slate-400")}>
                <LayoutGrid size={14} /> 学习任务
              </button>
            )}
            {plan && (
              <button onClick={() => setActiveTab('calendar')} className={clsx("px-6 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2", activeTab === 'calendar' ? "bg-white text-primary-600 shadow-md" : "text-slate-400")}>
                <ImageIcon size={14} /> 计划日历
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {material.type === 'pdf' && (
              <button onClick={() => onOpenPdf?.(1, material.id)} className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-xs text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm active:scale-95">
                <FileText size={14} /> 查看资料原文
              </button>
            )}
            {!plan && (
              <button onClick={onOpenGenerator} className="px-4 py-2 bg-primary-600 text-white rounded-xl font-black text-xs hover:bg-primary-700 transition-all flex items-center gap-2 shadow-lg shadow-primary-100 active:scale-95">
                <Sparkles size={14} /> 添加到计划
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'materials' && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 px-4">
          <div className="bg-white rounded-[3rem] border-4 border-slate-100 overflow-hidden shadow-xl flex flex-col h-full">
            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
              <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
                {material.units.map((unit, idx) => (
                  <div 
                    key={unit.id} 
                    className="p-6 bg-white border-2 border-slate-100 rounded-[2rem] flex items-center justify-between group hover:border-primary-200 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleTaskClick(unit)}
                >
                  <div className="flex items-center gap-6">
                      <span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black italic">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="p-3 bg-slate-50 rounded-2xl text-primary-500 group-hover:bg-primary-50 transition-colors">
                        {getTaskIcon(unit.type)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-800 text-lg">{unit.title}</h4>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-500">
                            练习
                          </span>
                        </div>
                        {unit.summary && (
                          <p className="text-xs text-slate-400 mt-1 font-medium italic line-clamp-1">{unit.summary}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-200 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
                </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && plan && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 px-4 animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
            {/* 这里保持原有的计划列表布局 */}
            <div className="w-full md:w-80 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary-50 rounded-lg text-primary-600"><BookOpen size={20} /></div>
                  <div>
                    <h2 className="font-bold text-slate-800 leading-snug">{material.title}</h2>
                    <p className="text-xs text-slate-500">进度 {progress}%</p>
                  </div>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {plan.days.map(day => (
                  <div key={day.dayIndex} onClick={() => setSelectedDayIndex(day.dayIndex)} className={clsx("flex items-center justify-between p-4 cursor-pointer rounded-2xl border-2 transition-all", selectedDayIndex === day.dayIndex ? "border-primary-500 bg-white" : "border-transparent bg-white hover:bg-slate-50")}>
                    <span className={clsx("font-bold text-sm", selectedDayIndex === day.dayIndex ? "text-primary-600" : "text-slate-700")}>第 {day.dayIndex} 天</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
              <div className="px-8 py-6 border-b bg-white sticky top-0"><h2 className="text-2xl font-black text-slate-800">第 {selectedDayIndex} 天任务</h2></div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {selectedDay?.units.map(unit => (
                  <div key={unit.id} onClick={() => handleTaskClick(unit)} className={clsx("flex items-center p-5 rounded-2xl border-2 transition-all cursor-pointer group", unit.status === 'done' ? "bg-green-50/30 border-green-100 text-green-700" : "bg-white border-slate-100 text-slate-700 hover:border-primary-200")}>
                    <div className="mr-4">{unit.status === 'done' ? <CheckCircle2 className="text-green-500" size={28} /> : getTaskIcon(unit.type)}</div>
                    <div className="flex-1"><h4 className={clsx("text-lg font-bold block", unit.status === 'done' && "line-through opacity-60")}>{unit.title}</h4></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && plan && (
        <div className="flex-1 min-h-0 px-4 pb-4">
          <CalendarView materials={materials} plans={plans} onToggleUnit={onToggleUnit} />
        </div>
      )}
    </div>
  );
};

export default StudyDashboard;
