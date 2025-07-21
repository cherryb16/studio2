import { JournalList } from "@/components/journal/journal-list";

export default function JournalPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Trading Journal</h1>
                <p className="text-muted-foreground">Reflect, analyze, and improve your trading strategy.</p>
            </div>
            <JournalList />
        </div>
    );
}
