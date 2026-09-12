import React, { useRef } from 'react';
import { Download, FileText, Paperclip, Trash2 } from 'lucide-react';
import { api, download } from '../../api/client';
import { dateTime } from '../../api/format';
import { useApp } from '../../context/AppContext';
import { useAction } from '../../hooks/useApi';

export const ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx';

const size = (bytes) =>
  bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Files on a request or issue. `uploadPath` is where new files go (omit to hide
 * uploading); `canDelete(file)` decides per file. The server enforces both.
 */
export const Attachments = ({ files, uploadPath, canDelete = () => false }) => {
  const { showToast } = useApp();
  const { run, busy } = useAction();
  const input = useRef(null);

  const upload = async (file) => {
    const form = new FormData();
    form.append('file', file);
    await run(() => api(uploadPath, { method: 'POST', form }), `Attached ${file.name}`);
    if (input.current) input.current.value = '';
  };

  const fetchFile = (f) => download(`/api/attachments/${f.id}`, f.fileName).catch((e) => showToast(e.message, 'error'));

  return (
    <div className="space-y-2">
      {files.length === 0 && <p className="text-xs text-gray-400">No documents attached.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {files.map((f) => (
          <div key={f.id} className="p-3 rounded-lg bg-white border border-gray-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{f.fileName}</p>
                <p className="text-[10px] text-gray-400 truncate">{size(f.sizeBytes)} · {f.uploadedBy?.name} · {dateTime(f.uploadedAt)}</p>
              </div>
            </div>
            <div className="flex items-center shrink-0">
              <button onClick={() => fetchFile(f)} aria-label={`Download ${f.fileName}`} className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-100">
                <Download className="w-4 h-4" />
              </button>
              {canDelete(f) && (
                <button
                  onClick={() => run(() => api(`/api/attachments/${f.id}`, { method: 'DELETE' }), 'File removed')}
                  aria-label={`Remove ${f.fileName}`}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {uploadPath && (
        <label className={`inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <Paperclip className="w-3.5 h-3.5" /> {busy ? 'Uploading…' : 'Attach a document'}
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
          <span className="font-normal text-gray-400 no-underline">PDF, image, Word or Excel · up to 10 MB</span>
        </label>
      )}
    </div>
  );
};
