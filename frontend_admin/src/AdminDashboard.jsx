import { useState, useEffect } from 'react'
import './AdminDashboard.css'
import { io } from 'socket.io-client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const API_BASE_URL = 'http://localhost:8000'
let socket = null

// Helper function to get date range start (30 days ago)
function getDateRangeStart() {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().split('T')[0]
}

export default function AdminDashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [updating, setUpdating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyImageData, setReplyImageData] = useState(null)
  const [showHistory, setShowHistory] = useState(false) // Toggle history view
  const [deleteHistoryModal, setDeleteHistoryModal] = useState(null) // null, 'confirm1', 'confirm2', 'confirm3'
  const [deleteHistoryConfirmText, setDeleteHistoryConfirmText] = useState('')
  const [closedTicketCount, setClosedTicketCount] = useState(0)
  const [newNotification, setNewNotification] = useState(null) // Real-time notification
  const [showAnalytics, setShowAnalytics] = useState(false) // Toggle analytics view
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState(getDateRangeStart()) // Default: last 30 days
  const [analyticsDateTo, setAnalyticsDateTo] = useState(new Date().toISOString().split('T')[0])

  // Fetch all tickets from backend and setup WebSocket connection
  useEffect(() => {
    fetchTickets()
    setupWebSocket()
    
    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [])

  const setupWebSocket = () => {
    try {
      socket = io(`${API_BASE_URL}/admin`, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      })

      socket.on('connect', () => {
        console.log('Connected to real-time notifications')
      })

      socket.on('new_ticket', (data) => {
        console.log('New ticket received:', data)
        setNewNotification({
          type: 'new_ticket',
          message: data.message,
          ticket: data.ticket,
          timestamp: data.timestamp
        })
        // Auto-hide notification after 5 seconds
        setTimeout(() => setNewNotification(null), 5000)
        // Add the new ticket to the top of the list
        setTickets(prev => [data.ticket, ...prev])
      })

      socket.on('ticket_updated', (data) => {
        console.log('Ticket updated:', data)
        setNewNotification({
          type: 'ticket_updated',
          message: `Ticket ${data.ticket_id} has been updated`,
          update_type: data.update_type,
          timestamp: data.timestamp
        })
        // Auto-hide notification after 5 seconds
        setTimeout(() => setNewNotification(null), 5000)
        // Update the ticket in the list
        setTickets(prev =>
          prev.map(ticket => ticket.id === data.ticket_id ? data.ticket : ticket)
        )
      })

      socket.on('new_response', (data) => {
        console.log('New response received:', data)
        setNewNotification({
          type: 'new_response',
          message: `${data.admin_name} responded to ticket ${data.ticket_id}`,
          ticket_id: data.ticket_id,
          timestamp: data.timestamp
        })
        // Auto-hide notification after 5 seconds
        setTimeout(() => setNewNotification(null), 5000)
        // Update the ticket in the list
        setTickets(prev =>
          prev.map(ticket => ticket.id === data.ticket_id ? data.ticket : ticket)
        )
      })

      socket.on('disconnect', () => {
        console.log('Disconnected from real-time notifications')
      })
    } catch (err) {
      console.error('Error setting up WebSocket:', err)
    }
  }

  const fetchTickets = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE_URL}/tickets`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.statusText}`)
      }
      
      const data = await response.json()
      setTickets(data)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  // Update ticket status
  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      setUpdating(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error(`Failed to update ticket: ${response.statusText}`)
      }

      const updatedTicket = await response.json()
      
      // Update local state
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? updatedTicket : ticket
        )
      )
      
      setSuccessMessage(`Ticket status updated to "${newStatus}"`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(updatedTicket)
      }
    } catch (err) {
      setError(err.message)
      console.error('Error updating ticket:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Delete ticket
  const handleDeleteTicket = async (ticketId) => {
    try {
      setUpdating(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete ticket: ${response.statusText}`)
      }

      // Update local state
      setTickets(prev => prev.filter(ticket => ticket.id !== ticketId))
      
      setSuccessMessage('Ticket deleted successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      
      setDeleteConfirm(null)
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null)
      }
    } catch (err) {
      setError(err.message)
      console.error('Error deleting ticket:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Delete ALL history with multiple confirmations
  const clearAdminHistory = async () => {
    const closedCount = tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length
    setClosedTicketCount(closedCount)
    setDeleteHistoryModal('confirm1')
    setDeleteHistoryConfirmText('')
  }

  const handleDeleteHistoryConfirm1 = () => {
    setDeleteHistoryModal('confirm2')
  }

  const handleDeleteHistoryConfirm2 = () => {
    setDeleteHistoryModal('confirm3')
    setDeleteHistoryConfirmText('')
  }

  const handleDeleteHistoryConfirm3 = async () => {
    if (deleteHistoryConfirmText !== 'DELETE ALL HISTORY') {
      setError('Text does not match. Please try again.')
      setTimeout(() => setError(null), 3000)
      return
    }

    try {
      setUpdating(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/admin/clear-history`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete all history: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh tickets list to remove deleted items
      await fetchTickets()
      
      setSuccessMessage(`✓ ${data.message}`)
      setTimeout(() => setSuccessMessage(''), 5000)
      setShowHistory(false)
      setDeleteHistoryModal(null)
      setDeleteHistoryConfirmText('')
    } catch (err) {
      setError(err.message)
      console.error('Error deleting all history:', err)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteHistoryCancel = () => {
    setDeleteHistoryModal(null)
    setDeleteHistoryConfirmText('')
  }

  // Submit reply/note (simulated - extend backend for actual implementation)
  const handleSubmitReply = async (ticketId) => {
    if (!replyText.trim()) return

    try {
      setUpdating(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_name: 'Admin',
          response_text: replyText,
          response_image_data: replyImageData
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to submit reply: ${response.statusText}`)
      }

      const updatedTicket = await response.json()
      
      // Update local state
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? updatedTicket : ticket
        )
      )
      
      setSelectedTicket(updatedTicket)
      setSuccessMessage('Reply submitted successfully')
      setReplyText('')
      setReplyImageData(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message)
      console.error('Error submitting reply:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Handle reply image upload
  const handleReplyImageUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setReplyImageData(e.target.result)
      setError(null)
    }
    reader.onerror = () => {
      setError('Error reading file')
    }
    reader.readAsDataURL(file)
  }

  // Format date for display
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return '#ef4444'
      case 'in_progress':
        return '#f59e0b'
      case 'resolved':
        return '#10b981'
      case 'closed':
        return '#6b7280'
      default:
        return '#6b7280'
    }
  }

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return '#6b7280'
      case 'medium':
        return '#f59e0b'
      case 'high':
        return '#ef4444'
      case 'urgent':
        return '#dc2626'
      default:
        return '#6b7280'
    }
  }

  // Get category display name
  const getCategoryName = (category) => {
    const categories = {
      furniture: 'Furniture',
      it_equipment: 'IT Equipment',
      facility: 'Facility',
      utilities: 'Utilities',
      safety: 'Safety',
      other: 'Other'
    }
    return categories[category] || category
  }

  // Filter tickets based on status, priority, and search
  const filteredTickets = tickets.filter(ticket => {
    // Show resolved and closed tickets in history, exclude them from main view
    const isHistoryTicket = ticket.status === 'closed' || ticket.status === 'resolved'
    const isOpenTicket = ticket.status !== 'closed' && ticket.status !== 'resolved'
    
    // If showing history, show all resolved/closed regardless of filterStatus
    // If not showing history, apply status filter normally
    const matchesStatus = showHistory ? isHistoryTicket : (isOpenTicket && (filterStatus === 'all' || ticket.status === filterStatus))
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority
    const matchesSearch = searchQuery === '' || 
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.reporter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesPriority && matchesSearch
  })

  // Get status statistics
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length
  }

  // Calculate analytics for date range
  const calculateAnalytics = () => {
    const fromDate = new Date(analyticsDateFrom)
    const toDate = new Date(analyticsDateTo)
    toDate.setHours(23, 59, 59, 999)

    const ticketsInRange = tickets.filter(ticket => {
      const ticketDate = new Date(ticket.created_at)
      return ticketDate >= fromDate && ticketDate <= toDate
    })

    // Feedback Analytics
    let totalRatings = 0
    let totalLikes = 0
    let totalDislikes = 0
    let totalComments = 0
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

    ticketsInRange.forEach(ticket => {
      if (ticket.user_feedback) {
        if (ticket.user_feedback.rating) {
          totalRatings++
          ratingDistribution[ticket.user_feedback.rating]++
        }
        totalLikes += ticket.user_feedback.likes || 0
        totalDislikes += ticket.user_feedback.dislikes || 0
        totalComments += (ticket.user_feedback.comments || []).length
      }
    })

    // Status distribution
    const statusDistribution = {
      open: ticketsInRange.filter(t => t.status === 'open').length,
      in_progress: ticketsInRange.filter(t => t.status === 'in_progress').length,
      resolved: ticketsInRange.filter(t => t.status === 'resolved').length,
      closed: ticketsInRange.filter(t => t.status === 'closed').length
    }

    // Priority distribution
    const priorityDistribution = {
      low: ticketsInRange.filter(t => t.priority === 'low').length,
      medium: ticketsInRange.filter(t => t.priority === 'medium').length,
      high: ticketsInRange.filter(t => t.priority === 'high').length,
      urgent: ticketsInRange.filter(t => t.priority === 'urgent').length
    }

    // Category distribution
    const categoryDistribution = {}
    ticketsInRange.forEach(ticket => {
      const cat = ticket.category || 'other'
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1
    })

    // Average rating
    const avgRating = totalRatings > 0 ? (ratingDistribution[5] * 5 + ratingDistribution[4] * 4 + ratingDistribution[3] * 3 + ratingDistribution[2] * 2 + ratingDistribution[1] * 1) / totalRatings : 0

    // Helpful rate
    const helpfulTotal = totalLikes + totalDislikes
    const helpfulRate = helpfulTotal > 0 ? (totalLikes / helpfulTotal * 100).toFixed(1) : 0

    return {
      ticketsInRange: ticketsInRange.length,
      totalRatings,
      avgRating: avgRating.toFixed(2),
      ratingDistribution,
      totalLikes,
      totalDislikes,
      helpfulRate,
      totalComments,
      statusDistribution,
      priorityDistribution,
      categoryDistribution
    }
  }

  const analytics = calculateAnalytics()

  // Generate PDF Report
  const downloadReport = () => {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let yPosition = 15

      // Header
      doc.setFillColor(59, 130, 246)
      doc.rect(0, 0, pageWidth, 35, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.setFont(undefined, 'bold')
      doc.text('Pacific Support - Analytics Report', pageWidth / 2, 20, { align: 'center' })

      // Report Info
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      const reportDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      doc.text(`Generated: ${reportDate}`, pageWidth / 2, 38, { align: 'center' })
      doc.text(`Period: ${analyticsDateFrom} to ${analyticsDateTo}`, pageWidth / 2, 43, { align: 'center' })

      yPosition = 50

      // Summary Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Summary', 14, yPosition)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      const summaryData = [
        ['Total Tickets (Period)', analytics.ticketsInRange],
        ['Average Responses Per Ticket', (tickets.filter(t => {
          const ticketDate = new Date(t.created_at)
          const fromDate = new Date(analyticsDateFrom)
          const toDate = new Date(analyticsDateTo)
          toDate.setHours(23, 59, 59, 999)
          return ticketDate >= fromDate && ticketDate <= toDate
        }).reduce((sum, t) => sum + (t.admin_responses?.length || 0), 0) / analytics.ticketsInRange || 0).toFixed(2)],
        ['Feedback Completion Rate', `${(analytics.ticketsInRange > 0 ? ((analytics.totalRatings / analytics.ticketsInRange) * 100).toFixed(1) : 0)}%`]
      ]

      autoTable(doc, {
        head: [['Metric', 'Value']],
        body: summaryData,
        startY: yPosition,
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [240, 245, 250]
        },
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 12

      // Feedback Analytics Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Feedback Analytics', 14, yPosition)
      yPosition += 8

      const feedbackData = [
        ['Total Ratings', analytics.totalRatings],
        ['Average Rating', `${analytics.avgRating} / 5.0`],
        ['5-Star Ratings', analytics.ratingDistribution[5]],
        ['4-Star Ratings', analytics.ratingDistribution[4]],
        ['3-Star Ratings', analytics.ratingDistribution[3]],
        ['2-Star Ratings', analytics.ratingDistribution[2]],
        ['1-Star Ratings', analytics.ratingDistribution[1]]
      ]

      autoTable(doc, {
        head: [['Rating Metric', 'Count']],
        body: feedbackData,
        startY: yPosition,
        headStyles: {
          fillColor: [245, 158, 11],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [255, 251, 235]
        },
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 12

      // Helpful Feedback Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Helpful Feedback', 14, yPosition)
      yPosition += 8

      const helpfulData = [
        ['Likes', analytics.totalLikes],
        ['Dislikes', analytics.totalDislikes],
        ['Helpful Rate', `${analytics.helpfulRate}%`]
      ]

      autoTable(doc, {
        head: [['Metric', 'Value']],
        body: helpfulData,
        startY: yPosition,
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [240, 253, 244]
        },
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 12

      // Comments Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Comments', 14, yPosition)
      yPosition += 8

      const commentsData = [
        ['Total Comments', analytics.totalComments],
        ['Average per Ticket', (analytics.totalComments / analytics.ticketsInRange || 0).toFixed(2)],
        ['Tickets with Comments', tickets.filter(t => {
          const ticketDate = new Date(t.created_at)
          const fromDate = new Date(analyticsDateFrom)
          const toDate = new Date(analyticsDateTo)
          toDate.setHours(23, 59, 59, 999)
          return ticketDate >= fromDate && ticketDate <= toDate && t.user_feedback?.comments?.length > 0
        }).length]
      ]

      autoTable(doc, {
        head: [['Metric', 'Value']],
        body: commentsData,
        startY: yPosition,
        headStyles: {
          fillColor: [139, 92, 246],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [250, 245, 255]
        },
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 12

      // Status Distribution
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Status Distribution', 14, yPosition)
      yPosition += 8

      const statusData = Object.entries(analytics.statusDistribution).map(([status, count]) => [
        status.replace('_', ' ').toUpperCase(),
        count
      ])

      autoTable(doc, {
        head: [['Status', 'Count']],
        body: statusData,
        startY: yPosition,
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [240, 245, 250]
        },
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 12

      // Priority Distribution
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Priority Distribution', 14, yPosition)
      yPosition += 8

      const priorityData = Object.entries(analytics.priorityDistribution).map(([priority, count]) => [
        priority.toUpperCase(),
        count
      ])

      autoTable(doc, {
        head: [['Priority', 'Count']],
        body: priorityData,
        startY: yPosition,
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242]
        },
        margin: { left: 14, right: 14 }
      })

      yPosition = doc.lastAutoTable.finalY + 12

      // Category Distribution
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Category Distribution', 14, yPosition)
      yPosition += 8

      const categoryData = Object.entries(analytics.categoryDistribution).map(([category, count]) => [
        category.replace('_', ' ').toUpperCase(),
        count
      ])

      autoTable(doc, {
        head: [['Category', 'Count']],
        body: categoryData,
        startY: yPosition,
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [240, 245, 250]
        },
        margin: { left: 14, right: 14 }
      })

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(128, 128, 128)
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }

      // Download the PDF
      const fileName = `Pacific-Support-Analytics-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)

      setSuccessMessage('Report downloaded successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError('Error generating report: ' + err.message)
      console.error('Error generating PDF:', err)
    }
  }

  return (
    <div className="admin-dashboard">
      {/* Real-time Notification */}
      {newNotification && (
        <div className={`notification notification-${newNotification.type}`}>
          <div className="notification-content">
            <span className="notification-icon">
              {newNotification.type === 'new_ticket' ? '📋' : newNotification.type === 'new_response' ? '💬' : '🔄'}
            </span>
            <div className="notification-text">
              <p>{newNotification.message}</p>
              <small>{new Date(newNotification.timestamp).toLocaleTimeString()}</small>
            </div>
          </div>
          <button 
            className="notification-close"
            onClick={() => setNewNotification(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <header className="admin-header">
        <div className="header-content">
          <div className="header-brand">
            <img src="/logo.png" alt="Pacific Support" className="header-logo" />
            <div className="header-text">
              <h1>Pacific Support - Admin</h1>
              <p>Manage all support tickets and reports</p>
            </div>
          </div>
          
          <div className="header-controls">
            <div className="search-box-header">
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input-header"
              />
            </div>
            
            <div className="filters-group-header">
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select-header"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              
              <select 
                value={filterPriority} 
                onChange={(e) => setFilterPriority(e.target.value)}
                className="filter-select-header"
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>

              <button onClick={fetchTickets} className="refresh-btn-header" disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="header-tabs">
            <button 
              className={`header-tab-btn ${!showHistory && !showAnalytics ? 'active' : ''}`}
              onClick={() => { setShowHistory(false); setShowAnalytics(false) }}
            >
              Open Tickets ({tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length})
            </button>
            <button 
              className={`header-tab-btn ${showHistory && !showAnalytics ? 'active' : ''}`}
              onClick={() => { setShowHistory(true); setShowAnalytics(false) }}
            >
              Closed/History ({tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length})
            </button>
            <button 
              className={`header-tab-btn ${showAnalytics ? 'active' : ''}`}
              onClick={() => { setShowAnalytics(true); setShowHistory(false) }}
              title="View analytics and statistics"
            >
              📊 Analytics
            </button>
            {showHistory && (
              <button 
                onClick={clearAdminHistory} 
                className="delete-all-history-btn-header" 
                disabled={updating || tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length === 0}
                title={tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length === 0 ? 'No history to delete' : 'Permanently delete all closed/resolved tickets'}
              >
                {updating ? 'Deleting...' : ' Delete'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Statistics Cards */}
      {!showAnalytics && (
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.total}</h3>
              <p>Total Tickets</p>
            </div>
          </div>
          <div className="stat-card open">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.open}</h3>
              <p>Open</p>
            </div>
          </div>
          <div className="stat-card in-progress">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.inProgress}</h3>
              <p>In Progress</p>
            </div>
          </div>
          <div className="stat-card resolved">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.resolved}</h3>
              <p>Resolved</p>
            </div>
          </div>
          <div className="stat-card closed">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.closed}</h3>
              <p>Closed</p>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Analytics Section */}
      {showAnalytics && (
        <section className="analytics-section">
          <div className="analytics-header">
            <h2>📊 Analytics & Statistics</h2>
            <div className="analytics-controls">
              <div className="analytics-date-filter">
                <label>From: </label>
                <input 
                  type="date" 
                  value={analyticsDateFrom} 
                  onChange={(e) => setAnalyticsDateFrom(e.target.value)}
                  className="date-input"
                />
                <label>To: </label>
                <input 
                  type="date" 
                  value={analyticsDateTo} 
                  onChange={(e) => setAnalyticsDateTo(e.target.value)}
                  className="date-input"
                />
              </div>
              <button 
                onClick={downloadReport}
                className="download-report-btn"
                title="Download analytics report as PDF"
              >
                📥 Download Report
              </button>
            </div>
          </div>

          {/* Feedback Analytics Cards */}
          <div className="analytics-grid">
            <div className="analytics-card feedback">
              <div className="analytics-card-header">
                <h3>⭐ Rating Analytics</h3>
              </div>
              <div className="analytics-card-content">
                <div className="metric">
                  <span className="label">Total Ratings:</span>
                  <span className="value">{analytics.totalRatings}</span>
                </div>
                <div className="metric">
                  <span className="label">Average Rating:</span>
                  <span className="value star-rating">{analytics.avgRating} ⭐</span>
                </div>
                <div className="rating-breakdown">
                  {[5, 4, 3, 2, 1].map(star => (
                    <div key={star} className="rating-bar-item">
                      <span className="stars">{star}⭐</span>
                      <div className="bar-container">
                        <div 
                          className="bar" 
                          style={{
                            width: analytics.totalRatings > 0 ? (analytics.ratingDistribution[star] / analytics.totalRatings * 100) : 0 + '%',
                            backgroundColor: star >= 4 ? '#22c55e' : star >= 3 ? '#f59e0b' : '#ef4444'
                          }}
                        ></div>
                      </div>
                      <span className="count">({analytics.ratingDistribution[star]})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="analytics-card helpful">
              <div className="analytics-card-header">
                <h3>👍 Helpful Feedback</h3>
              </div>
              <div className="analytics-card-content">
                <div className="metric">
                  <span className="label">Likes:</span>
                  <span className="value like">{analytics.totalLikes} 👍</span>
                </div>
                <div className="metric">
                  <span className="label">Dislikes:</span>
                  <span className="value dislike">{analytics.totalDislikes} 👎</span>
                </div>
                <div className="metric">
                  <span className="label">Helpful Rate:</span>
                  <span className="value helpful-rate">{analytics.helpfulRate}%</span>
                </div>
                <div className="helpful-chart">
                  <div className="helpful-bar">
                    <div 
                      className="helpful-fill" 
                      style={{ width: analytics.helpfulRate + '%' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="analytics-card comments">
              <div className="analytics-card-header">
                <h3>💬 Comments</h3>
              </div>
              <div className="analytics-card-content">
                <div className="metric">
                  <span className="label">Total Comments:</span>
                  <span className="value comments-count">{analytics.totalComments}</span>
                </div>
                <div className="metric">
                  <span className="label">Avg per Ticket:</span>
                  <span className="value">{(analytics.totalComments / analytics.ticketsInRange || 0).toFixed(2)}</span>
                </div>
                <div className="metric">
                  <span className="label">Tickets with Comments:</span>
                  <span className="value">
                    {tickets.filter(t => {
                      const ticketDate = new Date(t.created_at)
                      const fromDate = new Date(analyticsDateFrom)
                      const toDate = new Date(analyticsDateTo)
                      toDate.setHours(23, 59, 59, 999)
                      return ticketDate >= fromDate && ticketDate <= toDate && t.user_feedback?.comments?.length > 0
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status & Priority Distribution */}
          <div className="analytics-grid">
            <div className="analytics-card distribution">
              <div className="analytics-card-header">
                <h3>📈 Status Distribution</h3>
              </div>
              <div className="analytics-card-content">
                {Object.entries(analytics.statusDistribution).map(([status, count]) => (
                  <div key={status} className="distribution-item">
                    <span className="status-label">{status.replace('_', ' ').toUpperCase()}</span>
                    <div className="distribution-bar">
                      <div 
                        className="distribution-fill"
                        style={{
                          width: analytics.ticketsInRange > 0 ? (count / analytics.ticketsInRange * 100) : 0 + '%',
                          backgroundColor: status === 'open' ? '#ef4444' : status === 'in_progress' ? '#f59e0b' : status === 'resolved' ? '#3b82f6' : '#6b7280'
                        }}
                      ></div>
                    </div>
                    <span className="count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-card distribution">
              <div className="analytics-card-header">
                <h3>🎯 Priority Distribution</h3>
              </div>
              <div className="analytics-card-content">
                {Object.entries(analytics.priorityDistribution).map(([priority, count]) => (
                  <div key={priority} className="distribution-item">
                    <span className="priority-label">{priority.toUpperCase()}</span>
                    <div className="distribution-bar">
                      <div 
                        className="distribution-fill"
                        style={{
                          width: analytics.ticketsInRange > 0 ? (count / analytics.ticketsInRange * 100) : 0 + '%',
                          backgroundColor: priority === 'urgent' ? '#dc2626' : priority === 'high' ? '#ea580c' : priority === 'medium' ? '#f59e0b' : '#10b981'
                        }}
                      ></div>
                    </div>
                    <span className="count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="analytics-full">
            <div className="analytics-card distribution">
              <div className="analytics-card-header">
                <h3>📁 Category Distribution</h3>
              </div>
              <div className="analytics-card-content">
                <div className="category-list">
                  {Object.entries(analytics.categoryDistribution).map(([category, count]) => (
                    <div key={category} className="category-item">
                      <span className="category-name">{category.replace('_', ' ').toUpperCase()}</span>
                      <div className="category-bar">
                        <div 
                          className="category-fill"
                          style={{
                            width: analytics.ticketsInRange > 0 ? (count / analytics.ticketsInRange * 100) : 0 + '%'
                          }}
                        ></div>
                      </div>
                      <span className="count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="analytics-summary">
            <h3>📋 Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Total Tickets (Period):</span>
                <span className="summary-value">{analytics.ticketsInRange}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Avg Response Per Ticket:</span>
                <span className="summary-value">
                  {(tickets.filter(t => {
                    const ticketDate = new Date(t.created_at)
                    const fromDate = new Date(analyticsDateFrom)
                    const toDate = new Date(analyticsDateTo)
                    toDate.setHours(23, 59, 59, 999)
                    return ticketDate >= fromDate && ticketDate <= toDate
                  }).reduce((sum, t) => sum + (t.admin_responses?.length || 0), 0) / analytics.ticketsInRange || 0).toFixed(2)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Feedback Completion Rate:</span>
                <span className="summary-value">
                  {analytics.ticketsInRange > 0 ? ((analytics.totalRatings / analytics.ticketsInRange) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">!</span>
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="alert alert-success">
          <span className="alert-icon">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filters and Search */}
      <section className="filters-section">
        <div className="filters-header">
        </div>
        
        <div className="filters-container">
        </div>
      </section>

      {/* Tickets Table */}
      <main className="tickets-section">
        <div className="section-header">
          <h2>Reports Management</h2>
          <span className="results-count">{filteredTickets.length} tickets</span>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No tickets found</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="tickets-table-container">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Reporter</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="ticket-row">
                    <td className="ticket-id">#{ticket.id.slice(-6)}</td>
                    <td className="ticket-title">
                      <strong>{ticket.title}</strong>
                    </td>
                    <td className="ticket-reporter">
                      <div>{ticket.reporter_name}</div>
                      <small>{ticket.reporter_email}</small>
                    </td>
                    <td>
                      <span className="category-badge">
                        {getCategoryName(ticket.category)}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(ticket.status) }}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="ticket-date">
                      {formatDate(ticket.created_at)}
                    </td>
                    <td className="ticket-actions">
                      <button 
                        onClick={() => setSelectedTicket(ticket)}
                        className="action-btn view-btn"
                        title="View Details"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(ticket.id)}
                        className="action-btn delete-btn"
                        title="Delete Ticket"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ticket Details</h2>
              <button onClick={() => setSelectedTicket(null)} className="close-btn" title="Close">
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-row">
                  <label>Ticket ID:</label>
                  <span>#{selectedTicket.id}</span>
                </div>
                <div className="detail-row">
                  <label>Title:</label>
                  <span><strong>{selectedTicket.title}</strong></span>
                </div>
                <div className="detail-row">
                  <label>Reporter:</label>
                  <span>{selectedTicket.reporter_name} ({selectedTicket.reporter_email})</span>
                </div>
                <div className="detail-row">
                  <label>Department:</label>
                  <span>{selectedTicket.reporter_department}</span>
                </div>
                <div className="detail-row">
                  <label>Location:</label>
                  <span>{selectedTicket.location}</span>
                </div>
                <div className="detail-row">
                  <label>Category:</label>
                  <span className="category-badge">{getCategoryName(selectedTicket.category)}</span>
                </div>
                <div className="detail-row">
                  <label>Priority:</label>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(selectedTicket.priority) }}
                  >
                    {selectedTicket.priority}
                  </span>
                </div>
                <div className="detail-row">
                  <label>Status:</label>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedTicket.status) }}
                  >
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="detail-row">
                  <label>Created:</label>
                  <span>{formatDate(selectedTicket.created_at)}</span>
                </div>
                <div className="detail-row">
                  <label>Updated:</label>
                  <span>{formatDate(selectedTicket.updated_at)}</span>
                </div>
              </div>

              <div className="detail-section">
                <label>Description:</label>
                <p className="description-text">{selectedTicket.description}</p>
              </div>

              {selectedTicket.image_data && (
                <div className="detail-section">
                  <label>Attachment:</label>
                  <img 
                    src={selectedTicket.image_data} 
                    alt="Ticket attachment" 
                    className="ticket-image"
                  />
                </div>
              )}

              <div className="detail-section">
                <label>Update Status:</label>
                <div className="status-actions">
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'open')}
                    disabled={updating || selectedTicket.status === 'open'}
                    className="status-action-btn open-btn"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}
                    disabled={updating || selectedTicket.status === 'in_progress'}
                    className="status-action-btn progress-btn"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                    disabled={updating || selectedTicket.status === 'resolved'}
                    className="status-action-btn resolved-btn"
                  >
                    Resolved
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                    disabled={updating || selectedTicket.status === 'closed'}
                    className="status-action-btn closed-btn"
                  >
                    Closed
                  </button>
                </div>
              </div>

              <div className="detail-section">
                <label>Add Reply/Note:</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Enter your reply or internal note..."
                  className="reply-textarea"
                  rows="4"
                />
                
                <div className="reply-image-section">
                  <label htmlFor="reply-image">Attach Image (optional):</label>
                  <input
                    type="file"
                    id="reply-image"
                    accept="image/*"
                    onChange={handleReplyImageUpload}
                    className="image-input"
                  />
                  {replyImageData && (
                    <div className="reply-image-preview">
                      <img src={replyImageData} alt="Reply attachment preview" className="reply-preview-img" />
                      <button
                        onClick={() => setReplyImageData(null)}
                        className="remove-image-btn"
                        type="button"
                      >
                        Remove Image
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => handleSubmitReply(selectedTicket.id)}
                  disabled={updating || !replyText.trim()}
                  className="submit-reply-btn"
                >
                  Submit Reply
                </button>
              </div>

              {selectedTicket.admin_responses && selectedTicket.admin_responses.length > 0 && (
                <div className="detail-section">
                  <label>Responses History:</label>
                  <div className="responses-list">
                    {selectedTicket.admin_responses.map((resp) => (
                      <div key={resp.response_id} className="response-item">
                        <div className="response-header">
                          <strong>{resp.admin_name}</strong>
                          <span className="response-date">{formatDate(resp.created_at)}</span>
                        </div>
                        <p className="response-text">{resp.response_text}</p>
                        {resp.response_image_data && (
                          <div className="response-image-container">
                            <img src={resp.response_image_data} alt="Response attachment" className="response-image" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button onClick={() => setDeleteConfirm(null)} className="close-btn" title="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this ticket? This action cannot be undone.</p>
              <div className="delete-actions">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTicket(deleteConfirm)}
                  disabled={updating}
                  className="confirm-delete-btn"
                >
                  {updating ? 'Deleting...' : 'Delete Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete History Confirmation Modals */}
      {deleteHistoryModal === 'confirm1' && (
        <div className="modal-overlay" onClick={handleDeleteHistoryCancel}>
          <div className="delete-history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header delete-danger">
              <h2>⚠️ WARNING</h2>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                You are about to <strong>PERMANENTLY DELETE {closedTicketCount} closed/resolved tickets</strong> from the database.
              </p>
              <p className="warning-text critical">
                This action <strong>CANNOT BE UNDONE!</strong>
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={handleDeleteHistoryCancel} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleDeleteHistoryConfirm1} className="btn-continue">
                Continue to Step 2
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteHistoryModal === 'confirm2' && (
        <div className="modal-overlay" onClick={handleDeleteHistoryCancel}>
          <div className="delete-history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header delete-critical">
              <h2>🚨 FINAL WARNING</h2>
            </div>
            <div className="modal-body">
              <p className="warning-text critical">
                <strong>This will PERMANENTLY DELETE {closedTicketCount} tickets from the database.</strong>
              </p>
              <p className="warning-text critical">
                <strong>Are you absolutely certain you want to proceed?</strong>
              </p>
              <div className="warning-box">
                <p>• All data will be lost</p>
                <p>• This cannot be reversed</p>
                <p>• There is no backup recovery</p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleDeleteHistoryCancel} className="btn-cancel">
                Cancel & Go Back
              </button>
              <button onClick={handleDeleteHistoryConfirm2} className="btn-continue-final">
                I Understand - Continue to Step 3
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteHistoryModal === 'confirm3' && (
        <div className="modal-overlay" onClick={handleDeleteHistoryCancel}>
          <div className="delete-history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header delete-critical">
              <h2>🔴 LAST CHANCE TO CANCEL</h2>
            </div>
            <div className="modal-body">
              <p className="warning-text critical">
                <strong>To permanently delete all {closedTicketCount} closed/resolved tickets, type the following text:</strong>
              </p>
              <div className="required-text-box">
                DELETE ALL HISTORY
              </div>
              <p className="instruction-text">Type it exactly (case-sensitive):</p>
              <input
                type="text"
                value={deleteHistoryConfirmText}
                onChange={(e) => setDeleteHistoryConfirmText(e.target.value)}
                placeholder="Type DELETE ALL HISTORY"
                className="confirmation-input"
                autoFocus
              />
              <p className="instruction-text small">
                This is your final opportunity to prevent permanent deletion.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={handleDeleteHistoryCancel} className="btn-cancel">
                Cancel & Keep Data
              </button>
              <button 
                onClick={handleDeleteHistoryConfirm3} 
                disabled={deleteHistoryConfirmText !== 'DELETE ALL HISTORY' || updating}
                className={deleteHistoryConfirmText === 'DELETE ALL HISTORY' ? 'btn-delete-final' : 'btn-delete-final-disabled'}
              >
                {updating ? 'Deleting...' : 'PERMANENTLY DELETE ALL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
