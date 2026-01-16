import React, { useState, useMemo, useEffect } from 'react';
import { LearningMaterial, StudyPlan, StudyDay, LearningUnit, MaterialScreenshot } from './types';
import PlanGeneratorModal from './components/PlanGeneratorModal';
import StudyDashboard from './components/StudyDashboard';
import PdfViewer from './components/PdfViewer';
import FileUpload from './components/FileUpload';
import { parseMaterialWithAI, inferMaterialTypeFromFileName, generateStudyPlanWithAI, uploadFileToTOS } from './aiService';
import { FolderPlus, BookOpen, Layers, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

import MaterialCard from './components/MaterialCard';

const App: React.FC = () => {
  const [view, setView] = useState<'selection' | 'study' | 'upload' | 'pdf'>('selection');
  const [homeTab, setHomeTab] = useState<'materials' | 'plans'>('materials');
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化
  useEffect(() => {
    const savedMaterials = localStorage.getItem('study-materials');
    const savedPlans = localStorage.getItem('study-plans');
    
    if (savedMaterials) setMaterials(JSON.parse(savedMaterials));
    if (savedPlans) setStudyPlans(JSON.parse(savedPlans));
    setIsInitialized(true);
  }, []);

  // 每次状态变化保存到 localStorage（仅初始化完成后）
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('study-materials', JSON.stringify(materials));
    localStorage.setItem('study-plans', JSON.stringify(studyPlans));
  }, [materials, studyPlans, isInitialized]);

  const activeMaterial = useMemo(() => 
    materials.find(m => m.id === activeMaterialId) || null,
    [materials, activeMaterialId]
  );

  const activePlan = useMemo(() => 
    studyPlans.find(p => p.id === activePlanId) || null,
    [studyPlans, activePlanId]
  );

  const handleSelectMaterial = (id: string) => {
    const m = materials.find(x => x.id === id);
    if (m && m.units.length === 0 && /解析中/.test(m.title)) {
      return;
    }
    setActiveMaterialId(id);
    setActivePlanId(null);
    setView('study');
    setIsGeneratorOpen(false);
  };

  const handleSelectPlan = (id: string) => {
    setActivePlanId(id);
    setActiveMaterialId(null);
    setView('study');
  };

  const handleDeletePlan = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个计划吗？')) {
      setStudyPlans(prev => prev.filter(p => p.id !== id));
      if (activePlanId === id) {
        setActivePlanId(null);
        setView('selection');
      }
    }
  };

  const handleDeleteMaterial = (id: string) => {
    if (confirm('确定要删除这个资料吗？相关的学习计划也将被清除。')) {
      setMaterials(prev => prev.filter(m => m.id !== id));
      setStudyPlans(prev => prev.filter(p => !p.materialIds.includes(id)));
      if (activeMaterialId === id) {
        setActiveMaterialId(null);
        setView('selection');
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    const newId = `m-ai-${Date.now()}`;
    const inferredType = inferMaterialTypeFromFileName(file.name);
    const toDataUrl = (inputFile: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
        reader.readAsDataURL(inputFile);
      });
    
    // 立即进入解析状态
    setView('selection');

    let progressInterval: any;

    try {
      // 1. 先将原始文件上传到 TOS
      console.log('[TOS] Uploading original file...');
      const ossUrl = await uploadFileToTOS(file);
      console.log('[TOS] File upload complete:', ossUrl);

      const placeholder: LearningMaterial = {
        id: newId,
        title: `${file.name.replace(/\.[^.]+$/, "")}`,
        type: inferredType,
        totalUnits: 0,
        units: [],
        localFileUrl: ossUrl,
        screenshots: [],
        resource: {
          id: `r-${newId}`,
          title: file.name.replace(/\.[^.]+$/, ""),
          source: "upload",
          fileName: file.name,
          materialType: inferredType,
          createdAt: Date.now(),
          ossUrl,
        },
        blocks: [],
        status: 'parsing',
        parsingProgress: 0,
      };

      setMaterials(prev => [placeholder, ...prev]);

      // 模拟进度条
      progressInterval = setInterval(() => {
        setMaterials(prev => prev.map(m => {
          if (m.id === newId && m.status === 'parsing') {
            const currentProgress = m.parsingProgress || 0;
            if (currentProgress < 90) {
              return { ...m, parsingProgress: currentProgress + Math.floor(Math.random() * 10) + 1 };
            }
          }
          return m;
        }));
      }, 500);

      let autoScreenshots: MaterialScreenshot[] = [];
      // ... (pdf parsing logic)

      if (inferredType === 'pdf') {
        try {
          // @ts-ignore
          const pdfjs: any = await import('https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.mjs');
          pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          const maxPages = Math.min(pdf.numPages, 10);
          
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context!, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            autoScreenshots.push({
              id: `auto-shot-${i}-${Date.now()}`,
              createdAt: Date.now(),
              pageNumber: i,
              dataUrl
            });
          }
        } catch (renderErr) {
          console.error('[PDF] 全自动翻页渲染失败：', renderErr);
        }
      }
      if (inferredType === 'image') {
        const dataUrl = await toDataUrl(file);
        autoScreenshots = [
          {
            id: `auto-shot-1-${Date.now()}`,
            createdAt: Date.now(),
            pageNumber: 1,
            dataUrl,
          },
        ];
      }

      const { units, resource, blocks } = await parseMaterialWithAI({
        fileName: file.name,
        materialType: inferredType,
        screenshots: autoScreenshots,
      });

      const aiMaterial: LearningMaterial = {
        id: newId,
        title: file.name.replace(/\.[^.]+$/, ""),
        type: resource.materialType,
        totalUnits: units.length,
        units: units.map((u, i) => ({ ...u, id: `${newId}-${i}` })),
        localFileUrl: ossUrl,
        screenshots: autoScreenshots,
        resource: { 
          ...resource, 
          id: `r-${newId}`, 
          title: file.name.replace(/\.[^.]+$/, ""),
          ossUrl,
        },
        blocks: blocks.map((b, i) => ({ ...b, id: `${newId}-b-${i + 1}`, resourceId: `r-${newId}` })),
        status: 'ready',
        parsingProgress: 100,
      };

      clearInterval(progressInterval);
      setMaterials(prev => prev.map(m => (m.id === newId ? aiMaterial : m)));
    } catch (err) {
      clearInterval(progressInterval);
      console.error(err);
      alert('AI 解析失败，请检查网络。');
      setMaterials(prev => prev.filter(m => m.id !== newId));
    }
  };

  const generatePlan = async (config: { days: number; endDate?: string; availableDays: number[] }) => {
    const { days, availableDays } = config;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const getStudyDates = (count: number, start: Date, allowedDays: number[]) => {
      const dates: Date[] = [];
      let current = new Date(start);
      while (dates.length < count) {
        if (allowedDays.includes(current.getDay())) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    if (!activeMaterial) return;

    try {
      const planTitle = `${activeMaterial.title} 的学习计划`;
      const { days: planDays } = await generateStudyPlanWithAI(planTitle, [activeMaterial], days);
      const studyDates = getStudyDates(planDays.length, startDate, availableDays);
      
      const datedDays = planDays.map((d, i) => ({
        ...d,
        date: studyDates[i].toISOString().split('T')[0],
        units: d.units.map(u => ({ ...u, materialId: activeMaterial.id }))
      }));

      const newPlan: StudyPlan = { 
        id: `plan-${Date.now()}`,
        title: planTitle,
        materialIds: [activeMaterial.id],
        days: datedDays,
        createdAt: Date.now()
      };

      setStudyPlans(prev => [...prev, newPlan]);
      setActivePlanId(newPlan.id);
      setIsGeneratorOpen(false);
      setView('study');
    } catch (err) {
      console.warn('AI 生成计划失败，回退到本地逻辑:', err);
      // 回退到本地平均分配逻辑
      const unitsPerDay = Math.ceil(activeMaterial.units.length / days);
      const studyDays: StudyDay[] = [];
      const studyDates = getStudyDates(days, startDate, availableDays);

      for (let i = 0; i < days; i++) {
        const start = i * unitsPerDay;
        const end = Math.min(start + unitsPerDay, activeMaterial.units.length);
        if (start < activeMaterial.units.length) {
          studyDays.push({
            dayIndex: i + 1,
            date: studyDates[i].toISOString().split('T')[0],
            units: activeMaterial.units.slice(start, end).map(u => ({ ...u, materialId: activeMaterial.id }))
          });
        }
      }

      const newPlan: StudyPlan = { 
        id: `plan-${Date.now()}`,
        title: `${activeMaterial.title} 的学习计划`,
        materialIds: [activeMaterial.id],
        days: studyDays,
        createdAt: Date.now()
      };

      setStudyPlans(prev => [...prev, newPlan]);
      setActivePlanId(newPlan.id);
      setIsGeneratorOpen(false);
      setView('study');
    }
  };

  const addMaterialScreenshot = (materialId: string, pageNumber: number, dataUrl: string) => {
    const shot: MaterialScreenshot = { id: `shot-${Date.now()}`, createdAt: Date.now(), pageNumber, dataUrl };
    setMaterials(prev =>
      prev.map(m => (m.id === materialId ? { ...m, screenshots: [...(m.screenshots ?? []), shot] } : m))
    );
  };

  const toggleUnitStatus = (unitId: string, patch?: Partial<LearningUnit>) => {
    setMaterials(prev => prev.map(m => {
      const hasUnit = m.units.some(u => u.id === unitId);
      if (!hasUnit) return m;
      return {
        ...m,
        units: m.units.map(u => {
          if (u.id !== unitId) return u;
          const nextStatus = u.status === 'todo' ? 'done' : 'todo';
          const merged = patch ? { ...u, ...patch } : u;
          return { ...merged, status: nextStatus };
        })
      };
    }));
    setStudyPlans(prev => prev.map(plan => ({
      ...plan,
      days: plan.days.map(day => ({
        ...day,
        units: day.units.map(u => {
          if (u.id !== unitId) return u;
          const nextStatus = u.status === 'todo' ? 'done' : 'todo';
          const merged = patch ? { ...u, ...patch } : u;
          return { ...merged, status: nextStatus };
        })
      }))
    })));
  };

  const handleOpenPdf = (page?: number, materialId?: string) => {
    if (!page) return;
    setSelectedPage(page);
    if (materialId) setActiveMaterialId(materialId);
    setView('pdf');
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-0 md:p-8">
      <div className="bg-slate-50 w-full max-w-[1024px] aspect-[4/3] shadow-2xl overflow-hidden md:rounded-[3rem] border-[12px] border-slate-900 flex flex-col relative">
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {(view === 'study' || view === 'upload' || view === 'pdf') && (
              <button 
                onClick={() => setView('selection')}
                className="p-2 -ml-2 hover:bg-slate-50 rounded-full text-slate-600 transition-colors flex items-center gap-1 group"
                title="返回"
              >
                <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-sm font-bold">返回</span>
              </button>
            )}
            <h1 className="text-xl font-bold text-slate-800">学习计划系统</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col">
          {view === 'upload' ? (
            <div className="flex-1 flex items-center justify-center">
              <FileUpload onUploadComplete={handleFileUpload} />
            </div>
          ) : view === 'selection' ? (
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex justify-center mb-8">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                  <button 
                    onClick={() => setHomeTab('materials')}
                    className={clsx(
                      "px-10 py-3 text-sm font-black rounded-xl transition-all flex items-center gap-3",
                      homeTab === 'materials' ? "bg-white text-primary-600 shadow-lg scale-105" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <BookOpen size={20} /> 资料列表
                  </button>
                  <button 
                    onClick={() => setHomeTab('plans')}
                    className={clsx(
                      "px-10 py-3 text-sm font-black rounded-xl transition-all flex items-center gap-3",
                      homeTab === 'plans' ? "bg-white text-primary-600 shadow-lg scale-105" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Layers size={20} /> 学习计划
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
                {homeTab === 'materials' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div 
                      onClick={() => setView('upload')}
                      className="bg-slate-50 border-4 border-dashed border-slate-200 hover:border-primary-400 hover:bg-primary-50/30 p-8 rounded-[3rem] cursor-pointer transition-all flex flex-col items-center justify-center gap-4 group h-[280px]"
                    >
                      <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-400 group-hover:text-primary-500 group-hover:scale-110 transition-all shadow-sm">
                        <FolderPlus size={32} />
                      </div>
                      <span className="text-lg font-black text-slate-400 group-hover:text-primary-600">上传新资料</span>
                    </div>

                    {materials.map(m => (
                      <MaterialCard 
                        key={m.id}
                        material={m}
                        onSelect={() => handleSelectMaterial(m.id)}
                        onDelete={() => handleDeleteMaterial(m.id)}
                        onAddToPlan={() => {
                          setActiveMaterialId(m.id);
                          setIsGeneratorOpen(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {studyPlans.length === 0 ? (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center">
                          <Layers size={40} />
                        </div>
                        <p className="text-xl font-black">暂无计划，从资料列表开始吧</p>
                      </div>
                    ) : (
                      studyPlans.map(plan => (
                        <div 
                          key={plan.id}
                          onClick={() => handleSelectPlan(plan.id)}
                          className="bg-white border-4 border-transparent hover:border-primary-400 p-8 rounded-[3rem] cursor-pointer transition-all group shadow-xl hover:shadow-2xl relative overflow-hidden"
                        >
                          <button 
                            onClick={(e) => handleDeletePlan(e, plan.id)}
                            className="absolute top-6 right-6 p-3 bg-rose-50 text-rose-400 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all z-10"
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="flex items-center justify-between mb-6">
                            <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 group-hover:scale-110 transition-transform">
                              <Layers size={32} />
                            </div>
                            <span className="text-xs font-black bg-primary-50 text-primary-500 px-3 py-1 rounded-full uppercase tracking-wider">
                              PLAN
                            </span>
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mb-2">{plan.title}</h3>
                          <div className="flex items-center gap-2 mt-4">
                            <p className="text-sm text-slate-400 font-bold">周期: {plan.days.length} 天</p>
                          </div>
                          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-300 italic">
                              {new Date(plan.createdAt).toLocaleDateString()} 创建
                            </span>
                            <div className="bg-slate-900 text-white p-2 rounded-full group-hover:bg-primary-600 transition-colors">
                              <ChevronRight size={16} />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : view === 'pdf' ? (
            <div className="flex-1 min-h-0">
              <PdfViewer 
                title={materials.find(m => m.id === activeMaterialId)?.title || 'PDF 预览'}
                pageNumber={selectedPage || 1}
                fileUrl={materials.find(m => m.id === activeMaterialId)?.localFileUrl}
                screenshots={materials.find(m => m.id === activeMaterialId)?.screenshots}
                onPageChange={(page) => setSelectedPage(page)}
                onCaptureScreenshot={(dataUrl) => {
                  if (!activeMaterialId) return;
                  addMaterialScreenshot(activeMaterialId, selectedPage || 1, dataUrl);
                }}
                onBack={() => setView(activeMaterialId || activePlanId ? 'study' : 'selection')}
              />
            </div>
          ) : (
            (activeMaterial || activePlan) && (
              <div className="flex-1 min-h-0">
                <StudyDashboard 
                  material={activeMaterial || materials.find(m => activePlan?.materialIds.includes(m.id)) || { 
                    id: 'temp', 
                    title: '', 
                    type: 'pdf', 
                    totalUnits: 0, 
                    units: [] 
                  }}
                  plan={activePlan || undefined}
                  onToggleUnit={toggleUnitStatus}
                  onOpenPdf={handleOpenPdf}
                  materials={materials}
                  plans={studyPlans}
                  onOpenGenerator={() => setIsGeneratorOpen(true)}
                />
              </div>
            )
          )}
        </main>

        {isGeneratorOpen && (
          <PlanGeneratorModal 
            materialTitle={activeMaterial?.title || '综合计划'}
            totalUnits={activeMaterial ? activeMaterial.totalUnits : 0}
            onClose={() => setIsGeneratorOpen(false)}
            onGenerate={generatePlan}
          />
        )}
      </div>
    </div>
  );
};

export default App;
