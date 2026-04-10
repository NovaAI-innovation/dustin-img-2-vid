import { ApiEnvelope, Balance, CreateJobResponse, Features, GenerationOptions, JobDetail, JobListItem } from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
const backendHint = `API is unreachable at ${baseUrl || "Vite proxy (/api -> http://127.0.0.1:8000)"}. Ensure backend is running.`;

function parseErrorText(raw: string): string {
  const fallback = raw || "Request failed.";
  try {
    const parsed = JSON.parse(raw) as {
      detail?: {
        error?: { message?: string };
      } | string;
      error?: { message?: string };
      message?: string;
    };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }
    if (parsed.detail && typeof parsed.detail === "object" && parsed.detail.error?.message) {
      return parsed.detail.error.message;
    }
    if (parsed.error?.message) {
      return parsed.error.message;
    }
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // fall through to raw text
  }
  return fallback;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${url}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
  } catch {
    throw new Error(backendHint);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorText(text));
  }

  const json = (await response.json()) as ApiEnvelope<T> | T;
  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiEnvelope<T>).data as T;
  }
  return json as T;
}

export function getFeatures(): Promise<Features> {
  return request<Features>("/api/v1/features");
}

export function getGenerationOptions(): Promise<GenerationOptions> {
  return request<GenerationOptions>("/api/v1/options");
}

export function assistPrompt(prompt: string, goal: string): Promise<{ assisted_prompt: string }> {
  return request<{ assisted_prompt: string }>("/api/v1/prompts/assist", {
    method: "POST",
    body: JSON.stringify({ prompt, goal })
  });
}

export function createTextToVideoJob(body: {
  prompt: string;
  negative_prompt?: string;
  duration: number;
  model: string;
  quality: string;
  motion_mode: string;
  aspect_ratio: string;
  camera_movement?: string;
  seed?: number;
  webhook_id?: string;
}): Promise<CreateJobResponse> {
  return request<CreateJobResponse>("/api/v1/jobs/text-to-video", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function createImageToVideoJob(body: {
  prompt: string;
  img_id: number;
  negative_prompt?: string;
  duration: number;
  model: string;
  quality: string;
  motion_mode: string;
  aspect_ratio: string;
  camera_movement?: string;
  seed?: number;
  webhook_id?: string;
}): Promise<CreateJobResponse> {
  return request<CreateJobResponse>("/api/v1/jobs/image-to-video", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function getJob(jobId: string): Promise<JobDetail> {
  return request<JobDetail>(`/api/v1/jobs/${jobId}`);
}

export function getJobs(): Promise<JobListItem[]> {
  return request<JobListItem[]>("/api/v1/jobs");
}

export function getJobVideoLink(jobId: string): string {
  return `${baseUrl}/api/v1/jobs/${jobId}/video`;
}

export function getBalance(): Promise<Balance> {
  return request<Balance>("/api/v1/account/balance");
}

export async function uploadImage(file: File): Promise<{ img_id: number }> {
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/media/image`, {
      method: "POST",
      body: form
    });
  } catch {
    throw new Error(backendHint);
  }
  if (!response.ok) {
    throw new Error(parseErrorText(await response.text()));
  }
  const json = (await response.json()) as ApiEnvelope<{ img_id: number }>;
  if (!json?.data || typeof json.data.img_id !== "number") {
    throw new Error("Image upload response did not include a valid image ID.");
  }
  return json.data;
}
