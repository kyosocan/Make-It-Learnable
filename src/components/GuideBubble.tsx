import React from 'react';

interface GuideBubbleProps {
  title: string;
  content: string;
  onAction: () => void;
}

const GuideBubble: React.FC<GuideBubbleProps> = ({ title, content, onAction }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {/* 蒙层 - 允许点击穿透卡片区域 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
      
      {/* 气泡主体 */}
      <div className="relative bg-white rounded-[32px] w-[340px] p-8 shadow-2xl animate-in zoom-in-95 duration-300 pointer-events-auto">
        <div className="space-y-2 mb-8 text-center">
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed font-medium">
            {content}
          </p>
        </div>

        <button 
          onClick={onAction}
          className="w-full py-4 bg-[#FF3B30] text-white rounded-2xl font-black text-lg shadow-lg shadow-red-100 active:scale-95 transition-all"
        >
          我知道了
        </button>
      </div>
    </div>
  );
};

export default GuideBubble;

