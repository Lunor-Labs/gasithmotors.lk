import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    children?: React.ReactNode;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChange,
    placeholder = 'Search...',
    className = '',
    children
}) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 ${className}`}>
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex items-center gap-2">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="flex-1 outline-none text-slate-900 text-sm md:text-base"
                    />
                </div>
                {children && (
                    <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-4">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
};
