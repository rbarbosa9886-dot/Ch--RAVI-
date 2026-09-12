import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Camera, Trash2, Link as LinkIcon, RefreshCw, Check } from 'lucide-react';
import { optimizeImageFile } from '../utils/imageOptimizer.ts';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({ value, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor, selecione um arquivo de imagem (JPEG, PNG ou WebP).');
      return;
    }

    try {
      setIsProcessing(true);
      const optimizedDataUrl = await optimizeImageFile(file);
      onChange(optimizedDataUrl);
      setShowUrlInput(false);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao processar imagem.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleApplyUrl = () => {
    if (customUrl.trim()) {
      onChange(customUrl.trim());
      setCustomUrl('');
      setShowUrlInput(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block font-semibold text-slate-700 text-xs">
          Foto do Presente
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] text-[#1E3A8A] hover:underline flex items-center gap-1 cursor-pointer font-medium"
        >
          <LinkIcon className="w-3 h-3" />
          {showUrlInput ? 'Ocultar link manual' : 'Inserir link da web'}
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Manual URL Input (Optional dropdown/toggle) */}
      {showUrlInput && (
        <div className="flex gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Cole o link da imagem (ex: https://...)"
            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-3 py-1.5 bg-[#1E3A8A] text-white text-xs font-semibold rounded-lg hover:bg-[#182f70] transition-colors cursor-pointer"
          >
            Aplicar
          </button>
        </div>
      )}

      {/* Image Preview or Upload Dropzone */}
      {value ? (
        <div className="relative flex items-center gap-3.5 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 relative flex items-center justify-center">
            <img
              src={value}
              alt="Pré-visualização do presente"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Imagem carregada
            </p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {value.startsWith('data:') ? 'Foto enviada do dispositivo' : value}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3 h-3 text-[#1E3A8A]" />
                Trocar Foto
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 ${
            isDragging
              ? 'border-[#1E3A8A] bg-blue-50/70 scale-[1.01]'
              : 'border-slate-300 hover:border-[#1E3A8A] bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          {isProcessing ? (
            <div className="py-2 flex flex-col items-center gap-1.5 text-slate-600">
              <RefreshCw className="w-5 h-5 animate-spin text-[#1E3A8A]" />
              <p className="text-xs font-semibold">Otimizando e preparando foto...</p>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1E3A8A]">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  <span className="text-[#1E3A8A] underline">Clique para enviar do celular/PC</span> ou arraste a imagem aqui
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  JPG, PNG ou WebP • Otimização automática para carregar rápido
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {uploadError && (
        <p className="text-[11px] text-rose-600 font-medium">{uploadError}</p>
      )}
    </div>
  );
};
