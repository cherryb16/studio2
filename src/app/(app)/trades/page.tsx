import { TradesTable } from "@/components/trades/trades-table";

export default function TradesPage() {
    return (
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold font-headline">Your Trades</h1>
                <p className="text-muted-foreground">Manage and review all your trade entries.</p>
            </div>
            <TradesTable />
        </div>
    );
}
