import type { ReactNode } from "react";
import { forwardRef, useImperativeHandle } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTransactions } from "@/api";
import { MAP_PANEL_HEIGHT_CLASS } from "@/lib/map-layout";
import { FranceMap } from "./FranceMap";

vi.mock("@/lib/theme-context", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}));

const miniDeptGeo = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { code: "75", nom: "Paris" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2, 48],
            [3, 48],
            [3, 49],
            [2, 49],
            [2, 48],
          ],
        ],
      },
    },
  ],
};

vi.mock("@/api", () => ({
  fetchTransactions: vi.fn(() =>
    Promise.resolve([
      {
        transaction_id: "t1",
        location_id: "loc1",
        date_mutation: "2020-07-01",
        valeur_fonciere: "100000",
        price_per_sqm_built: "3000",
        type_local: "Maison",
        longitude: 2.35,
        latitude: 48.85,
      },
    ]),
  ),
  fetchLocation: vi.fn(),
  resolveLocationForDepartment: vi.fn(),
}));

const mockBounds = {
  getWest: () => 1,
  getSouth: () => 46,
  getEast: () => 3,
  getNorth: () => 49,
};

const mockFlyTo = vi.fn();
const mockFitBounds = vi.fn();

vi.mock("react-map-gl/maplibre", () => {
  const MockMap = forwardRef(function MockMap(
    {
      children,
      className,
    }: {
      children?: ReactNode;
      className?: string;
    },
    ref: React.Ref<{
      getMap: () => {
        getBounds: () => typeof mockBounds;
        loaded: () => boolean;
        flyTo: typeof mockFlyTo;
        fitBounds: typeof mockFitBounds;
      };
    }>,
  ) {
    useImperativeHandle(ref, () => ({
      getMap: () => ({
        getBounds: () => mockBounds,
        loaded: () => true,
        getLayer: () => null,
        setPaintProperty: vi.fn(),
        setLayoutProperty: vi.fn(),
        getCanvas: () => ({ style: { cursor: "" } }),
        flyTo: mockFlyTo,
        fitBounds: mockFitBounds,
      }),
    }));
    return (
      <div data-testid="maplibre-map" className={className}>
        {children}
      </div>
    );
  });
  return {
    __esModule: true,
    default: MockMap,
    Source: ({ id, children }: { id?: string; children?: ReactNode }) => (
      <div data-testid={`map-source-${id}`}>{children}</div>
    ),
    Layer: ({ id }: { id?: string }) => <div data-testid={`map-layer-${id}`} />,
    NavigationControl: () => null,
  };
});

describe("FranceMap", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("departements-version-simplifiee")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(miniDeptGeo),
          });
        }
        return Promise.reject(new Error("unexpected fetch"));
      }) as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFlyTo.mockClear();
    mockFitBounds.mockClear();
  });

  it("applies shared height classes on the map shell and fills the panel", async () => {
    const { container } = render(<FranceMap onCommuneSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("maplibre-map")).toBeInTheDocument();
    });

    const shell = container.firstElementChild as HTMLElement;
    for (const token of MAP_PANEL_HEIGHT_CLASS.split(/\s+/)) {
      expect(shell.className).toContain(token);
    }

    const inner = shell.firstElementChild as HTMLElement;
    expect(inner.className).toContain("h-full");
    expect(inner.className).toContain("w-full");

    expect(screen.getByTestId("maplibre-map")).toHaveClass(
      "absolute",
      "inset-0",
      "h-full",
      "w-full",
    );
  });

  it("shows department layers but no sales until a commune is selected", async () => {
    render(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        onCommuneSelect={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("map-source-fr-depts")).toBeInTheDocument();
    });
    expect(screen.getByTestId("map-layer-fr-depts-fill")).toBeInTheDocument();
    expect(screen.queryByTestId("map-source-dvf-points")).not.toBeInTheDocument();
    expect(fetchTransactions).not.toHaveBeenCalled();
    expect(screen.getByText(/select a commune/i)).toBeInTheDocument();
    expect(screen.queryByText(/click a department/i)).not.toBeInTheDocument();
  });

  it("loads sales for the selected commune only", async () => {
    render(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        selectedCommune="75101"
        onCommuneSelect={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(fetchTransactions).toHaveBeenCalledWith({
        code_commune: "75101",
        from: "2020-01-01",
        to: "2024-12-31",
        limit: 1000,
        include_location: false,
      });
    });
    expect(screen.getByTestId("map-source-dvf-points")).toBeInTheDocument();
    expect(screen.getByText(/1 sale in commune/i)).toBeInTheDocument();
  });

  it("shows transaction fetch error when commune sales fail to load", async () => {
    vi.mocked(fetchTransactions).mockRejectedValueOnce(new Error("network"));
    render(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        selectedCommune="75101"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/network/i)).toBeInTheDocument();
    });
  });

  it("zooms out to France when the selected commune is cleared", async () => {
    const { rerender } = render(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        selectedCommune="75101"
      />,
    );

    await waitFor(() => {
      expect(fetchTransactions).toHaveBeenCalled();
    });

    mockFitBounds.mockClear();

    rerender(
      <FranceMap from="2020-01-01" to="2024-12-31" selectedCommune={undefined} />,
    );

    expect(mockFitBounds).toHaveBeenCalledWith(
      [
        [2, 48],
        [3, 49],
      ],
      expect.objectContaining({ maxZoom: 6 }),
    );
  });

  it("hides sales when the selected commune is cleared", async () => {
    const { rerender } = render(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        selectedCommune="75101"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("map-source-dvf-points")).toBeInTheDocument();
    });

    rerender(
      <FranceMap from="2020-01-01" to="2024-12-31" selectedCommune={undefined} />,
    );

    expect(screen.queryByTestId("map-source-dvf-points")).not.toBeInTheDocument();
    expect(screen.getByText(/select a commune/i)).toBeInTheDocument();
    expect(screen.queryByText(/click a department/i)).not.toBeInTheDocument();
  });

  it("refetches sales when the selected commune changes", async () => {
    const { rerender } = render(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        selectedCommune="75101"
      />,
    );

    await waitFor(() => {
      expect(fetchTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ code_commune: "75101" }),
      );
    });

    vi.mocked(fetchTransactions).mockClear();

    rerender(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        selectedCommune="01094"
      />,
    );

    await waitFor(() => {
      expect(fetchTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ code_commune: "01094" }),
      );
    });
  });

  it("ignores transactions without coordinates", async () => {
    vi.mocked(fetchTransactions).mockResolvedValueOnce([
      {
        transaction_id: "t1",
        location_id: "loc1",
        date_mutation: "2020-07-01",
        valeur_fonciere: "100000",
        price_per_sqm_built: "3000",
        type_local: "Maison",
        longitude: null,
        latitude: null,
      },
    ]);

    render(
      <FranceMap
        from="2020-01-01"
        to="2024-12-31"
        selectedCommune="75101"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/0 sales in commune/i)).toBeInTheDocument();
    });
  });

  it("shows ranking hint and disables picking when readOnly", async () => {
    render(<FranceMap readOnly />);

    await waitFor(() => {
      expect(
        screen.getByText(/Select a commune from the ranking list/i),
      ).toBeInTheDocument();
    });
  });
});
