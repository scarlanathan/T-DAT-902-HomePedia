import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommunePicker, COMMUNE_LOAD_ERROR_KEY } from "./CommunePicker";
import { fixtureLocation } from "@/test/fixtures/api";

const lyon = {
  location_id: "loc-2",
  code_commune: "69123",
  nom_commune: "Lyon",
  code_departement: "69",
  code_postal: "69001",
};

describe("CommunePicker", () => {
  it("prompts to click a department when none focused", () => {
    render(
      <CommunePicker communes={[]} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/Click a department on the map/i)).toBeInTheDocument();
  });

  it("lists communes and calls onSelect", async () => {
    const onSelect = vi.fn();
    const ue = userEvent.setup();
    render(
      <CommunePicker
        codeDepartement="75"
        communes={[fixtureLocation]}
        selectedCodeCommune="75101"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText(/dept\. 75/i)).toBeInTheDocument();
    expect(screen.getByText(/1 commune/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Paris \(75001\)/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await ue.click(screen.getByRole("option", { name: /Paris \(75001\)/i }));
    expect(onSelect).toHaveBeenCalledWith(fixtureLocation);
  });

  it("shows loading state", () => {
    render(
      <CommunePicker
        codeDepartement="75"
        communes={[]}
        loading
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Loading communes/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(
      <CommunePicker
        codeDepartement="75"
        communes={[]}
        error={COMMUNE_LOAD_ERROR_KEY}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Could not load communes/i)).toBeInTheDocument();
  });

  it("shows empty state when the department has no communes", () => {
    render(
      <CommunePicker
        codeDepartement="75"
        communes={[]}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/No communes in the API for this department/i),
    ).toBeInTheDocument();
  });

  it("filters communes by name or postal code", async () => {
    const ue = userEvent.setup();
    render(
      <CommunePicker
        codeDepartement="69"
        communes={[fixtureLocation, lyon]}
        onSelect={vi.fn()}
      />,
    );

    await ue.type(
      screen.getByPlaceholderText(/Filter by name or postal code/i),
      "69001",
    );

    expect(screen.getByRole("option", { name: /Lyon/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Paris/i })).not.toBeInTheDocument();
  });

  it("shows no match message when the filter excludes all communes", async () => {
    const ue = userEvent.setup();
    render(
      <CommunePicker
        codeDepartement="75"
        communes={[fixtureLocation]}
        onSelect={vi.fn()}
      />,
    );

    await ue.type(
      screen.getByPlaceholderText(/Filter by name or postal code/i),
      "zzzz",
    );

    expect(screen.getByText(/No match/i)).toBeInTheDocument();
  });
});
