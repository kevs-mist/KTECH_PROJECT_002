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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#0f172a] border border-white/10 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Import ATM Data</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Upload Excel (.xlsx)</p>
                    </div>
                    <button onClick={() => { handleReset(); onClose(); }} className="text-slate-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Error */}
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {result && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl space-y-1">
                            <p className="font-bold text-sm">✓ Import Complete</p>
                            <p><strong>{result.imported}</strong> rows imported successfully</p>
                            {result.skipped > 0 && <p><strong>{result.skipped}</strong> rows skipped (missing ATM ID)</p>}
                            <p className="text-slate-500">Total rows processed: {result.total}</p>
                        </div>
                    )}

                    {/* Dropzone */}
                    {!file && !result && (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:bg-white/[0.02] transition-all group">
                            <div className="flex flex-col items-center gap-3 text-slate-500 group-hover:text-indigo-400 transition-colors">
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
                        <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 text-lg font-bold">📊</div>
                                <div>
                                    <p className="text-sm font-bold text-white">{file.name}</p>
                                    <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button onClick={handleReset} className="text-xs text-slate-500 hover:text-red-400 transition-colors font-bold uppercase tracking-widest">Remove</button>
                        </div>
                    )}

                    {/* Parsing indicator */}
                    {isParsing && (
                        <div className="flex items-center gap-3 text-slate-400 text-sm">
                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            Parsing Excel file...
                        </div>
                    )}

                    {/* Preview */}
                    {previewData.length > 0 && !result && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Preview (first 5 rows)</p>
                            <div className="overflow-x-auto bg-white/[0.02] border border-white/5 rounded-xl">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            {previewColumns.map(col => (
                                                <th key={col} className="px-4 py-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, i) => (
                                            <tr key={i} className="border-b border-white/5 last:border-0">
                                                {previewColumns.map(col => (
                                                    <td key={col} className="px-4 py-2.5 text-slate-300 whitespace-nowrap max-w-[200px] truncate">{String(row[col] ?? "")}</td>
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
                        <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Expected Columns</p>
                            <div className="flex flex-wrap gap-1.5">
                                {["bank_name", "atm_id", "location", "address", "state", "engineer_name", "engineer_contact", "engineer_email"].map(col => (
                                    <span key={col} className="text-[9px] font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg">{col}</span>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-600 mt-2">Only <strong className="text-slate-400">atm_id</strong> is required. Duplicate ATM IDs will be updated.</p>
                            <p className="text-[10px] text-slate-600 mt-1">The ATM ID column may also be labeled <strong className="text-slate-400">SR NO</strong>, <strong className="text-slate-400">SR_NO</strong>, or <strong className="text-slate-400">SRNO</strong>.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-white/5 flex gap-3">
                    <button
                        type="button"
                        onClick={() => { handleReset(); onClose(); }}
                        className="flex-1 px-6 py-3.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                    >
                        {result ? "Close" : "Cancel"}
                    </button>
                    {file && !result && (
                        <button
                            onClick={handleUpload}
                            disabled={isUploading || previewData.length === 0}
                            className="flex-[2] px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
