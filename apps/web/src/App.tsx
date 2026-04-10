
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  assistPrompt,
  createImageToVideoJob,
  createTextToVideoJob,
  getBalance,
  getFeatures,
  getGenerationOptions,
  getJob,
  getJobVideoLink,
  getJobs,
  uploadImage
} from "./api";
import { Balance, Features, GenerationOptions, JobDetail, JobListItem } from "./types";

type Mode = "text" | "image";
type TabKey = "generation" | "library" | "settings";

interface UiSettings {
  mode: Mode;
  useAssist: boolean;
  assistGoal: string;
  defaultDuration: number;
  defaultModel: string;
  defaultQuality: string;
  defaultMotionMode: string;
  defaultAspectRatio: string;
  defaultCameraMovement: string;
  defaultSeed: string;
  defaultWebhookId: string;
  pollingIntervalSeconds: number;
}

const terminalStatuses = new Set(["succeeded", "failed", "moderated"]);
const settingsStorageKey = "pixverse.ui.settings.v1";
const supportedUploadTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxUploadBytes = 20 * 1024 * 1024;

function parseSavedSettings(): Partial<UiSettings> {
  try {
    const raw = localStorage.getItem(settingsStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function hasChoice(choices: string[], value: string): boolean {
  return choices.includes(value);
}

function hasNumberChoice(choices: number[], value: number): boolean {
  return choices.includes(value);
}

function statusTone(status: string): "running" | "succeeded" | "failed" | "queued" {
  if (status === "running") return "running";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "moderated") return "failed";
  return "queued";
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return "n/a";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toLocaleString();
}

function formatElapsed(createdAt?: string, updatedAt?: string): string {
  if (!createdAt || !updatedAt) return "n/a";
  const start = new Date(createdAt).getTime();
  const end = new Date(updatedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "n/a";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  return `${seconds}s`;
}

export default function App() {
  const [features, setFeatures] = useState<Features | null>(null);
  const [options, setOptions] = useState<GenerationOptions | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobsHistory, setJobsHistory] = useState<JobListItem[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("generation");
  const [loading, setLoading] = useState(false);
  const [assistLoading, setAssistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [model, setModel] = useState("v3.5");
  const [quality, setQuality] = useState("720p");
  const [motionMode, setMotionMode] = useState("normal");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [cameraMovement, setCameraMovement] = useState("");
  const [seed, setSeed] = useState("");
  const [webhookId, setWebhookId] = useState("");
  const [imageId, setImageId] = useState<number | "">("");
  const [manualImageId, setManualImageId] = useState("");
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<UiSettings>({
    mode: "text",
    useAssist: false,
    assistGoal: "Improve this prompt for cinematic short-form video generation.",
    defaultDuration: 5,
    defaultModel: "v3.5",
    defaultQuality: "720p",
    defaultMotionMode: "normal",
    defaultAspectRatio: "16:9",
    defaultCameraMovement: "",
    defaultSeed: "",
    defaultWebhookId: "",
    pollingIntervalSeconds: 5
  });

  const canShowAssist = Boolean(features?.prompt_assist_enabled);
  const promptEnhancementEnabled = canShowAssist && settings.useAssist;
  const modelSupportsCameraMovement = model === "v4" || model === "v4.5";
  const effectivePollingIntervalMs = useMemo(
    () => Math.max(settings.pollingIntervalSeconds, 1) * 1000,
    [settings.pollingIntervalSeconds]
  );

  useEffect(() => {
    Promise.all([getFeatures(), getGenerationOptions()])
      .then(([featureFlags, optionCatalog]) => {
        const saved = parseSavedSettings();

        const resolvedModel = saved.defaultModel && hasChoice(optionCatalog.models, saved.defaultModel)
          ? saved.defaultModel
          : optionCatalog.defaults.model;
        const resolvedQuality = saved.defaultQuality && hasChoice(optionCatalog.qualities, saved.defaultQuality)
          ? saved.defaultQuality
          : optionCatalog.defaults.quality;
        const resolvedDuration = typeof saved.defaultDuration === "number" && hasNumberChoice(optionCatalog.durations, saved.defaultDuration)
          ? saved.defaultDuration
          : optionCatalog.defaults.duration;
        const resolvedMotion = saved.defaultMotionMode && hasChoice(optionCatalog.motion_modes, saved.defaultMotionMode)
          ? saved.defaultMotionMode
          : optionCatalog.defaults.motion_mode;
        const resolvedAspectRatio =
          saved.defaultAspectRatio && hasChoice(optionCatalog.aspect_ratios, saved.defaultAspectRatio)
            ? saved.defaultAspectRatio
            : optionCatalog.defaults.aspect_ratio;

        const cameraChoices = optionCatalog.camera_movements;
        const resolvedCamera =
          saved.defaultCameraMovement && hasChoice(cameraChoices, saved.defaultCameraMovement)
            ? saved.defaultCameraMovement
            : optionCatalog.defaults.camera_movement ?? "";

        const resolvedMode: Mode = saved.mode === "image" ? "image" : "text";

        const resolvedSettings: UiSettings = {
          mode: resolvedMode,
          useAssist: Boolean(saved.useAssist) && featureFlags.prompt_assist_enabled,
          assistGoal: saved.assistGoal?.trim() || "Improve this prompt for cinematic short-form video generation.",
          defaultDuration: resolvedDuration,
          defaultModel: resolvedModel,
          defaultQuality: resolvedQuality,
          defaultMotionMode: resolvedMotion,
          defaultAspectRatio: resolvedAspectRatio,
          defaultCameraMovement: resolvedCamera,
          defaultSeed: saved.defaultSeed ?? "",
          defaultWebhookId: saved.defaultWebhookId ?? "",
          pollingIntervalSeconds: Number(saved.pollingIntervalSeconds ?? featureFlags.polling_interval_seconds) || featureFlags.polling_interval_seconds
        };

        setFeatures(featureFlags);
        setOptions(optionCatalog);
        setSettings(resolvedSettings);

        setMode(resolvedSettings.mode);
        setModel(resolvedSettings.defaultModel);
        setQuality(resolvedSettings.defaultQuality);
        setDuration(resolvedSettings.defaultDuration);
        setMotionMode(resolvedSettings.defaultMotionMode);
        setAspectRatio(resolvedSettings.defaultAspectRatio);
        setCameraMovement(resolvedSettings.defaultCameraMovement);
        setSeed(resolvedSettings.defaultSeed);
        setWebhookId(resolvedSettings.defaultWebhookId);

        localStorage.setItem(settingsStorageKey, JSON.stringify(resolvedSettings));
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!job || terminalStatuses.has(job.status)) {
      return;
    }
    const id = setInterval(() => {
      getJob(job.job_id)
        .then((next) => setJob(next))
        .catch((e) => setError(String(e)));
    }, effectivePollingIntervalMs);
    return () => clearInterval(id);
  }, [job, effectivePollingIntervalMs]);

  useEffect(() => {
    if (activeTab !== "library") return;
    refreshHistory();
  }, [activeTab]);

  useEffect(() => {
    if (!modelSupportsCameraMovement && cameraMovement) {
      setCameraMovement("");
    }
  }, [modelSupportsCameraMovement, cameraMovement]);

  useEffect(() => {
    refreshBalance();
    refreshHistory();
  }, []);

  const historySummary = useMemo(() => {
    const total = jobsHistory.length;
    const completed = jobsHistory.filter((entry) => entry.status === "succeeded").length;
    const failed = jobsHistory.filter((entry) => entry.status === "failed" || entry.status === "moderated").length;
    const running = jobsHistory.filter((entry) => entry.status === "running").length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, running, successRate };
  }, [jobsHistory]);

  function updateSettings(patch: Partial<UiSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    localStorage.setItem(settingsStorageKey, JSON.stringify(next));
  }

  function applySettingsToGeneration() {
    setMode(settings.mode);
    setModel(settings.defaultModel);
    setQuality(settings.defaultQuality);
    setDuration(settings.defaultDuration);
    setMotionMode(settings.defaultMotionMode);
    setAspectRatio(settings.defaultAspectRatio);
    setCameraMovement(settings.defaultCameraMovement);
    setSeed(settings.defaultSeed);
    setWebhookId(settings.defaultWebhookId);
  }

  function resetSettingsToApiDefaults() {
    if (!options || !features) return;
    const fallback: UiSettings = {
      mode: "text",
      useAssist: false,
      assistGoal: "Improve this prompt for cinematic short-form video generation.",
      defaultDuration: options.defaults.duration,
      defaultModel: options.defaults.model,
      defaultQuality: options.defaults.quality,
      defaultMotionMode: options.defaults.motion_mode,
      defaultAspectRatio: options.defaults.aspect_ratio,
      defaultCameraMovement: options.defaults.camera_movement ?? "",
      defaultSeed: "",
      defaultWebhookId: "",
      pollingIntervalSeconds: features.polling_interval_seconds
    };
    setSettings(fallback);
    localStorage.setItem(settingsStorageKey, JSON.stringify(fallback));
    applySettingsToGeneration();
  }
  async function onUploadImage(file: File | null) {
    if (!file) return;
    setError(null);
    if (!supportedUploadTypes.has(file.type)) {
      setImageUploadMessage("Unsupported image format. Use PNG, JPG/JPEG, or WEBP.");
      setImageId("");
      return;
    }
    if (file.size <= 0) {
      setImageUploadMessage("Image file is empty.");
      setImageId("");
      return;
    }
    if (file.size > maxUploadBytes) {
      setImageUploadMessage("Image is too large. Max size is 20MB.");
      setImageId("");
      return;
    }

    setImageUploadLoading(true);
    setImageUploadMessage(`Uploading ${file.name}...`);
    setImageId("");
    try {
      const result = await uploadImage(file);
      const parsedId = Number(result.img_id);
      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        throw new Error("Upload succeeded but API did not return a valid image ID.");
      }
      setImageId(parsedId);
      setImageUploadMessage(`Image uploaded successfully. Image ID: ${parsedId}`);
    } catch (e) {
      const errorText = String(e);
      setError(errorText);
      setImageUploadMessage(`Image upload failed: ${errorText}`);
    } finally {
      setImageUploadLoading(false);
    }
  }

  async function onAssistPrompt() {
    if (!canShowAssist || !settings.useAssist) return;
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }
    setError(null);
    setAssistLoading(true);
    try {
      const result = await assistPrompt(prompt, settings.assistGoal);
      setPrompt(result.assisted_prompt);
    } catch (e) {
      setError(String(e));
    } finally {
      setAssistLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedPrompt = prompt.trim();
      if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
      }

      const parsedSeed = seed.trim() ? Number(seed) : undefined;
      if (parsedSeed !== undefined && (!Number.isInteger(parsedSeed) || parsedSeed < 0)) {
        throw new Error("Seed must be a non-negative integer.");
      }

      let finalPrompt = normalizedPrompt;
      if (canShowAssist && settings.useAssist) {
        const result = await assistPrompt(normalizedPrompt, settings.assistGoal);
        finalPrompt = result.assisted_prompt;
        setPrompt(result.assisted_prompt);
      }

      const basePayload = {
        prompt: finalPrompt,
        negative_prompt: negativePrompt || undefined,
        duration,
        model,
        quality,
        motion_mode: motionMode,
        aspect_ratio: aspectRatio,
        camera_movement: modelSupportsCameraMovement ? cameraMovement || undefined : undefined,
        seed: parsedSeed,
        webhook_id: webhookId || undefined
      };

      if (mode === "text") {
        const created = await createTextToVideoJob(basePayload);
        const first = await getJob(created.job_id);
        setJob(first);
        await refreshHistory();
      } else {
        const manualCandidate = manualImageId.trim() ? Number(manualImageId) : undefined;
        if (manualCandidate !== undefined && (!Number.isInteger(manualCandidate) || manualCandidate <= 0)) {
          throw new Error("Override Image ID must be a positive integer.");
        }

        const effectiveImageId = manualCandidate ?? Number(imageId);
        if (!Number.isInteger(effectiveImageId) || effectiveImageId <= 0) {
          throw new Error("Image ID is required for image-to-video.");
        }
        const created = await createImageToVideoJob({
          ...basePayload,
          img_id: effectiveImageId
        });
        const first = await getJob(created.job_id);
        setJob(first);
        await refreshHistory();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshBalance() {
    setError(null);
    try {
      const data = await getBalance();
      setBalance(data);
    } catch (e) {
      setError(String(e));
    }
  }

  async function refreshHistory() {
    setJobsLoading(true);
    setError(null);
    try {
      const items = await getJobs();
      setJobsHistory(Array.isArray(items) ? items : []);
    } catch (e) {
      setError(String(e));
      setJobsHistory([]);
    } finally {
      setJobsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient-gradient" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-a" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-b" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />

      <header className="hero-card glass-panel">
        <div className="hero-copy">
          <p className="kicker">PixVerse Studio / Video Generation App</p>
          <h1>pixverse-gen</h1>
        </div>
        <div className="hero-meta" aria-label="System health">
          <div className="metric-pill">
            <span>Total Jobs</span>
            <strong>{historySummary.total}</strong>
          </div>
          <div className="metric-pill">
            <span>Success Rate</span>
            <strong>{historySummary.successRate}%</strong>
          </div>
          <div className="metric-pill">
            <span>Polling</span>
            <strong>{settings.pollingIntervalSeconds}s</strong>
          </div>
          <div className="metric-pill">
            <span>Prompt Assist</span>
            <strong>{canShowAssist ? "Enabled" : "Disabled"}</strong>
          </div>
          <div className="metric-pill">
            <span>Provider</span>
            <strong>PixVerse</strong>
          </div>
        </div>
      </header>

      <nav className="tab-nav glass-panel" aria-label="App sections">
        <button
          type="button"
          className={activeTab === "generation" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("generation")}
        >
          Generation
        </button>
        <button
          type="button"
          className={activeTab === "library" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("library")}
        >
          Library
        </button>
        <button
          type="button"
          className={activeTab === "settings" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </nav>

      <section className="overview-strip glass-panel section-card" aria-label="Job overview">
        <div className="overview-head">
          <h2>Execution Overview</h2>
          <p className="hint">Real-time run state, quality profile, and account telemetry for faster operator decisions.</p>
        </div>
        <div className="overview-grid">
          <article className="overview-item">
            <span>Active Pipeline</span>
            <strong>{mode === "image" ? "Image to Video" : "Text to Video"}</strong>
          </article>
          <article className="overview-item">
            <span>Current Profile</span>
            <strong>{`${model} / ${quality} / ${duration}s`}</strong>
          </article>
          <article className="overview-item">
            <span>Frame Settings</span>
            <strong>{`${aspectRatio} / ${motionMode}`}</strong>
          </article>
          <article className="overview-item">
            <span>Running Jobs</span>
            <strong>{historySummary.running}</strong>
          </article>
          <article className="overview-item">
            <span>Failed Jobs</span>
            <strong>{historySummary.failed}</strong>
          </article>
          <article className="overview-item">
            <span>Credits</span>
            <strong>{balance ? `${balance.credit_monthly + balance.credit_package}` : "n/a"}</strong>
          </article>
        </div>
      </section>

      <div className="content-grid">
        <section className="main-column">
          {activeTab === "generation" && (
            <form onSubmit={onSubmit} className="stack-16" aria-label="Generation form">
              <article className="glass-panel section-card">
                <div className="section-header">
                  <h2>Prompt Console</h2>
                  <div className="header-indicators">
                    <span className="mono-tag">{mode === "text" ? "TEXT_PIPELINE" : "IMAGE_PIPELINE"}</span>
                    <span className={promptEnhancementEnabled ? "status-indicator is-active" : "status-indicator is-inactive"}>
                      <span className="status-dot-mini" aria-hidden="true" />
                      Prompt Enhancement {canShowAssist ? (settings.useAssist ? "Enabled" : "Disabled") : "Unavailable"}
                    </span>
                  </div>
                </div>

                <div className="field-grid two-col">
                  <div className="field">
                    <label htmlFor="mode">Mode</label>
                    <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                      <option value="text">Text to Video</option>
                      <option value="image">Image to Video</option>
                    </select>
                    <p className="hint">Choose `Text to Video` for prompt-only generation, or `Image to Video` to animate a source image.</p>
                  </div>

                  <div className="field">
                    <label htmlFor="webhook-id">Webhook ID</label>
                    <input
                      id="webhook-id"
                      value={webhookId}
                      onChange={(e) => setWebhookId(e.target.value)}
                      placeholder="Optional"
                    />
                    <p className="hint">Optional callback identifier. Leave blank unless your backend expects a webhook tracking value.</p>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="prompt">Prompt</label>
                  <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} required />
                  <p className="hint">Describe the scene, subject, style, lighting, and motion clearly. This is the main generation instruction.</p>
                </div>

                <div className="field">
                  <label htmlFor="negative-prompt">Negative Prompt</label>
                  <input
                    id="negative-prompt"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Optional constraints"
                  />
                  <p className="hint">Add things to avoid, like blur, artifacts, extra limbs, text overlays, or unwanted styles.</p>
                </div>

                {canShowAssist ? (
                  <div className="assist-row">
                    <p className="hint">
                      {settings.useAssist
                        ? "Prompt enhancement is enabled and can be applied before submitting."
                        : "Prompt enhancement is disabled in Settings."}
                    </p>
                    <button type="button" onClick={onAssistPrompt} disabled={assistLoading || !settings.useAssist || !prompt.trim()}>
                      {assistLoading ? "Assisting..." : "Assist Now"}
                    </button>
                  </div>
                ) : (
                  <p className="hint">Prompt enhancement is disabled by backend configuration.</p>
                )}

                {mode === "image" && (
                  <div className="source-box" aria-live="polite">
                    <h3>Image Source</h3>
                    <div className="field-grid two-col">
                      <div className="field">
                        <label htmlFor="upload-source">Upload Source Image</label>
                        <input
                          id="upload-source"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            onUploadImage(e.target.files?.[0] || null);
                            e.currentTarget.value = "";
                          }}
                          disabled={imageUploadLoading}
                        />
                        <p className="hint">Upload a PNG, JPEG, or WebP image to use as the animation source.</p>
                        {imageUploadLoading && <p className="hint">Uploading image...</p>}
                        {imageUploadMessage && <p className="hint">{imageUploadMessage}</p>}
                      </div>

                      <div className="field">
                        <label htmlFor="resolved-image-id">Image ID (auto-populated)</label>
                        <input
                          id="resolved-image-id"
                          type="text"
                          value={imageId || ""}
                          readOnly
                          placeholder="Upload an image to get a valid ID"
                        />
                        <p className="hint">PixVerse image IDs can expire. Upload a fresh image if generation fails.</p>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="image-id-override">Override Image ID (optional)</label>
                      <input
                        id="image-id-override"
                        type="number"
                        value={manualImageId}
                        onChange={(e) => setManualImageId(e.target.value)}
                        placeholder="Use only if you need a specific existing image ID"
                      />
                      <p className="hint">Enter a numeric PixVerse image ID only when you need to force a specific existing uploaded image.</p>
                    </div>
                  </div>
                )}
              </article>
              <article className="glass-panel section-card">
                <div className="section-header">
                  <h2>Generation Parameters</h2>
                  <span className="mono-tag">VALIDATED</span>
                </div>

                <div className="field-grid generation-params-grid">
                  <div className="field">
                    <label htmlFor="duration">Duration</label>
                    <select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                      {(options?.durations ?? [duration]).map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}s
                        </option>
                      ))}
                    </select>
                    <p className="hint">Video length in seconds. Use shorter clips for faster results, longer clips for extended motion.</p>
                  </div>

                  <div className="field">
                    <label htmlFor="model">Model</label>
                    <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                      {(options?.models ?? [model]).map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                    <p className="hint">Generation model version. Newer models usually improve detail and motion but may have different capabilities.</p>
                  </div>

                  <div className="field">
                    <label htmlFor="quality">Quality</label>
                    <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
                      {(options?.qualities ?? [quality]).map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                    <p className="hint">Output resolution preset. Higher quality improves detail but can increase generation time and cost.</p>
                  </div>

                  <div className="field">
                    <label htmlFor="motion-mode">Motion Mode</label>
                    <select id="motion-mode" value={motionMode} onChange={(e) => setMotionMode(e.target.value)}>
                      {(options?.motion_modes ?? [motionMode]).map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                    <p className="hint">Controls movement intensity and behavior. Start with `normal` for balanced motion.</p>
                  </div>

                  <div className="field">
                    <label htmlFor="aspect-ratio">Aspect Ratio</label>
                    <select id="aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                      {(options?.aspect_ratios ?? [aspectRatio]).map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                    <p className="hint">Frame shape for output. Common options: `16:9` landscape, `9:16` vertical, `1:1` square.</p>
                  </div>

                  <div className="field">
                    <label htmlFor="camera-movement">Camera Movement</label>
                    <select
                      id="camera-movement"
                      value={cameraMovement}
                      onChange={(e) => setCameraMovement(e.target.value)}
                      disabled={!modelSupportsCameraMovement}
                    >
                      <option value="">None</option>
                      {(options?.camera_movements ?? []).map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                    <p className="hint">Adds camera moves like pan/zoom. Set `None` for static framing.</p>
                  </div>

                  <div className="field">
                    <label htmlFor="seed">Seed</label>
                    <input id="seed" type="number" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Optional" />
                    <p className="hint">Optional numeric seed for repeatability. Use the same seed to reproduce similar outputs.</p>
                  </div>
                </div>

                {!modelSupportsCameraMovement && <p className="grid-inline-note">Camera movement is only available for v4/v4.5 models.</p>}

                <div className="action-row">
                  <button type="submit" disabled={loading} className="primary-action">
                    {loading ? "Submitting..." : "Create Job"}
                  </button>
                </div>
              </article>
            </form>
          )}

          {activeTab === "library" && (
            <article className="glass-panel section-card stack-16">
              <div className="section-header split-header">
                <div>
                  <h2>Generated Clips</h2>
                  <p className="hint">All clips created during the current backend session.</p>
                </div>
                <button type="button" onClick={refreshHistory} disabled={jobsLoading}>
                  {jobsLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {jobsHistory.length === 0 ? (
                <p className="hint">No generated clips found yet.</p>
              ) : (
                <div className="history-grid">
                  {jobsHistory.map((item) => {
                    const tone = statusTone(item.status);
                    const hasVideo = Boolean(item.video_url || item.status === "succeeded");
                    const profile = [
                      item.quality,
                      item.duration ? `${item.duration}s` : undefined,
                      item.aspect_ratio
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <article key={item.job_id} className="history-card glass-subpanel">
                        <div className="history-meta history-meta-head">
                          <div className="status-chip">
                            <span className={`status-dot tone-${tone}`} aria-hidden="true" />
                            <strong>{item.status.toUpperCase()}</strong>
                          </div>
                          <span>{formatTimestamp(item.created_at)}</span>
                        </div>

                        <div className="history-preview">
                          {hasVideo ? (
                            <video className="video history-video" src={getJobVideoLink(item.job_id)} controls />
                          ) : (
                            <div className={`history-state history-state-${tone}`}>
                              <span className={`history-state-dot tone-${tone}`} aria-hidden="true" />
                              <p className="history-state-title">{tone === "failed" ? "No clip was produced." : "Clip is not available yet."}</p>
                              <p className="history-state-detail">
                                {item.fail_reason ?? (tone === "running" ? "Rendering in progress. Refresh shortly." : "No video output was returned for this job.")}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="video-meta-grid">
                          <div className="video-meta-item">
                            <span>Job ID</span>
                            <strong className="mono-data">{item.job_id}</strong>
                          </div>
                          <div className="video-meta-item">
                            <span>Model</span>
                            <strong>{item.model ?? "n/a"}</strong>
                          </div>
                          <div className="video-meta-item">
                            <span>Profile</span>
                            <strong>{profile || "n/a"}</strong>
                          </div>
                          <div className="video-meta-item">
                            <span>Render Time</span>
                            <strong>{formatElapsed(item.created_at, item.updated_at)}</strong>
                          </div>
                        </div>

                        {item.prompt && (
                          <p className="history-prompt">
                            <strong>Prompt:</strong> {item.prompt}
                          </p>
                        )}

                        <div className="history-actions">
                          {hasVideo ? (
                            <>
                              <a className="link-btn" href={getJobVideoLink(item.job_id)} target="_blank" rel="noreferrer">
                                Open Clip
                              </a>
                              <a className="link-btn link-btn-secondary" href={getJobVideoLink(item.job_id)} target="_blank" rel="noreferrer" download>
                                Download
                              </a>
                            </>
                          ) : (
                            <>
                              <button type="button" className="link-btn history-action-disabled" disabled>
                                Open Clip
                              </button>
                              <button type="button" className="link-btn link-btn-secondary history-action-disabled" disabled>
                                Download
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          )}

          {activeTab === "settings" && (
            <article className="glass-panel section-card stack-16">
              <div className="section-header">
                <h2>Saved Defaults</h2>
                <span className="mono-tag">LOCAL_PROFILE</span>
              </div>
              <p className="hint">These settings are saved in your browser and used to prefill the Generation form.</p>

              <div className="field-grid settings-grid">
                <div className="field">
                  <label htmlFor="settings-mode">Default Mode</label>
                  <select
                    id="settings-mode"
                    value={settings.mode}
                    onChange={(e) => updateSettings({ mode: e.target.value as Mode })}
                  >
                    <option value="text">Text to Video</option>
                    <option value="image">Image to Video</option>
                  </select>
                  <p className="hint">Prefills how new jobs start. Pick the mode you use most often.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-model">Default Model</label>
                  <select
                    id="settings-model"
                    value={settings.defaultModel}
                    onChange={(e) => updateSettings({ defaultModel: e.target.value })}
                  >
                    {(options?.models ?? [settings.defaultModel]).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Default model automatically selected when opening the Generation tab.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-quality">Default Quality</label>
                  <select
                    id="settings-quality"
                    value={settings.defaultQuality}
                    onChange={(e) => updateSettings({ defaultQuality: e.target.value })}
                  >
                    {(options?.qualities ?? [settings.defaultQuality]).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Default output quality. Higher quality can be slower or consume more credits.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-duration">Default Duration</label>
                  <select
                    id="settings-duration"
                    value={settings.defaultDuration}
                    onChange={(e) => updateSettings({ defaultDuration: Number(e.target.value) })}
                  >
                    {(options?.durations ?? [settings.defaultDuration]).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}s
                      </option>
                    ))}
                  </select>
                  <p className="hint">Default clip length in seconds used for new jobs.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-motion">Default Motion Mode</label>
                  <select
                    id="settings-motion"
                    value={settings.defaultMotionMode}
                    onChange={(e) => updateSettings({ defaultMotionMode: e.target.value })}
                  >
                    {(options?.motion_modes ?? [settings.defaultMotionMode]).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Default motion behavior for new generations. Keep `normal` if unsure.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-aspect-ratio">Default Aspect Ratio</label>
                  <select
                    id="settings-aspect-ratio"
                    value={settings.defaultAspectRatio}
                    onChange={(e) => updateSettings({ defaultAspectRatio: e.target.value })}
                  >
                    {(options?.aspect_ratios ?? [settings.defaultAspectRatio]).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Default frame ratio for new jobs based on your target platform.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-camera">Default Camera Movement</label>
                  <select
                    id="settings-camera"
                    value={settings.defaultCameraMovement}
                    onChange={(e) => updateSettings({ defaultCameraMovement: e.target.value })}
                  >
                    <option value="">None</option>
                    {(options?.camera_movements ?? []).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Default camera movement effect. Use `None` for steady shots.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-seed">Default Seed</label>
                  <input
                    id="settings-seed"
                    type="number"
                    value={settings.defaultSeed}
                    onChange={(e) => updateSettings({ defaultSeed: e.target.value })}
                    placeholder="Optional"
                  />
                  <p className="hint">Optional numeric default seed. Leave blank for fresh random results each run.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-webhook">Default Webhook ID</label>
                  <input
                    id="settings-webhook"
                    value={settings.defaultWebhookId}
                    onChange={(e) => updateSettings({ defaultWebhookId: e.target.value })}
                    placeholder="Optional"
                  />
                  <p className="hint">Optional default webhook identifier attached to each new job request.</p>
                </div>

                <div className="field field-span">
                  <label htmlFor="settings-goal">Assist Goal</label>
                  <input
                    id="settings-goal"
                    value={settings.assistGoal}
                    onChange={(e) => updateSettings({ assistGoal: e.target.value })}
                  />
                  <p className="hint">Instruction sent to prompt assist. Describe what kind of prompt improvements you want.</p>
                </div>

                <div className="field">
                  <label htmlFor="settings-polling">Polling Interval (seconds)</label>
                  <input
                    id="settings-polling"
                    type="number"
                    min={1}
                    max={30}
                    value={settings.pollingIntervalSeconds}
                    onChange={(e) => updateSettings({ pollingIntervalSeconds: Number(e.target.value) || 5 })}
                  />
                  <p className="hint">How often job status refreshes. Use 3-10s for responsive updates without excess API calls.</p>
                </div>
              </div>

              {canShowAssist && (
                <>
                  <label className="inline-check" htmlFor="settings-assist">
                    <input
                      id="settings-assist"
                      type="checkbox"
                      checked={settings.useAssist}
                      onChange={(e) => updateSettings({ useAssist: e.target.checked })}
                    />
                    Enable prompt enhancement by default
                  </label>
                  <p className="hint">Turn this on to enable prompt enhancement. Turn it off to disable prompt enhancement.</p>
                </>
              )}

              <div className="button-row">
                <button type="button" onClick={applySettingsToGeneration}>
                  Apply Defaults to Generation
                </button>
                <button type="button" onClick={resetSettingsToApiDefaults}>
                  Reset to API Defaults
                </button>
              </div>
            </article>
          )}

          {error && (
            <section className="glass-panel error-banner" role="alert">
              <p className="error">{error}</p>
            </section>
          )}
        </section>

        <aside className="side-column stack-16" aria-label="System telemetry">
          <section className="glass-panel section-card">
            <div className="section-header split-header">
              <h2>Account Balance</h2>
              <button type="button" onClick={refreshBalance}>Refresh</button>
            </div>
            {balance ? (
              <ul className="metric-list">
                <li><span>Account</span><strong className="mono-data">{balance.account_id}</strong></li>
                <li><span>Monthly Credits</span><strong className="mono-data">{balance.credit_monthly}</strong></li>
                <li><span>Package Credits</span><strong className="mono-data">{balance.credit_package}</strong></li>
              </ul>
            ) : (
              <p className="hint">No balance loaded yet.</p>
            )}
          </section>

          <section className="glass-panel section-card">
            <div className="section-header">
              <h2>Latest Job</h2>
            </div>
            {!job && <p className="hint">No job submitted yet.</p>}
            {job && (
              <div className="stack-10">
                <p><strong>Job ID:</strong> <span className="mono-data">{job.job_id}</span></p>
                <p><strong>Provider Video ID:</strong> <span className="mono-data">{job.provider_video_id}</span></p>
                <p><strong>Status:</strong> {job.status}</p>
                {job.provider_status !== undefined && <p><strong>Provider Status:</strong> {job.provider_status}</p>}
                {(job.video_url || job.status === "succeeded") && (
                  <>
                    <video className="video" src={getJobVideoLink(job.job_id)} controls />
                    <div className="link-row">
                      <a href={getJobVideoLink(job.job_id)} target="_blank" rel="noreferrer">
                        Open Video
                      </a>
                      <a href={getJobVideoLink(job.job_id)} target="_blank" rel="noreferrer" download>
                        Download Video
                      </a>
                    </div>
                  </>
                )}
                {job.fail_reason && <p className="error">Reason: {job.fail_reason}</p>}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
