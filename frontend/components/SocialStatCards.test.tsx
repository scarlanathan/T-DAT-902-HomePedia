import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fixtureSocialSummary } from "@/test/fixtures/api";
import { SocialStatCards } from "./SocialStatCards";

describe("SocialStatCards", () => {
  it("renders social indicators", async () => {
    const ue = userEvent.setup();
    render(<SocialStatCards row={fixtureSocialSummary} irisCount={3} />);
    expect(screen.getByText(/32,000\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/14\.2\s*%/)).toBeInTheDocument();
    expect(screen.getByText("3.1×")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Bottom 10%: 11,000 €/yr · Top 10%: 62,000 €/yr. Smaller ratio means incomes are closer together",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("FiLoSoFi 2021")).not.toBeInTheDocument();
    await ue.click(screen.getByRole("button", { name: /about caf beneficiaries/i }));
    expect(
      await screen.findByRole("dialog", { name: /caf beneficiaries details/i }),
    ).toHaveTextContent("Neighbourhood-level (IRIS) breakdown available for 3 areas.");
  });

  it("shows CAF hint without IRIS detail when no IRIS rows", () => {
    render(<SocialStatCards row={fixtureSocialSummary} irisCount={0} />);
    expect(screen.getByText("Family benefits share")).toBeInTheDocument();
    expect(screen.queryByText(/neighbourhood/i)).not.toBeInTheDocument();
  });

  it("shows dashes when row is missing", () => {
    render(<SocialStatCards row={null} />);
    expect(screen.getAllByText("-")).toHaveLength(4);
  });

  it("shows ellipsis while loading", () => {
    render(<SocialStatCards row={null} loading />);
    expect(screen.getAllByText("…")).toHaveLength(4);
  });
});
