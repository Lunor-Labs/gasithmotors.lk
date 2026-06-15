import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    message = 'Loading...',
    fullPage = false
}) => {
    const content = (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mb-4"></div>
            <p className="text-slate-600 font-medium">{message}</p>
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                {content}
            </div>
        );
    }

    return content;
};
