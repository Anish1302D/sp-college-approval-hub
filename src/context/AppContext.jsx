import React, { createContext, useContext, useState } from 'react';
import { initialRequests } from '../data/mockRequests';
import { initialInventory, purchaseBills as initialBills } from '../data/mockInventory';
import { initialNotifications, initialAuditLogs } from '../data/mockNotifications';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentRole, setCurrentRole] = useState('principal'); // default role 'principal'
  const [activePage, setActivePage] = useState('dashboard');
  
  const [requests, setRequests] = useState(initialRequests);
  const [inventory, setInventory] = useState(initialInventory);
  const [bills, setBills] = useState(initialBills);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Toast Notification state
  const [toast, setToast] = useState(null);
  
  // Modal states
  const [selectedRequestModal, setSelectedRequestModal] = useState(null);
  const [isNewFinancialModalOpen, setIsNewFinancialModalOpen] = useState(false);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Add new Financial or Non-Financial request
  const addRequest = (newReqData) => {
    const isEscalated = newReqData.amount && newReqData.amount >= 500000;
    const reqId = newReqData.type === 'financial' 
      ? `REQ-2026-0${Math.floor(8900 + Math.random() * 100)}` 
      : `ISSUE-2026-0${Math.floor(100 + Math.random() * 50)}`;
    
    let initialStatus = 'Pending Approval';
    if (newReqData.type === 'financial' && isEscalated) {
      initialStatus = 'Escalated to SFSP Trust';
    } else if (newReqData.type === 'non-financial') {
      initialStatus = 'In Review';
    }

    const createdReq = {
      id: reqId,
      title: newReqData.title,
      category: newReqData.category || 'General',
      amount: newReqData.amount ? parseFloat(newReqData.amount) : null,
      type: newReqData.type,
      requesterName: newReqData.requesterName || 'Prof. Faculty User',
      requesterRole: 'Faculty Member',
      department: newReqData.department || 'Computer Science',
      dateSubmitted: new Date().toISOString().split('T')[0],
      status: initialStatus,
      priority: newReqData.priority || 'Medium',
      description: newReqData.description,
      attachments: newReqData.fileName ? [{ name: newReqData.fileName, size: '1.2 MB', type: 'Uploaded File' }] : [],
      history: [
        {
          date: new Date().toLocaleString(),
          user: newReqData.requesterName || 'Faculty Member',
          action: 'Submitted Request',
          notes: newReqData.description
        }
      ],
      thresholdType: newReqData.type === 'non-financial' 
        ? 'Non-Financial Issue' 
        : (isEscalated ? 'Escalated (≥ ₹5 Lakhs)' : 'Standard (< ₹5 Lakhs)')
    };

    setRequests(prev => [createdReq, ...prev]);

    // Audit log entry
    const auditEntry = {
      id: `AUD-${Math.floor(9000 + Math.random() * 1000)}`,
      timestamp: new Date().toLocaleString(),
      actor: newReqData.requesterName || 'Faculty Member',
      role: 'Faculty',
      action: 'CREATE_REQUEST',
      targetItem: `${reqId} (${newReqData.title.slice(0, 20)}...)`,
      amount: newReqData.amount ? `₹${Number(newReqData.amount).toLocaleString('en-IN')}` : 'N/A',
      details: `New ${newReqData.type} request submitted.`,
      ipAddress: '192.168.10.11',
      status: 'Success'
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    // Notification entry
    const newNotif = {
      id: `NOTIF-${Date.now()}`,
      title: `New Request Submitted: ${reqId}`,
      message: `${createdReq.title} submitted by ${createdReq.requesterName}`,
      timestamp: 'Just now',
      read: false,
      type: isEscalated ? 'escalation' : 'approval',
      roleTarget: isEscalated ? 'sfsp' : 'principal'
    };
    setNotifications(prev => [newNotif, ...prev]);

    showToast(`Request ${reqId} created successfully! ${isEscalated ? '(Escalated to Trust due to ≥ ₹5L amount)' : ''}`, 'success');
  };

  // Update Request Status (Approve, Reject, Escalate, Resolve, Release)
  const updateRequestStatus = (id, newStatus, note = '') => {
    setRequests(prev => prev.map(req => {
      if (req.id === id) {
        const actorName = currentRole === 'principal' ? 'Principal Dr. R. S. Patil' 
          : currentRole === 'sfsp' ? 'SFSP Trust Board Member' 
          : currentRole === 'admin' ? 'Admin Clerk' : 'Faculty';

        const updatedHistory = [
          ...req.history,
          {
            date: new Date().toLocaleString(),
            user: actorName,
            action: `Status changed to ${newStatus}`,
            notes: note || `Action taken by ${currentRole.toUpperCase()}`
          }
        ];

        return {
          ...req,
          status: newStatus,
          history: updatedHistory
        };
      }
      return req;
    }));

    // Add Audit Log
    const req = requests.find(r => r.id === id);
    if (req) {
      const auditEntry = {
        id: `AUD-${Math.floor(9000 + Math.random() * 1000)}`,
        timestamp: new Date().toLocaleString(),
        actor: currentRole === 'principal' ? 'Principal Dr. R. S. Patil' : currentRole === 'sfsp' ? 'SFSP Trust Authority' : 'Admin Clerk',
        role: currentRole.toUpperCase(),
        action: newStatus.toUpperCase().replace(/\s+/g, '_'),
        targetItem: `${req.id} (${req.title.slice(0, 20)})`,
        amount: req.amount ? `₹${Number(req.amount).toLocaleString('en-IN')}` : 'N/A',
        details: note || `Status updated to ${newStatus}`,
        ipAddress: '192.168.10.45',
        status: 'Success'
      };
      setAuditLogs(prev => [auditEntry, ...prev]);
    }

    showToast(`Request ${id} status updated to: ${newStatus}`, 'success');
  };

  // Add Inventory Item
  const addInventoryItem = (item) => {
    const newId = `INV-2026-00${inventory.length + 1}`;
    const newItemObj = {
      id: newId,
      itemName: item.itemName,
      category: item.category,
      location: item.location,
      quantity: parseInt(item.quantity) || 1,
      unitValue: parseFloat(item.unitValue) || 0,
      totalValue: (parseInt(item.quantity) || 1) * (parseFloat(item.unitValue) || 0),
      condition: item.condition || 'Good',
      status: 'In Use',
      linkedBill: item.linkedBill || 'N/A',
      lastInspected: new Date().toISOString().split('T')[0]
    };

    setInventory(prev => [newItemObj, ...prev]);
    showToast(`Inventory item ${newItemObj.id} added successfully!`, 'success');
  };

  const markNotificationRead = (notifId) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const switchRole = (newRole) => {
    setCurrentRole(newRole);
    // Switch default page based on role
    if (newRole === 'faculty') setActivePage('faculty-dashboard');
    else if (newRole === 'principal') setActivePage('dashboard');
    else if (newRole === 'sfsp') setActivePage('sfsp-dashboard');
    else if (newRole === 'admin') setActivePage('admin-dashboard');
    showToast(`Switched view mode to: ${newRole.toUpperCase()} Role`, 'info');
  };

  return (
    <AppContext.Provider value={{
      currentRole,
      switchRole,
      activePage,
      setActivePage,
      requests,
      inventory,
      bills,
      notifications,
      auditLogs,
      searchQuery,
      setSearchQuery,
      toast,
      showToast,
      addRequest,
      updateRequestStatus,
      addInventoryItem,
      markNotificationRead,
      selectedRequestModal,
      setSelectedRequestModal,
      isNewFinancialModalOpen,
      setIsNewFinancialModalOpen,
      isNewIssueModalOpen,
      setIsNewIssueModalOpen,
      isInventoryModalOpen,
      setIsInventoryModalOpen,
      isExportModalOpen,
      setIsExportModalOpen
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
