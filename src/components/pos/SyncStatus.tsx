import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useState, useEffect } from 'react';

export function SyncStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const pendingSalesCount = useLiveQuery(() => db.offline_sales.where('status').equals('pending').count());

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOnline) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full border border-red-200 text-sm font-medium animate-pulse">
                <CloudOff className="w-4 h-4" />
                <span>Offline</span>
                {pendingSalesCount && pendingSalesCount > 0 ? (
                    <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs ml-1">
                        {pendingSalesCount} pending
                    </span>
                ) : null}
            </div>
        );
    }

    if (pendingSalesCount && pendingSalesCount > 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200 text-sm font-medium">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Syncing {pendingSalesCount} sales...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 text-sm font-medium">
            <Cloud className="w-4 h-4" />
            <span>System Synced</span>
        </div>
    );
}
