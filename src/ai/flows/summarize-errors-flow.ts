'use server';
/**
 * @fileOverview An AI flow to summarize a group of error logs.
 *
 * - summarizeErrorGroup - A function that handles the error summarization.
 */

import {ai} from '@/ai/genkit';
import { 
  SummarizeErrorsInputSchema, 
  SummarizeErrorsOutputSchema,
  type SummarizeErrorsInput,
  type SummarizeErrorsOutput
} from '@/types';

export async function summarizeErrorGroup(input: SummarizeErrorsInput): Promise<SummarizeErrorsOutput> {
  return summarizeErrorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeErrorsPrompt',
  input: {schema: SummarizeErrorsInputSchema},
  output: {schema: SummarizeErrorsOutputSchema},
  prompt: `You are an expert Senior Site Reliability Engineer. Your task is to analyze a group of error logs from a software application and provide a concise analysis.

Based on the following list of errors, identify patterns and common themes.

Error Logs:
{{#each this}}
- Error {{error_number}}: {{log_message}}
{{/each}}

Provide a summary of the problem, the likely root cause, the potential impact, and a recommended priority for investigation.
`,
});

const summarizeErrorsFlow = ai.defineFlow(
  {
    name: 'summarizeErrorsFlow',
    inputSchema: SummarizeErrorsInputSchema,
    outputSchema: SummarizeErrorsOutputSchema,
  },
  async (logs) => {
    if (logs.length === 0) {
      // Return a default value that matches the schema
      return {
        summary: "No logs provided for analysis.",
        rootCause: "N/A",
        impact: "N/A",
        priority: "Low",
      };
    }
    const {output} = await prompt(logs);
    return output!;
  }
);
