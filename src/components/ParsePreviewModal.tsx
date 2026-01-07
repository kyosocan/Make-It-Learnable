import React, { useMemo, useState } from "react";
import { X, Layers, ListChecks } from "lucide-react";
import { LearningMaterial } from "../types";
import clsx from "clsx";

interface ParsePreviewModalProps {
  material: LearningMaterial;
  onClose: () => void;
}

const ParsePreviewModal: React.FC<ParsePreviewModalProps> = ({ material, onClose }) => {
  const [tab, setTab] = useState<"blocks" | "units">("blocks");
  const [query, setQuery] = useState("");

  const blocks = material.blocks ?? [];
  const units = material.units ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { blocks, units };
    return {
      blocks: blocks.filter(b => JSON.stringify(b).toLowerCase().includes(q)),
      units: units.filter(u => JSON.stringify(u).toLowerCase().includes(q)),
    };
  }, [blocks, units, query]);

  const payload = tab === "blocks" ? filtered.blocks : filtered.units;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[200]">
      <div className="bg-white rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <div className="min-w-0">
            <h2 className="font-black text-slate-800 truncate">解析结构预览：{material.title}</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Resource → Content Blocks → Learning Units（用于验证第 2 步抽象）
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
              <button
                onClick={() => setTab("blocks")}
                className={clsx(
                  "px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2",
                  tab === "blocks" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500"
                )}
              >
                <Layers size={16} /> Blocks ({blocks.length})
              </button>
              <button
                onClick={() => setTab("units")}
                className={clsx(
                  "px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2",
                  tab === "units" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500"
                )}
              >
                <ListChecks size={16} /> Units ({units.length})
              </button>
            </div>

            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索（支持模糊匹配 JSON）"
              className="w-full md:w-80 px-4 py-2 rounded-xl border-2 border-slate-100 font-bold text-slate-700 outline-none focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Resource</div>
              <pre className="mt-3 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                {JSON.stringify(material.resource ?? { hint: "暂无 resource（非 AI 解析资料）" }, null, 2)}
              </pre>
            </div>
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                  {tab === "blocks" ? "Content Blocks" : "Learning Units"}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  展示 {payload.length} 条（已过滤）
                </span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-4">
                <pre className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParsePreviewModal;


