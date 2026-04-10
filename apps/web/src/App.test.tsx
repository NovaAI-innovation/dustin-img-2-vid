import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("shows prompt enhancement disabled state when backend feature is disabled", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          prompt_assist_enabled: false,
          webhook_enabled: false,
          polling_interval_seconds: 5
        }
      })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          models: ["v5.6"],
          qualities: ["720p"],
          durations: [5],
          motion_modes: ["normal"],
          aspect_ratios: ["16:9", "9:16"],
          camera_movements: [],
          defaults: {
            model: "v5.6",
            quality: "720p",
            duration: 5,
            motion_mode: "normal",
            aspect_ratio: "16:9",
            camera_movement: null
          }
        }
      })
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Prompt enhancement is disabled by backend configuration.")).toBeInTheDocument();
    });
  });
});
