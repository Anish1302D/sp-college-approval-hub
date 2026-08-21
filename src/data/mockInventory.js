export const initialInventory = [
  {
    id: "INV-2026-001",
    itemName: "Epson EB-2250U 1080p High-Lumens Projector",
    category: "AV Equipment",
    location: "Main Auditorium & Seminar Halls",
    quantity: 14,
    unitValue: 75000,
    totalValue: 1050000,
    condition: "Good",
    status: "In Use",
    linkedBill: "BILL-2025-0442",
    lastInspected: "2026-07-15"
  },
  {
    id: "INV-2026-002",
    itemName: "Dell OptiPlex 7090 Desktop (Core i7 / 16GB / 512GB SSD)",
    category: "IT Hardware",
    location: "Computer Center Lab 1 & 2",
    quantity: 65,
    unitValue: 62000,
    totalValue: 4030000,
    condition: "Good",
    status: "In Use",
    linkedBill: "BILL-2025-0389",
    lastInspected: "2026-07-20"
  },
  {
    id: "INV-2026-003",
    itemName: "Zeiss Primostar 3 Clinical Microscope",
    category: "Laboratory Equipment",
    location: "Biology & Micro lab",
    quantity: 28,
    unitValue: 48000,
    totalValue: 1344000,
    condition: "Good",
    status: "In Use",
    linkedBill: "BILL-2025-0511",
    lastInspected: "2026-06-30"
  },
  {
    id: "INV-2026-004",
    itemName: "Executive Mesh Ergonomic Office Chair",
    category: "Furniture",
    location: "Faculty Chambers Wing A & B",
    quantity: 80,
    unitValue: 8500,
    totalValue: 680000,
    condition: "Needs Maintenance",
    status: "In Use",
    linkedBill: "BILL-2025-0210",
    lastInspected: "2026-08-01"
  },
  {
    id: "INV-2026-005",
    itemName: "HP LaserJet Enterprise M507dn Heavy-Duty Printer",
    category: "Office Machinery",
    location: "Principal Office & Exam Section",
    quantity: 6,
    unitValue: 42000,
    totalValue: 252000,
    condition: "Good",
    status: "In Use",
    linkedBill: "BILL-2025-0604",
    lastInspected: "2026-07-28"
  },
  {
    id: "INV-2026-006",
    itemName: "APC Smart-UPS RT 10kVA Online UPS System",
    category: "Power & Electrical",
    location: "Server Room Room 102",
    quantity: 2,
    unitValue: 240000,
    totalValue: 480000,
    condition: "Critical Maintenance Needed",
    status: "Under Repair",
    linkedBill: "BILL-2024-0199",
    lastInspected: "2026-08-04"
  }
];

export const purchaseBills = [
  {
    billNo: "BILL-2026-0089",
    vendor: "TechnoWorld Systems India Pvt Ltd",
    date: "2026-08-05",
    amount: 1250000,
    items: "NVIDIA HPC GPU Server Node",
    status: "Pending Principal & Trust Release",
    paymentMode: "Bank NEFT Transfer"
  },
  {
    billNo: "BILL-2026-0072",
    vendor: "Borosil Scientific Supplies Ltd",
    date: "2026-08-04",
    amount: 345000,
    items: "Lab Glassware & Chemical Reagents",
    status: "Approved",
    paymentMode: "Cheque / NEFT"
  },
  {
    billNo: "BILL-2025-0442",
    vendor: "Epson India Electronics Ltd",
    date: "2025-11-12",
    amount: 1050000,
    items: "14x Epson EB-2250U Projectors",
    status: "Paid & Archived",
    paymentMode: "Bank Transfer"
  }
];
