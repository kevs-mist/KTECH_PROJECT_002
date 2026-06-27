"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { ticketService } from "../../lib/services/ticketService";

export const normalizeHeaderKey = (header: string) =>
    header
        .trim()
        .toLowerCase()
        .replace(/[\/]+/g, " ")
        .replace(/[_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const isAtmIdHeader = (header: string) => {
    const normalized = normalizeHeaderKey(header);
    const tokens = normalized.split(" ");
    return (
        (tokens.includes("atm") && tokens.includes("id")) ||
        (tokens.includes("sr") && (tokens.includes("no") || tokens.includes("number")))
    );
};

export const hasValidAtmIdHeader = (headers: string[]) =>
    headers.some((header) => isAtmIdHeader(header));

interface DataImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function DataImportModal({ isOpen, onClose, onSuccess }: DataImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<Record<string, any>[]>([]);
    const [previewColumns, setPreviewColumns] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        setResult(null);
        setIsParsing(true);

        try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

            if (jsonData.length === 0) {
                setError("The Excel file is empty or has no readable data.");
                setPreviewData([]);
                setPreviewColumns([]);
                return;
            }

            // Get columns from first row
            const cols = Object.keys(jsonData[0]);
            setPreviewColumns(cols);

            if (!hasValidAtmIdHeader(cols)) {
                setError("Missing ATM ID column. Use atm_id, SR NO, SR_NO, or SRNO.");
                setPreviewData([]);
                return;
            }

            setPreviewData(jsonData.slice(0, 5)); // Show first 5 rows as preview
        } catch (err) {
            console.error("Parse error:", err);
            setError("Failed to parse the Excel file. Make sure it's a valid .xlsx file.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setResult(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

            const token = await ticketService.getIdToken();
            const response = await fetch("/api/atm/import", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ rows: jsonData }),
            });

            let data: any = null;
            try {
                data = await response.json();
            } catch {
                // ignore parse errors and use status fallback
            }

            if (!response.ok) {
                const message = data?.error || `Import failed (${response.status})`;
                throw new Error(message);
            }

            setResult({
                imported: data.imported,
                skipped: data.skipped,
                total: data.total,
            });
            onSuccess();
        } catch (err: any) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to upload data.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setPreviewData([]);
        setPreviewColumns([]);
        setError(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
            <div className="w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                {/* Header */}
                <div className="px-8 py-6 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Import ATM Data</h2>
                        <p className="text-xs uppercase tracking-widest font-bold mt-1" style={{ color: 'var(--text-tertiary)' }}>Upload Excel (.xlsx)</p>
                    </div>
                    <button onClick={() => { handleReset(); onClose(); }} className="transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Error */}
                    {error && (
                        <div className="p-4 text-xs rounded-xl flex items-center gap-2" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)', color: 'var(--error)' }}>
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {result && (
                        <div className="p-4 text-xs rounded-xl space-y-1" style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', color: 'var(--success)' }}>
                            <p className="font-bold text-sm">✓ Import Complete</p>
                            <p><strong>{result.imported}</strong> rows imported successfully</p>
                            {result.skipped > 0 && <p><strong>{result.skipped}</strong> rows skipped (missing ATM ID)</p>}
                            <p className="text-slate-500" style={{ color: 'var(--text-tertiary)' }}>Total rows processed: {result.total}</p>
                        </div>
                    )}

                    {/* Dropzone */}
                    {!file && !result && (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-all group" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="flex flex-col items-center gap-3 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <div className="text-center">
                                    <p className="text-sm font-bold">Drop your Excel file here</p>
                                    <p className="text-[10px] uppercase tracking-widest mt-1">or click to browse (.xlsx)</p>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </label>
                    )}

                    {/* File info */}
                    {file && !result && (
                        <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', color: 'var(--success)' }}>📊</div>
                                <div>
                                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button onClick={handleReset} className="text-xs font-bold uppercase tracking-widest transition-colors" style={{ color: 'var(--text-tertiary)' }}>Remove</button>
                        </div>
                    )}

                    {/* Parsing indicator */}
                    {isParsing && (
                        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border-subtle)', borderTopColor: 'var(--accent)' }} />
                            Parsing Excel file...
                        </div>
                    )}

                    {/* Preview */}
                    {previewData.length > 0 && !result && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>Preview (first 5 rows)</p>
                            <div className="overflow-x-auto rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            {previewColumns.map(col => (
                                                <th key={col} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                {previewColumns.map(col => (
                                                    <td key={col} className="px-4 py-2.5 whitespace-nowrap max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>{String(row[col] ?? "")}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Expected columns info */}
                    {!file && !result && (
                        <div className="p-4 rounded-xl" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-subtle)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>Expected Columns</p>
                            <div className="flex flex-wrap gap-1.5">
                                {["bank_name", "atm_id", "location", "address", "state", "engineer_name", "engineer_contact", "engineer_email"].map(col => (
                                    <span key={col} className="text-[9px] font-bold px-2.5 py-1 rounded-lg" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-elevated)' }}>{col}</span>
                                ))}
                            </div>
                            <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>Only <strong style={{ color: 'var(--text-secondary)' }}>atm_id</strong> is required. Duplicate ATM IDs will be updated.</p>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>The ATM ID column may also be labeled <strong style={{ color: 'var(--text-secondary)' }}>SR NO</strong>, <strong style={{ color: 'var(--text-secondary)' }}>SR_NO</strong>, or <strong style={{ color: 'var(--text-secondary)' }}>SRNO</strong>.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 flex gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                        type="button"
                        onClick={() => { handleReset(); onClose(); }}
                        className="flex-1 px-6 py-3.5 rounded-xl text-xs font-bold transition-all" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-elevated)' }}
                    >
                        {result ? "Close" : "Cancel"}
                    </button>
                    {file && !result && (
                        <button
                            onClick={handleUpload}
                            disabled={isUploading || previewData.length === 0}
                            className="flex-[2] px-6 py-3.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2" style={{ color: 'white', background: 'var(--success)' }}
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                `Import ${previewData.length > 0 ? `All Rows` : ""}`
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
