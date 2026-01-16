import React, { useMemo, useState } from 'react';
import { ChevronLeft, Maximize2, Download, Printer, Camera } from 'lucide-react';

interface PdfViewerProps {
  title: string;
  pageNumber: number;
  fileUrl?: string;
  screenshots?: { pageNumber: number; dataUrl: string }[];
  onCaptureScreenshot?: (dataUrl: string) => void;
  onPageChange?: (page: number) => void;
  onBack: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ title, pageNumber, fileUrl, screenshots, onCaptureScreenshot, onPageChange, onBack }) => {
  const [capturing, setCapturing] = useState(false);
  const [lastShotAt, setLastShotAt] = useState<number | null>(null);

  const pageHint = useMemo(() => {
    // iframe/embed 的 #page 在部分浏览器里可用；不可用也不会影响展示
    return fileUrl ? `${fileUrl}#page=${pageNumber}` : undefined;
  }, [fileUrl, pageNumber]);

  const handleCapture = async () => {
    if (!onCaptureScreenshot) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('当前浏览器不支持屏幕截图（getDisplayMedia）。请升级浏览器或改用系统截图。');
      return;
    }
    try {
      setCapturing(true);
      // 用户会看到系统选择框：建议选择“当前标签页/窗口”，即可截到 PDF 内容
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks?.()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ImageCaptureCtor = (window as any).ImageCapture;
      let dataUrl: string | null = null;

      if (track && ImageCaptureCtor) {
        const imageCapture = new ImageCaptureCtor(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(bitmap, 0, 0);
        dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      } else {
        // fallback：用 video 元素抓一帧
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        await new Promise(resolve => setTimeout(resolve, 200));
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        video.pause();
      }

      // 关闭流
      stream.getTracks?.().forEach((t: MediaStreamTrack) => t.stop());

      if (!dataUrl) throw new Error('截图失败');
      onCaptureScreenshot(dataUrl);
      setLastShotAt(Date.now());
      alert('已保存截图：现在可返回“资料库”点击“用截图重新解析”，让 AI 更懂这份 PDF。');
    } catch (e) {
      console.error(e);
      alert('截图失败：请确认选择了当前标签页/窗口，并允许共享。');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 text-white rounded-[2rem] overflow-hidden shadow-2xl">
      {/* PDF Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/50 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-100">{title}</h2>
            <p className="text-[10px] text-slate-400 font-medium">第 {pageNumber} 页 / 共 40 页</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCapture}
            disabled={capturing || !onCaptureScreenshot}
            className="p-2 hover:bg-white/10 rounded-lg text-slate-300 disabled:opacity-40"
            title="截图辅助理解"
          >
            <Camera size={18} />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><Maximize2 size={18} /></button>
          <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><Download size={18} /></button>
          <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><Printer size={18} /></button>
        </div>
      </div>

      {/* PDF Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-700/50 p-8 flex justify-center custom-scrollbar">
        {screenshots?.find(s => s.pageNumber === pageNumber) ? (
          <div className="w-full max-w-4xl bg-white shadow-2xl rounded-xl overflow-hidden border border-white/10 flex flex-col">
            <div className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50 border-b flex items-center justify-between">
              <span className="font-bold">资料预览（第 {pageNumber} 页 - 已通过 AI 解析）</span>
              {lastShotAt && <span className="text-slate-400">最近截图：{new Date(lastShotAt).toLocaleTimeString()}</span>}
            </div>
            <img 
              src={screenshots.find(s => s.pageNumber === pageNumber)?.dataUrl} 
              alt={`Page ${pageNumber}`}
              className="w-full h-auto object-contain bg-white"
            />
          </div>
        ) : pageHint ? (
          <div className="w-full max-w-4xl bg-white shadow-2xl rounded-xl overflow-hidden border border-white/10">
            <div className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50 border-b flex items-center justify-between">
              <span className="font-bold">PDF 预览（第 {pageNumber} 页）</span>
              {lastShotAt && <span className="text-slate-400">最近截图：{new Date(lastShotAt).toLocaleTimeString()}</span>}
            </div>
            <iframe
              title="pdf"
              src={pageHint}
              className="w-full h-[70vh] bg-white"
            />
          </div>
        ) : (
          <div className="w-full max-w-2xl aspect-[1/1.414] bg-white shadow-2xl rounded-sm p-12 flex flex-col relative group">
            {/* Simulated PDF Page Content */}
            <div className="absolute top-8 right-12 text-[10px] text-slate-300 font-mono italic">Page {pageNumber}</div>
            <div className="space-y-6">
              <div className="h-8 w-3/4 bg-slate-100 rounded-md mb-8" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-slate-50 rounded-sm" />
                <div className="h-4 w-full bg-slate-50 rounded-sm" />
                <div className="h-4 w-5/6 bg-slate-50 rounded-sm" />
              </div>
              <div className="grid grid-cols-2 gap-8 my-12">
                <div className="aspect-square bg-blue-50 rounded-xl border-2 border-blue-100 flex items-center justify-center text-blue-200 font-black text-4xl">
                  GRAPH
                </div>
                <div className="space-y-4">
                  <div className="h-3 w-full bg-slate-50 rounded-full" />
                  <div className="h-3 w-full bg-slate-50 rounded-full" />
                  <div className="h-3 w-2/3 bg-slate-50 rounded-full" />
                </div>
              </div>
              <div className="space-y-3 mt-12">
                <div className="h-4 w-full bg-slate-50 rounded-sm" />
                <div className="h-4 w-11/12 bg-slate-50 rounded-sm" />
                <div className="h-4 w-full bg-slate-50 rounded-sm" />
              </div>
            </div>
            <div className="mt-auto pt-12 flex justify-between items-end border-t border-slate-50">
              <div className="space-y-1">
                <div className="h-2 w-24 bg-slate-100 rounded-full" />
                <div className="h-2 w-16 bg-slate-50 rounded-full" />
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-black text-primary-600">
                {pageNumber}
              </div>
            </div>
            {/* Overlay Hint */}
            <div className="absolute inset-0 bg-primary-600/0 group-hover:bg-primary-600/5 transition-all pointer-events-none" />
          </div>
        )}
      </div>

      {/* PDF Footer / Controls */}
      <div className="px-6 py-3 bg-slate-900/80 border-t border-white/5 flex justify-center gap-4">
        <div className="flex bg-slate-800 rounded-lg p-1 items-center gap-2 border border-white/10 shadow-inner">
          <button 
            onClick={() => onPageChange?.(pageNumber - 1)}
            className="px-3 py-1 hover:bg-white/10 rounded text-xs font-bold disabled:opacity-30" 
            disabled={pageNumber <= 1}
          >
            上一页
          </button>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <span className="text-xs font-black px-2">{pageNumber} / {screenshots?.length || 40}</span>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <button 
            onClick={() => onPageChange?.(pageNumber + 1)}
            className="px-3 py-1 hover:bg-white/10 rounded text-xs font-bold"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;

