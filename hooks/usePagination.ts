import { useState, useEffect } from "react";

export const PAGE_SIZE = 10;

export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the source array changes (new filter etc.)
  useEffect(() => {
    setPage(1);
  }, [items]);

  const visible = items.slice(0, page * pageSize);
  const hasMore = visible.length < items.length;
  const total = items.length;

  const loadMore = () => {
    if (hasMore) setPage((p) => p + 1);
  };

  return { visible, hasMore, loadMore, total, showing: visible.length };
}
