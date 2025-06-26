"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Cpu, Lightbulb, Loader2, ServerCrash, ShieldAlert } from "lucide-react";
import { type ErrorLog, type SummarizeErrorsOutput } from "@/types";
import { getGroupSummary } from "@/app/actions";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";

interface ErrorGroupSummaryProps {
    logs: ErrorLog[];
}

const priorityIcons = {
    "Low": <Lightbulb className="h-4 w-4" />,
    "Medium": <AlertTriangle className="h-4 w-4" />,
    "High": <ServerCrash className="h-4 w-4" />,
    "Critical": <ShieldAlert className="h-4 w-4" />,
};

const priorityVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    "Low": "secondary",
    "Medium": "default",
    "High": "destructive",
    "Critical": "destructive",
}

export function ErrorGroupSummary({ logs }: ErrorGroupSummaryProps) {
    const [summary, setSummary] = useState<SummarizeErrorsOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleSummarize = () => {
        startTransition(async () => {
            setError(null);
            try {
                const result = await getGroupSummary(logs);
                setSummary(result);
            } catch (e) {
                setError("Failed to get AI summary. Please try again.");
                console.error(e);
            }
        });
    }

    if (summary) {
        return (
            <Alert className="mt-4 mb-4" data-ai-hint="error summary">
                <Cpu className="h-4 w-4" />
                <div className="flex justify-between items-start mb-2">
                    <AlertTitle>AI Analysis</AlertTitle>
                    <Badge variant={priorityVariants[summary.priority]}>
                        {priorityIcons[summary.priority]}
                        {summary.priority} Priority
                    </Badge>
                </div>
                <AlertDescription className="space-y-2">
                    <div>
                        <h4 className="font-semibold">Summary</h4>
                        <p>{summary.summary}</p>
                    </div>
                     <div>
                        <h4 className="font-semibold">Potential Root Cause</h4>
                        <p>{summary.rootCause}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold">Impact</h4>
                        <p>{summary.impact}</p>
                    </div>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="my-4 flex flex-col items-start gap-2">
            <Button onClick={handleSummarize} disabled={isPending} size="sm">
                {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
                ) : (
                    <><Lightbulb className="mr-2 h-4 w-4" />Get AI Summary</>
                )}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}
