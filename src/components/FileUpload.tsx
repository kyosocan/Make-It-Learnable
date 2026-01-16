import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onUploadComplete: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 立刻提交：不在上传页展示进度条；解析进度由“资料卡片上的进度条”承担
    onUploadComplete(file);
    // 允许重复选择同一个文件（触发 onChange）
    e.currentTarget.value = '';
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer
          bg-white border-slate-200 hover:border-primary-400 hover:bg-primary-50/30
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
        />

        <div className="space-y-4">
          <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">上传学习资料</h3>
            <p className="text-slate-500 mt-2">提交后将自动回到资料列表，解析进度会显示在资料卡片上</p>
            <p className="text-xs text-slate-400 mt-2">支持 PDF/DOC/DOCX/PNG/JPG/JPEG/WEBP</p>
          </div>
          <button className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-xl font-medium shadow-lg shadow-primary-100">
            选择文件
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

