export default function StatusBadge({ report }) {
  if (!report || report.status === undefined) return <span className="badge pending">Pending</span>;
  if (report.status === 'DRAFT') return <span className="badge draft">Draft</span>;
  if (report.late) return <span className="badge late">Late</span>;
  return <span className="badge submitted">Submitted</span>;
}
