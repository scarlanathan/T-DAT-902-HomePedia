import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommuneSearch } from "./CommuneSearch";

const lyon = {
  location_id: "loc-2",
  code_commune: "69123",
  nom_commune: "Lyon",
  code_departement: "69",
  code_postal: "69001",
};

vi.mock("@/api", () => ({
  searchLocations: vi.fn(() => Promise.resolve([lyon])),
}));

describe("CommuneSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows empty input when no commune is selected", () => {
    render(
      <CommuneSearch codeCommune="" nomCommune="" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("displays commune label from props", () => {
    render(
      <CommuneSearch
        codeCommune="75101"
        nomCommune="Paris"
        codePostal="75001"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Paris (75001)")).toBeInTheDocument();
  });

  it("debounces search and shows results", async () => {
    const api = await import("@/api");
    const onSelect = vi.fn();
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <CommuneSearch codeCommune="75101" nomCommune="Paris" onSelect={onSelect} />,
    );

    const input = screen.getByRole("searchbox");
    await ue.clear(input);
    await ue.type(input, "lyon");

    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => {
      expect(api.searchLocations).toHaveBeenCalledWith("lyon", 15);
    });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText(/Lyon/)).toBeInTheDocument();
  });

  it("calls onSelect when a result is clicked", async () => {
    const api = await import("@/api");
    const onSelect = vi.fn();
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <CommuneSearch codeCommune="75101" nomCommune="Paris" onSelect={onSelect} />,
    );

    const input = screen.getByRole("searchbox");
    await ue.clear(input);
    await ue.type(input, "ly");
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => expect(api.searchLocations).toHaveBeenCalled());

    await ue.click(screen.getByRole("option", { name: /Lyon/i }));

    expect(onSelect).toHaveBeenCalledWith(lyon);
    expect(screen.getByDisplayValue("Lyon (69001)")).toBeInTheDocument();
  });

  it("does not call onClear when clearing an empty search", async () => {
    const onClear = vi.fn();
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <CommuneSearch codeCommune="" nomCommune="" onSelect={vi.fn()} onClear={onClear} />,
    );

    const input = screen.getByRole("searchbox");
    await ue.type(input, "a");
    await ue.clear(input);

    expect(onClear).not.toHaveBeenCalled();
  });

  it("calls onClear when the search is cleared while a commune is selected", async () => {
    const onClear = vi.fn();
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <CommuneSearch
        codeCommune="75101"
        nomCommune="Paris"
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    );

    await ue.clear(screen.getByRole("searchbox"));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("falls back to INSEE in search results when postal is missing", async () => {
    const api = await import("@/api");
    vi.mocked(api.searchLocations).mockResolvedValueOnce([
      {
        location_id: "loc-3",
        code_commune: "13055",
        nom_commune: "Marseille",
        code_departement: "13",
        code_postal: null,
      },
    ]);
    const onSelect = vi.fn();
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <CommuneSearch codeCommune="" nomCommune="" onSelect={onSelect} />,
    );

    const input = screen.getByRole("searchbox");
    await ue.type(input, "mar");
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => expect(api.searchLocations).toHaveBeenCalled());
    expect(screen.getByRole("option", { name: /Marseille \(13055\)/i })).toBeInTheDocument();
  });

  it("does not search for queries shorter than 2 characters", async () => {
    const api = await import("@/api");
    const { userEvent } = await import("@testing-library/user-event");
    const ue = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <CommuneSearch codeCommune="75101" nomCommune="Paris" onSelect={vi.fn()} />,
    );

    const input = screen.getByRole("searchbox");
    await ue.clear(input);
    await ue.type(input, "l");
    await vi.advanceTimersByTimeAsync(300);

    expect(api.searchLocations).not.toHaveBeenCalled();
  });
});
