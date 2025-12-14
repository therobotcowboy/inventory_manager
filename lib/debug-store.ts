
export interface LogEntry {
    id: string;
    type: 'error' | 'warn' | 'log';
    message: string;
    stack?: string;
    timestamp: string;
}

type Listener = (logs: LogEntry[]) => void;

class DebugStore {
    private logs: LogEntry[] = [];
    private listeners: Listener[] = [];
    private maxLogs = 100;

    addLog(type: LogEntry['type'], message: string, stack?: string) {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            type,
            message,
            stack,
            timestamp: new Date().toLocaleTimeString()
        };

        this.logs = [entry, ...this.logs].slice(0, this.maxLogs);
        this.notify();
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
        this.notify();
    }

    subscribe(listener: Listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l(this.logs));
    }
}

export const debugStore = new DebugStore();
