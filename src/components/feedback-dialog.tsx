/**
 * @fileoverview
 * A dialog component for users to submit feedback or report issues.
 * It captures user input along with a snapshot of the application's state
 * and the user's environment for comprehensive debugging context.
 */

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackApplicationState, FeedbackSubmission, FeedbackUserEnvironment } from "@/types";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Define the validation schema for the form using Zod
const feedbackFormSchema = z.object({
  feedbackType: z.enum(["bug", "feature", "ux", "other"], {
    required_error: "Please select a feedback type.",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }).max(5000, {
    message: "Description must not be longer than 5000 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }).optional().or(z.literal("")),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationState: FeedbackApplicationState;
}

export function FeedbackDialog({ open, onOpenChange, applicationState }: FeedbackDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEnvironment, setUserEnvironment] = useState<FeedbackUserEnvironment | null>(null);

  // Capture user environment details when the component mounts on the client
  useEffect(() => {
    if (open) {
        setUserEnvironment({
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
        });
    }
  }, [open]);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      feedbackType: undefined,
      description: "",
      email: "",
    },
  });

  const handleDialogClose = (isOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(isOpen);
      if (!isOpen) {
        form.reset();
      }
    }
  };

  async function onSubmit(data: FeedbackFormValues) {
    if (!userEnvironment) {
        toast({
            variant: "destructive",
            title: "Submission Error",
            description: "Could not capture environment details. Please try again.",
        });
        return;
    }
    
    setIsSubmitting(true);
    
    const submissionPayload: FeedbackSubmission = {
      ...data,
      feedbackType: data.feedbackType as FeedbackSubmission['feedbackType'],
      applicationState,
      userEnvironment,
    };

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "An unknown error occurred.");
      }

      if (result.logged && result.emailSent) {
          toast({
              title: "Feedback Sent",
              description: "Your feedback has been logged and sent successfully.",
          });
      } else if (result.logged) {
          toast({
              title: "Feedback Logged",
              description: "Your feedback was logged, but could not be sent via email.",
          });
      } else {
          throw new Error(result.message || "An unknown error occurred during submission.");
      }
      
      onOpenChange(false);
      form.reset();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Could not submit feedback.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Report an Issue or Share Feedback</DialogTitle>
          <DialogDescription>
            Your feedback helps us improve. Please provide as much detail as possible.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="feedbackType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feedback Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="ux">UI/UX Feedback</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please describe the issue and what you were doing when it occurred."
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Email (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Provide your email if you'd like us to be able to contact you.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Feedback
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
