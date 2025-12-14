"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DebugPage() {
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs(p => [...p, msg]);

    useEffect(() => {
        async function run() {
            log("Starting DB Probe...");

            try {
                log("Attempting to list all tables via information_schema...");
                // Note: this might fail due to permissions, but usually 'postgres' or accessible tables show up
                const { data, error } = await supabase
                    .from('information_schema.tables')
                    .select('table_name')
                    .eq('table_schema', 'public');

                // Supabase JS client sometimes doesn't let you query information_schema directly like this 
                // easily without a view, but let's try or fall back to known tables.
                if (error) {
                    log(`⚠️ standard schema query failed: ${error.message}. trying direct table checks...`);
                } else if (data) {
                    log(`📋 Found tables: ${data.map(x => x.table_name).join(', ')}`);
                }
            } catch (e) {
                log(`Error querying schema: ${e}`);
            }

            const tables = ['items', 'inventory', 'assets', 'locations', 'inventory_transactions', 'containers', 'categories'];
            for (const t of tables) {
                log(`Checking table: ${t}...`);
                const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
                if (error) {
                    log(`❌ Error [${t}]: ${error.message} (${error.code})`);
                } else {
                    log(`✅ Success [${t}]: Table exists (count: ${count}).`);
                }
            }
            log("Probe Finished.");
        }
        run();
    }, []);

    return (
        <div className="p-10 bg-black text-green-400 font-mono text-xs whitespace-pre-wrap">
            {logs.join('\n')}
        </div>
    );
}
