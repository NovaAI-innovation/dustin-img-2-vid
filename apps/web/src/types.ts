export type JobStatus = "queued" | "running" | "succeeded" | "moderated" | "failed";

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    trace_id?: string;
    provider_code?: number;
  };
}

export interface Features {
  prompt_assist_enabled: boolean;
  webhook_enabled: boolean;
  polling_interval_seconds: number;
}

export interface GenerationDefaults {
  model: string;
  quality: string;
  duration: number;
  motion_mode: string;
  aspect_ratio: string;
  camera_movement?: string | null;
}

export interface GenerationOptions {
  models: string[];
  qualities: string[];
  durations: number[];
  motion_modes: string[];
  aspect_ratios: string[];
  camera_movements: string[];
  defaults: GenerationDefaults;
}

export interface CreateJobResponse {
  job_id: string;
  provider_video_id: number;
  status: JobStatus;
}

export interface JobDetail {
  job_id: string;
  provider_video_id: number;
  status: JobStatus;
  provider_status?: number;
  video_url?: string;
  fail_reason?: string;
  mode?: "text" | "image";
  prompt?: string;
  negative_prompt?: string;
  duration?: number;
  model?: string;
  quality?: string;
  motion_mode?: string;
  aspect_ratio?: string;
  camera_movement?: string | null;
  seed?: number | string;
  webhook_id?: string;
  img_id?: number;
}

export interface JobListItem extends JobDetail {
  created_at: string;
  updated_at: string;
}

export interface Balance {
  account_id: number;
  credit_monthly: number;
  credit_package: number;
}
