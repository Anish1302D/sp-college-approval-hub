export const initialRequests = [
  {
    id: "REQ-2026-0891",
    title: "High-Performance Computing Server for AI Research Lab",
    category: "IT Infrastructure",
    amount: 1250000, // ₹12.5 Lakhs (>= 5L Escalated)
    type: "financial",
    requesterName: "Dr. Arvind Kulkarni",
    requesterRole: "Head of Computer Science Dept",
    department: "Computer Science & Engg",
    dateSubmitted: "2026-08-08",
    status: "Escalated to SFSP Trust",
    priority: "High",
    description: "Purchase of GPU-enabled HPC Server node (2x NVIDIA A100 80GB, 256GB RAM) for AI & ML postgraduate research and PhD thesis projects funded under college development initiative.",
    attachments: [
      { name: "HPC_Vendor_Quotations.pdf", size: "3.4 MB", type: "PDF Document" },
      { name: "Dept_Recommendation_Note.docx", size: "1.1 MB", type: "Word Document" }
    ],
    history: [
      { date: "2026-08-08 10:15 AM", user: "Dr. Arvind Kulkarni", action: "Submitted Request", notes: "Submitted bill requisition for approval." },
      { date: "2026-08-09 02:30 PM", user: "Principal Dr. R. S. Patil", action: "Escalated to Trust (SFSP)", notes: "Amount ₹12,50,000 exceeds college ₹5L approval threshold. Forwarded to SFSP Governing Authority for executive review." }
    ],
    thresholdType: "Escalated (≥ ₹5 Lakhs)"
  },
  {
    id: "REQ-2026-0885",
    title: "Chemistry Lab Glassware & Chemical Reagents Renewal",
    category: "Laboratory Supplies",
    amount: 345000, // ₹3.45 Lakhs (< 5L)
    type: "financial",
    requesterName: "Prof. Sunita Deshmukh",
    requesterRole: "Professor, Chemistry Dept",
    department: "Chemistry Department",
    dateSubmitted: "2026-08-07",
    status: "Pending Approval",
    priority: "Medium",
    description: "Annual procurement of lab glassware (beakers, volumetric flasks, burettes) and analytical grade chemicals for undergraduate practical examination sessions.",
    attachments: [
      { name: "Chemical_Reagent_List_2026.pdf", size: "2.1 MB", type: "PDF Document" }
    ],
    history: [
      { date: "2026-08-07 11:00 AM", user: "Prof. Sunita Deshmukh", action: "Submitted Request", notes: "Requisition created." }
    ],
    thresholdType: "Standard (< ₹5 Lakhs)"
  },
  {
    id: "REQ-2026-0872",
    title: "Central Auditorium Sound & Stage Lighting System Upgrade",
    category: "Infrastructure & Campus",
    amount: 780000, // ₹7.8 Lakhs (>= 5L)
    type: "financial",
    requesterName: "Prof. Rajesh Joshi",
    requesterRole: "Cultural Committee Convener",
    department: "Administration & Campus Maintenance",
    dateSubmitted: "2026-08-05",
    status: "Escalated to SFSP Trust",
    priority: "High",
    description: "Upgrade of central auditorium digital audio mixer, wireless lapel mics, line array speakers, and DMX LED stage lights ahead of the Annual National Symposium.",
    attachments: [
      { name: "Stage_Audio_DPR.pdf", size: "4.8 MB", type: "PDF Document" },
      { name: "Comparative_Statement.xlsx", size: "850 KB", type: "Excel Spreadsheet" }
    ],
    history: [
      { date: "2026-08-05 09:30 AM", user: "Prof. Rajesh Joshi", action: "Submitted Request", notes: "Submitted." },
      { date: "2026-08-06 04:15 PM", user: "Principal Dr. R. S. Patil", action: "Escalated to Trust (SFSP)", notes: "Forwarded for Trust approval due to ₹7.8L budget." }
    ],
    thresholdType: "Escalated (≥ ₹5 Lakhs)"
  },
  {
    id: "REQ-2026-0860",
    title: "Physics Department Optics Lab Laser Bench",
    category: "Laboratory Equipment",
    amount: 185000, // ₹1.85 Lakhs (< 5L)
    type: "financial",
    requesterName: "Dr. Meera Nene",
    requesterRole: "Associate Professor, Physics",
    department: "Physics Department",
    dateSubmitted: "2026-08-04",
    status: "Approved",
    priority: "Low",
    description: "He-Ne Laser optical bench setup with interferometers for modern optics experiments.",
    attachments: [
      { name: "Laser_Bench_Invoice.pdf", size: "1.5 MB", type: "PDF Document" }
    ],
    history: [
      { date: "2026-08-04 02:00 PM", user: "Dr. Meera Nene", action: "Submitted Request", notes: "Requisition logged." },
      { date: "2026-08-05 10:20 AM", user: "Principal Dr. R. S. Patil", action: "Approved Request", notes: "Approved within Principal discretionary authority (< ₹5L)." }
    ],
    thresholdType: "Standard (< ₹5 Lakhs)"
  },
  {
    id: "REQ-2026-0854",
    title: "Library Digital Cataloging Workstations & RFID Scanners",
    category: "Library & Learning",
    amount: 420000, // ₹4.2 Lakhs (< 5L)
    type: "financial",
    requesterName: "Mr. Anil Shinde",
    requesterRole: "Chief Librarian",
    department: "Central Library",
    dateSubmitted: "2026-08-02",
    status: "Approved",
    priority: "Medium",
    description: "4x All-in-One desktop workstations with integrated handheld RFID barcode readers for rapid book check-in/check-out counter.",
    attachments: [
      { name: "Library_RFID_Proposal.pdf", size: "2.8 MB", type: "PDF Document" }
    ],
    history: [
      { date: "2026-08-02 04:00 PM", user: "Mr. Anil Shinde", action: "Submitted Request", notes: "Submitted." },
      { date: "2026-08-03 11:45 AM", user: "Principal Dr. R. S. Patil", action: "Approved Request", notes: "Approved." }
    ],
    thresholdType: "Standard (< ₹5 Lakhs)"
  },
  {
    id: "REQ-2026-0849",
    title: "Air Conditioning Installation in Main Staff Common Room",
    category: "Infrastructure & Amenities",
    amount: 210000,
    type: "financial",
    requesterName: "Prof. Prakash Jadhav",
    requesterRole: "Faculty Representative",
    department: "Staff Welfare",
    dateSubmitted: "2026-08-01",
    status: "Rejected",
    priority: "Low",
    description: "Installation of 3x 2-Ton Inverter Split AC units in the main faculty lounge.",
    attachments: [
      { name: "AC_Vendor_Estimate.pdf", size: "980 KB", type: "PDF Document" }
    ],
    history: [
      { date: "2026-08-01 10:00 AM", user: "Prof. Prakash Jadhav", action: "Submitted Request", notes: "Requisition filed." },
      { date: "2026-08-02 03:30 PM", user: "Principal Dr. R. S. Patil", action: "Rejected Request", notes: "Budget allocation deferred to Q4 campus renovation cycle." }
    ],
    thresholdType: "Standard (< ₹5 Lakhs)"
  },
  // Non-Financial Faculty Issues
  {
    id: "ISSUE-2026-0104",
    title: "Frequent Wi-Fi Connectivity Dropouts in Science Building Wing B",
    category: "IT & Network Issue",
    amount: null,
    type: "non-financial",
    requesterName: "Dr. Anand Kulkarni",
    requesterRole: "Associate Professor",
    department: "Botany Department",
    dateSubmitted: "2026-08-09",
    status: "In Review",
    priority: "High",
    description: "Faculty and postgraduate students face persistent wireless disconnects during online lecture broadcasts and research portal access in Rooms B-201 to B-208.",
    attachments: [
      { name: "Signal_Coverage_Map.png", size: "750 KB", type: "Image" }
    ],
    history: [
      { date: "2026-08-09 11:30 AM", user: "Dr. Anand Kulkarni", action: "Logged Issue", notes: "Issue logged." },
      { date: "2026-08-09 04:00 PM", user: "Principal Dr. R. S. Patil", action: "Assigned to IT Admin", notes: "Assigned to IT Cell for access point signal optimization." }
    ],
    thresholdType: "Non-Financial Issue"
  },
  {
    id: "ISSUE-2026-0098",
    title: "Request for Ergonomic Office Seating in Electronics Seminar Room",
    category: "Faculty Welfare & Facilities",
    amount: null,
    type: "non-financial",
    requesterName: "Prof. Smita Pawar",
    requesterRole: "Assistant Professor",
    department: "Electronics & Telecomm",
    dateSubmitted: "2026-08-06",
    status: "Resolved",
    priority: "Medium",
    description: "Existing chairs in Room E-104 are broken and causing posture strain during long research group reviews.",
    attachments: [],
    history: [
      { date: "2026-08-06 02:15 PM", user: "Prof. Smita Pawar", action: "Logged Issue", notes: "Submitted." },
      { date: "2026-08-07 01:00 PM", user: "Principal Dr. R. S. Patil", action: "Resolved", notes: "Replaced 12 chairs from spare central inventory." }
    ],
    thresholdType: "Non-Financial Issue"
  },
  {
    id: "ISSUE-2026-0091",
    title: "Hazardous Chemical Disposal Procedure Protocol Review",
    category: "Safety & Governance",
    amount: null,
    type: "non-financial",
    requesterName: "Dr. Vikram Sethi",
    requesterRole: "Lab Safety Officer",
    department: "Chemistry & Bio-Tech",
    dateSubmitted: "2026-08-03",
    status: "In Review",
    priority: "High",
    description: "Urgent need for external accredited hazardous waste management vendor pickup as waste storage drums are reaching capacity limit.",
    attachments: [
      { name: "Chemical_Waste_Audit.pdf", size: "1.8 MB", type: "PDF Document" }
    ],
    history: [
      { date: "2026-08-03 09:00 AM", user: "Dr. Vikram Sethi", action: "Logged Issue", notes: "Logged." }
    ],
    thresholdType: "Non-Financial Issue"
  }
];
