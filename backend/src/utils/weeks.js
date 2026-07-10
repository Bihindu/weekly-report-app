// Week convention: weeks start on Monday. weekStart is the Monday date.
export function mondayOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function sundayOf(monday) {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + 6);
  return d;
}

// A report is "late" if submitted after Monday 23:59 UTC of the FOLLOWING week.
export function deadlineFor(weekStart) {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 7);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
