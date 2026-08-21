export const initialNotifications = [
  {
    id: "NOTIF-01",
    title: "New Escalated Financial Requisition",
    message: "HPC Server Node (₹12,50,000) escalated by Principal for SFSP Governing Trust decision.",
    timestamp: "10 mins ago",
    read: false,
    type: "escalation",
    roleTarget: "sfsp"
  },
  {
    id: "NOTIF-02",
    title: "Bill Requisition Approved",
    message: "Chemistry Lab Supplies (REQ-2026-0885) approved by Principal Dr. R. S. Patil.",
    timestamp: "2 hours ago",
    read: false,
    type: "approval",
    roleTarget: "faculty"
  },
  {
    id: "NOTIF-03",
    title: "Inventory Alert",
    message: "APC Smart-UPS RT 10kVA flagged for urgent battery maintenance in Server Room.",
    timestamp: "Yesterday",
    read: true,
    type: "warning",
    roleTarget: "admin"
  },
  {
    id: "NOTIF-04",
    title: "Quarterly Audit Report Generated",
    message: "Q2 Institutional Financial & Inventory Audit log exported to PDF.",
    timestamp: "2 days ago",
    read: true,
    type: "info",
    roleTarget: "all"
  }
];

export const initialAuditLogs = [
  {
    id: "AUD-9012",
    timestamp: "2026-08-09 14:30:11 EST",
    actor: "Principal Dr. R. S. Patil",
    role: "Principal / Executive Approver",
    action: "ESCALATE_BILL",
    targetItem: "REQ-2026-0891 (HPC AI Server)",
    amount: "₹12,50,000",
    details: "Amount exceeds ₹5,00,000 threshold limit. Forwarded to SFSP Trust board.",
    ipAddress: "192.168.10.45",
    status: "Success"
  },
  {
    id: "AUD-9011",
    timestamp: "2026-08-08 10:15:00 EST",
    actor: "Dr. Arvind Kulkarni",
    role: "Faculty (HOD CS)",
    action: "CREATE_REQUEST",
    targetItem: "REQ-2026-0891 (HPC AI Server)",
    amount: "₹12,50,000",
    details: "New financial bill request submitted with 2 attachments.",
    ipAddress: "192.168.12.102",
    status: "Success"
  },
  {
    id: "AUD-9010",
    timestamp: "2026-08-05 10:20:45 EST",
    actor: "Principal Dr. R. S. Patil",
    role: "Principal / Executive Approver",
    action: "APPROVE_BILL",
    targetItem: "REQ-2026-0860 (Laser Bench)",
    amount: "₹1,85,000",
    details: "Approved within Principal discretionary limit.",
    ipAddress: "192.168.10.45",
    status: "Success"
  },
  {
    id: "AUD-9009",
    timestamp: "2026-08-03 11:00:22 EST",
    actor: "Admin Clerk V. More",
    role: "Admin Clerk",
    action: "UPDATE_INVENTORY",
    targetItem: "INV-2026-006 (APC UPS 10kVA)",
    amount: "N/A",
    details: "Flagged maintenance status to Critical Maintenance Needed.",
    ipAddress: "192.168.10.88",
    status: "Success"
  }
];
