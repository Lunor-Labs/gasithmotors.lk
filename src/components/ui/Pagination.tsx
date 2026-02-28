import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    className = '',
}: PaginationProps) {
    const [jumpPage, setJumpPage] = useState('');

    useEffect(() => {
        setJumpPage('');
    }, [currentPage]);

    if (totalPages <= 1) return null;

    const handleJumpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const pageNum = parseInt(jumpPage);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            onPageChange(pageNum);
            setJumpPage('');
        }
    };

    const getPageNumbers = () => {
        const pages = [];
        const showMax = 5;

        if (totalPages <= showMax) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // Show current page and neighbors
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) {
                    pages.push(i);
                }
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent transition text-slate-600"
                    title="Previous Page"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1">
                    {getPageNumbers().map((pageNum, idx) => (
                        <React.Fragment key={idx}>
                            {pageNum === '...' ? (
                                <span className="px-2 text-slate-400">...</span>
                            ) : (
                                <button
                                    onClick={() => onPageChange(pageNum as number)}
                                    className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition ${currentPage === pageNum
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent transition text-slate-600"
                    title="Next Page"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 whitespace-nowrap">Jump to page:</span>
                <form onSubmit={handleJumpSubmit} className="flex gap-1">
                    <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={jumpPage}
                        onChange={(e) => setJumpPage(e.target.value)}
                        className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none text-center"
                        placeholder={currentPage.toString()}
                    />
                    <button
                        type="submit"
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
                    >
                        Go
                    </button>
                </form>
            </div>
        </div>
    );
}
