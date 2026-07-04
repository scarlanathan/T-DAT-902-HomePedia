import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiStatusBanner } from "./ApiStatusBanner";

describe("ApiStatusBanner", () => {
  it("renders nothing while loading", () => {
    const { container } = render(
      <ApiStatusBanner
        loading
        error={null}
        health={{ status: "ok", postgres: "up" }}
        apiReachable
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when healthy", () => {
    const { container } = render(
      <ApiStatusBanner
        loading={false}
        error={null}
        health={{ status: "ok", postgres: "up" }}
        apiReachable
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows API error alert with backend hint when unreachable", () => {
    render(
      <ApiStatusBanner
        loading={false}
        error="Failed to fetch"
        health={null}
        apiReachable={false}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/API error/i);
    expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
    expect(screen.getByText(/backend\/scripts\/run\.sh/)).toBeInTheDocument();
  });

  it("shows warning when health is unavailable", () => {
    render(
      <ApiStatusBanner
        loading={false}
        error={null}
        health={null}
        apiReachable
      />,
    );
    expect(screen.getByText(/Health check unavailable/i)).toBeInTheDocument();
  });

  it("shows warning when postgres is down", () => {
    render(
      <ApiStatusBanner
        loading={false}
        error={null}
        health={{ status: "degraded", postgres: "down" }}
        apiReachable
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Postgres is down/i);
  });
});
