export type JobStatus = "queued" | "running" | "succeeded" | "moderated" | "failed";

export interface FeaturesResponse {
  prompt_assist_enabled: boolean;
  webhook_enabled: boolean;
  polling_interval_seconds: number;
}

export interface PromptAssistRequest {
  prompt: string;
  goal?: string;
}

export interface PromptAssistResponse {
  assisted_prompt: string;
}

export interface CreateJobResponse {
  job_id: string;
  provider_video_id: number;
  status: JobStatus;
}

