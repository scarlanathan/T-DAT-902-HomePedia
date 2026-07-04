import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RankingPagination } from "./RankingPagination";
import { renderWithAuth } from "@/test/test-utils";

describe("RankingPagination", () => {
  it("shows range and navigates pages", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    renderWithAuth(
      <RankingPagination
        page={1}
        pageSize={50}
        total={155}
        totalPages={2}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    expect(screen.getByText("1-50 of 155")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("changes page size", () => {
    const onPageSizeChange = vi.fn();

    renderWithAuth(
      <RankingPagination
        page={1}
        pageSize={50}
        total={100}
        totalPages={2}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Rows per page"), {
      target: { value: "100" },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });
});
