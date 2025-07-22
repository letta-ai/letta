export function getPageNumbersToShow(
  currentPage: number,
  totalPages: number,
  visiblePageCount: number,
): number[] {
  const halfVisible = Math.floor(visiblePageCount / 2);
  let startPage = Math.max(1, currentPage - halfVisible);
  let endPage = Math.min(totalPages, currentPage + halfVisible);

  if (endPage - startPage + 1 < visiblePageCount) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + visiblePageCount - 1);
    } else if (endPage === totalPages) {
      startPage = Math.max(1, endPage - visiblePageCount + 1);
    }
  }

  return Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i,
  );
}
