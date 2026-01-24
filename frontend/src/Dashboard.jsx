import { useState, useEffect } from 'react'
import './Dashboard.css'
import NotificationCenter from './NotificationCenter'
import { io } from 'socket.io-client'
import { debounce, getCachedRequest } from './utils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
let socket = null

export default function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [myTickets, setMyTickets] = useState([]) // User's submitted tickets from localStorage
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [submittedTicket, setSubmittedTicket] = useState(null)
  const [viewMode, setViewMode] = useState('submit') // 'submit', 'my-reports'
  const [formData, setFormData] = useState({
    reporter_name: '',
    reporter_email: '',
    reporter_department: '',
    title: '',
    description: '',
    category: 'furniture',
    priority: 'medium',
    location: '',
    status: 'open',
    image_data: null
  })
  const [submitting, setSubmitting] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null) // For modal
  const [selectedTicketSource, setSelectedTicketSource] = useState(null) // 'all' or 'my'
  const [unreadResponses, setUnreadResponses] = useState({}) // Track unread responses by ticket ID
  const [showHistory, setShowHistory] = useState(false) // Toggle history view
  const [realtimeNotification, setRealtimeNotification] = useState(null) // Real-time WebSocket notification
  const [clearHistoryModal, setClearHistoryModal] = useState(false) // Clear history confirmation modal
  const [closedTicketCount, setClosedTicketCount] = useState(0) // Count of closed/resolved tickets
  const [commentText, setCommentText] = useState('') // For feedback comments

  // Load user's submitted tickets from localStorage on component mount
  useEffect(() => {
    fetchTickets()
    loadMyTickets()
    checkForUnreadResponses()
    setupWebSocket()
    
    // Listen for storage changes (from other tabs or notification clearing)
    const handleStorageChange = (e) => {
      if (e.key === 'ticketNotifications' || e.key === null) {
        checkForUnreadResponses()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      if (socket) {
        socket.disconnect()
      }
    }
  }, [])

  // Update local storage when selected ticket changes
  useEffect(() => {
    if (selectedTicket && selectedTicketSource === 'my') {
      try {
        const stored = localStorage.getItem('mySubmittedTickets')
        if (stored) {
          const tickets = JSON.parse(stored)
          const updatedTickets = tickets.map(t => 
            t.id === selectedTicket.id ? selectedTicket : t
          )
          localStorage.setItem('mySubmittedTickets', JSON.stringify(updatedTickets))
          setMyTickets(updatedTickets)
        }
      } catch (err) {
        console.error('Error updating local storage:', err)
      }
    }
  }, [selectedTicket, selectedTicketSource])

  // Load submitted tickets from localStorage
  const loadMyTickets = async () => {
    try {
      const stored = localStorage.getItem('mySubmittedTickets')
      if (stored) {
        const localTickets = JSON.parse(stored)
        setMyTickets(localTickets)
        
        // Sync with backend to get latest statuses
        try {
          const response = await fetch(`${API_BASE_URL}/tickets`)
          if (response.ok) {
            const backendTickets = await response.json()
            const updatedTickets = localTickets.map(localTicket => {
              const backendTicket = backendTickets.find(t => t.id === localTicket.id)
              return backendTicket ? { ...localTicket, ...backendTicket } : localTicket
            })
            localStorage.setItem('mySubmittedTickets', JSON.stringify(updatedTickets))
            setMyTickets(updatedTickets)
          }
        } catch (err) {
          console.error('Error syncing with backend:', err)
        }
      }
    } catch (err) {
      console.error('Error loading tickets from storage:', err)
    }
  }

  // Save ticket to localStorage
  const saveTicketLocally = (ticketData) => {
    try {
      const stored = localStorage.getItem('mySubmittedTickets')
      const tickets = stored ? JSON.parse(stored) : []
      tickets.push({
        ...ticketData,
        submittedAt: new Date().toISOString()
      })
      localStorage.setItem('mySubmittedTickets', JSON.stringify(tickets))
      setMyTickets(tickets)
    } catch (err) {
      console.error('Error saving ticket to storage:', err)
    }
  }

  // Clear history (closed/resolved tickets) from localStorage
  const clearUserHistory = () => {
    const closed = myTickets.filter(t => t.status === 'closed' || t.status === 'resolved')
    setClosedTicketCount(closed.length)
    setClearHistoryModal(true)
  }

  const handleClearHistoryConfirm = () => {
    try {
      const stored = localStorage.getItem('mySubmittedTickets')
      if (stored) {
        const tickets = JSON.parse(stored)
        const activeTickets = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved')
        localStorage.setItem('mySubmittedTickets', JSON.stringify(activeTickets))
        setMyTickets(activeTickets)
        setSuccessMessage('History cleared successfully')
        setTimeout(() => setSuccessMessage(''), 3000)
        setShowHistory(false)
        setClearHistoryModal(false)
      }
    } catch (err) {
      setError('Error clearing history: ' + err.message)
      console.error('Error clearing history:', err)
    }
  }

  const handleClearHistoryCancel = () => {
    setClearHistoryModal(false)
  }

  // Fetch all tickets from backend
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
      
      // Sync backend tickets with localStorage to update statuses
      try {
        const stored = localStorage.getItem('mySubmittedTickets')
        if (stored) {
          const localTickets = JSON.parse(stored)
          const updatedTickets = localTickets.map(localTicket => {
            const backendTicket = data.find(t => t.id === localTicket.id)
            return backendTicket ? { ...localTicket, ...backendTicket } : localTicket
          })
          localStorage.setItem('mySubmittedTickets', JSON.stringify(updatedTickets))
          setMyTickets(updatedTickets)
        }
      } catch (err) {
        console.error('Error syncing tickets with localStorage:', err)
      }
      
      // Check for unread responses after fetching
      checkForUnreadResponses(data)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  // Check for unread responses across all tickets
  const checkForUnreadResponses = (ticketsData = null) => {
    try {
      const stored = localStorage.getItem('mySubmittedTickets')
      if (!stored) return

      const myTickets = JSON.parse(stored)
      const unread = {}

      myTickets.forEach(ticket => {
        // Get the latest data from backend if available
        const latestTicket = ticketsData ? ticketsData.find(t => t.id === ticket.id) : null
        const ticketToCheck = latestTicket || ticket

        if (ticketToCheck.admin_responses && ticketToCheck.admin_responses.length > 0) {
          const hasUnread = ticketToCheck.admin_responses.some(r => !r.is_read)
          if (hasUnread) {
            unread[ticket.id] = true
          }
        }
      })

      setUnreadResponses(unread)
    } catch (err) {
      console.error('Error checking for unread responses:', err)
    }
  }

  // Setup WebSocket connection for real-time updates
  const setupWebSocket = () => {
    try {
      socket = io(`${API_BASE_URL}/user`, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      })

      socket.on('connect', () => {
        console.log('Connected to real-time updates')
      })

      socket.on('ticket_updated', (data) => {
        console.log('Ticket updated in real-time:', data)
        
        // Update the ticket in myTickets
        setMyTickets(prev => {
          const updated = prev.map(ticket => 
            ticket.id === data.ticket_id ? { ...ticket, ...data.ticket } : ticket
          )
          localStorage.setItem('mySubmittedTickets', JSON.stringify(updated))
          return updated
        })

        // Show notification
        setRealtimeNotification({
          type: 'ticket_updated',
          message: `Ticket "${data.ticket?.title}" has been updated`,
          timestamp: data.timestamp
        })
        setTimeout(() => setRealtimeNotification(null), 4000)

        // Update selected ticket if it's the one being updated
        if (selectedTicket && selectedTicket.id === data.ticket_id) {
          setSelectedTicket(prev => ({ ...prev, ...data.ticket }))
        }
      })

      socket.on('new_response', (data) => {
        console.log('New response in real-time:', data)
        
        // Update the ticket with the new response
        setMyTickets(prev => {
          const updated = prev.map(ticket => 
            ticket.id === data.ticket_id ? { ...ticket, ...data.ticket } : ticket
          )
          localStorage.setItem('mySubmittedTickets', JSON.stringify(updated))
          return updated
        })

        // Show notification
        setRealtimeNotification({
          type: 'new_response',
          message: `${data.admin_name} responded to your ticket`,
          timestamp: data.timestamp
        })
        setTimeout(() => setRealtimeNotification(null), 4000)

        // Update selected ticket if viewing it
        if (selectedTicket && selectedTicket.id === data.ticket_id) {
          setSelectedTicket(prev => ({ ...prev, ...data.ticket }))
        }

        // Mark as unread
        setUnreadResponses(prev => ({
          ...prev,
          [data.ticket_id]: true
        }))
      })

      socket.on('disconnect', () => {
        console.log('Disconnected from real-time updates')
      })

      socket.on('error', (error) => {
        console.error('WebSocket error:', error)
      })
    } catch (err) {
      console.error('Error setting up WebSocket:', err)
    }
  }

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB')
        return
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          image_data: event.target.result
        }))
        setError(null)
      }
      reader.onerror = () => {
        setError('Failed to read the image file')
      }
      reader.readAsDataURL(file)
    }
  }

  // Search ticket by token
  const handleSearchTicket = async (e) => {
    e.preventDefault()
    
    if (!searchToken.trim()) {
      setError('Please enter a ticket token')
      return
    }

    try {
      setSearchLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE_URL}/tickets/token/${searchToken}`)
      
      if (!response.ok) {
        throw new Error('Ticket not found with this token')
      }
      
      const data = await response.json()
      setSearchedTicket(data)
    } catch (err) {
      setError(err.message)
      setSearchedTicket(null)
    } finally {
      setSearchLoading(false)
    }
  }

  // Handle form submission to create a new ticket
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.reporter_name.trim() || !formData.reporter_email.trim() || 
        !formData.title.trim() || !formData.description.trim() || !formData.location.trim()) {
      setError('All fields are required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccessMessage('')
      
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error(`Failed to create ticket: ${response.statusText}`)
      }

      const ticketData = await response.json()
      
      // Save to localStorage for quick access
      saveTicketLocally(ticketData)
      
      // Show success modal with token for reference
      setSubmittedTicket(ticketData)
      setSuccessMessage('Issue submitted successfully!')
      
      // Reset form
      setFormData({
        reporter_name: '',
        reporter_email: '',
        reporter_department: '',
        title: '',
        description: '',
        category: 'furniture',
        priority: 'medium',
        location: '',
        status: 'open',
        image_data: null
      })
      
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (err) {
      setError(err.message)
      console.error('Error creating ticket:', err)
    } finally {
      setSubmitting(false)
    }
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

  // Submit a rating for a ticket (with optimistic update)
  const submitRating = async (ticketId, rating) => {
    try {
      // Optimistic update - update UI immediately
      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          rating: rating
        }
      }))

      setMyTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, user_feedback: { ...t.user_feedback, rating: rating } }
          : t
      ))

      // Send request in background
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/feedback/rate?rating=${rating}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to submit rating')
      }

      setSuccessMessage(`Rated ${rating} star${rating !== 1 ? 's' : ''}!`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      // Revert optimistic update on error
      const currentTicket = myTickets.find(t => t.id === ticketId)
      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          rating: currentTicket?.user_feedback?.rating || null
        }
      }))
      setError('Error submitting rating: ' + err.message)
      console.error('Error submitting rating:', err)
    }
  }

  // Submit a like for a ticket (with optimistic update)
  const submitLike = async (ticketId) => {
    try {
      // Optimistic update - calculate expected like count
      const currentLikes = selectedTicket?.user_feedback?.likes || 0
      const newLikes = currentLikes + 1

      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          likes: newLikes
        }
      }))

      setMyTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, user_feedback: { ...t.user_feedback, likes: newLikes } }
          : t
      ))

      // Send request in background
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/feedback/like`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to like ticket')
      }

      const data = await response.json()
      
      // Update with actual server value
      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          likes: data.likes
        }
      }))

      setSuccessMessage('Thank you for the feedback!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      // Revert optimistic update on error
      const currentTicket = myTickets.find(t => t.id === ticketId)
      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          likes: currentTicket?.user_feedback?.likes || 0
        }
      }))
      setError('Error liking ticket: ' + err.message)
      console.error('Error liking ticket:', err)
    }
  }

  // Submit a dislike for a ticket (with optimistic update)
  const submitDislike = async (ticketId) => {
    try {
      // Optimistic update - calculate expected dislike count
      const currentDislikes = selectedTicket?.user_feedback?.dislikes || 0
      const newDislikes = currentDislikes + 1

      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          dislikes: newDislikes
        }
      }))

      setMyTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, user_feedback: { ...t.user_feedback, dislikes: newDislikes } }
          : t
      ))

      // Send request in background
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/feedback/dislike`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to dislike ticket')
      }

      const data = await response.json()

      // Update with actual server value
      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          dislikes: data.dislikes
        }
      }))

      setSuccessMessage('Thank you for the feedback!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      // Revert optimistic update on error
      const currentTicket = myTickets.find(t => t.id === ticketId)
      setSelectedTicket(prev => ({
        ...prev,
        user_feedback: {
          ...prev.user_feedback,
          dislikes: currentTicket?.user_feedback?.dislikes || 0
        }
      }))
      setError('Error disliking ticket: ' + err.message)
      console.error('Error disliking ticket:', err)
    }
  }

  // Submit a comment for a ticket
  const submitComment = async (ticketId, userName) => {
    try {
      if (!commentText.trim()) {
        setError('Comment cannot be empty')
        return
      }

      const params = new URLSearchParams({
        user_name: userName,
        comment_text: commentText.trim()
      })

      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/feedback/comment?${params}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      const data = await response.json()

      // Refresh selected ticket to get updated comments
      const ticketResponse = await fetch(`${API_BASE_URL}/tickets/${ticketId}`)
      if (ticketResponse.ok) {
        const updatedTicket = await ticketResponse.json()
        setSelectedTicket(updatedTicket)
        
        // Update in myTickets
        setMyTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t))
      }

      setCommentText('')
      setSuccessMessage('Comment added successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError('Error adding comment: ' + err.message)
      console.error('Error adding comment:', err)
    }
  }

  // Delete a comment from a ticket
  const deleteComment = async (ticketId, commentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/feedback/comment/${commentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete comment')
      }

      // Refresh selected ticket to get updated comments
      const ticketResponse = await fetch(`${API_BASE_URL}/tickets/${ticketId}`)
      if (ticketResponse.ok) {
        const updatedTicket = await ticketResponse.json()
        setSelectedTicket(updatedTicket)
        
        // Update in myTickets
        setMyTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t))
      }

      setSuccessMessage('Comment deleted successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError('Error deleting comment: ' + err.message)
      console.error('Error deleting comment:', err)
    }
  }

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return '#dc3545'
      case 'in_progress':
        return '#ffc107'
      case 'resolved':
        return '#17a2b8'
      case 'closed':
        return '#28a745'
      default:
        return '#6c757d'
    }
  }

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return '#6c757d'
      case 'medium':
        return '#ffc107'
      case 'high':
        return '#fd7e14'
      case 'urgent':
        return '#dc3545'
      default:
        return '#6c757d'
    }
  }

  // Get category label
  const getCategoryLabel = (category) => {
    const labels = {
      furniture: 'Furniture',
      it_equipment: 'IT Equipment',
      facility: 'Facility',
      utilities: 'Utilities',
      safety: 'Safety',
      other: 'Other'
    }
    return labels[category] || category
  }

  // Mark all responses in a ticket as read
  const markTicketResponsesAsRead = async (ticket) => {
    try {
      if (!ticket.admin_responses || ticket.admin_responses.length === 0) return

      // Mark unread responses as read
      const unreadResponses = ticket.admin_responses.filter(r => !r.is_read)
      
      for (const response of unreadResponses) {
        try {
          await fetch(`${API_BASE_URL}/tickets/${ticket.id}/responses/mark-read/${response.response_id}`, {
            method: 'POST'
          })
        } catch (err) {
          console.error('Error marking response as read:', err)
        }
      }

      // Update unread responses state
      setUnreadResponses(prev => {
        const updated = { ...prev }
        delete updated[ticket.id]
        return updated
      })
    } catch (err) {
      console.error('Error marking responses as read:', err)
    }
  }

  return (
    <div className="dashboard">
      <NotificationCenter />
      <header className="dashboard-header">
        <div className="header-brand">
          <img src="/logo.png" alt="Pacific Support" className="header-logo" />
          <div className="header-text">
            <h1>Pacific Support</h1>
            <p>Report workplace issues and track their resolution</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      {/* Real-time notification */}
      {realtimeNotification && (
        <div className={`realtime-notification realtime-notification-${realtimeNotification.type}`}>
          <div className="notification-content">
            {realtimeNotification.type === 'ticket_updated' && <span className="notification-icon">🔄</span>}
            {realtimeNotification.type === 'new_response' && <span className="notification-icon">💬</span>}
            <span className="notification-message">{realtimeNotification.message}</span>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {submittedTicket && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Issue Submitted Successfully!</h2>
              <button className="modal-close" onClick={() => setSubmittedTicket(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Your issue has been submitted and saved to your account.</p>
              <div className="ticket-preview">
                <h3>{submittedTicket?.title}</h3>
                <p><strong>Reference ID:</strong> {submittedTicket?.id?.substring(0, 8).toUpperCase()}</p>
                <p><strong>Status:</strong> {submittedTicket?.status}</p>
                <p><strong>Submitted:</strong> {formatDate(submittedTicket?.created_at)}</p>
              </div>
              <p className="token-note">Your report is automatically saved. Check the "My Reports" tab to view all your submissions.</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setSubmittedTicket(null)
                  setViewMode('my-reports')
                  loadMyTickets()
                }}
              >
                View My Reports
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setSubmittedTicket(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Mode */}
      {viewMode === 'submit' && (
        <div className="dashboard-content">
        {/* Issue Submission Form */}
        <section className="create-ticket-section">
          <h2>Submit New Issue</h2>
          <form onSubmit={handleSubmit} className="ticket-form">
            
            {/* Reporter Information */}
            <fieldset className="form-fieldset">
              <legend>Reporter Information</legend>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reporter_name">Full Name *</label>
                  <input
                    type="text"
                    id="reporter_name"
                    name="reporter_name"
                    value={formData.reporter_name}
                    onChange={handleInputChange}
                    placeholder="Your full name"
                    disabled={submitting}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reporter_email">Email *</label>
                  <input
                    type="email"
                    id="reporter_email"
                    name="reporter_email"
                    value={formData.reporter_email}
                    onChange={handleInputChange}
                    placeholder="your.email@company.com"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="reporter_department">Department *</label>
                <input
                  type="text"
                  id="reporter_department"
                  name="reporter_department"
                  value={formData.reporter_department}
                  onChange={handleInputChange}
                  placeholder="e.g., Sales, Marketing, IT"
                  disabled={submitting}
                  required
                />
              </div>
            </fieldset>

            {/* Issue Details */}
            <fieldset className="form-fieldset">
              <legend>Issue Details</legend>
              <div className="form-group">
                <label htmlFor="title">Issue Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Broken chair in office 202"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Detailed Description *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Provide detailed information about the issue..."
                  rows="4"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="image_data">Attach Image (optional)</label>
                <input
                  type="file"
                  id="image_data"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={submitting}
                />
                <small>Upload a picture of the issue (e.g., broken chair). Max 5MB.</small>
                {formData.image_data && (
                  <div className="image-preview">
                    <p className="preview-text">✓ Image selected</p>
                    <img src={formData.image_data} alt="Preview" className="preview-img" />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    disabled={submitting}
                    required
                  >
                    <option value="furniture">Furniture</option>
                    <option value="it_equipment">IT Equipment</option>
                    <option value="facility">Facility</option>
                    <option value="utilities">Utilities</option>
                    <option value="safety">Safety</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="priority">Priority *</label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    disabled={submitting}
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="location">Location/Office *</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., Building A, Floor 2, Office 202"
                  disabled={submitting}
                  required
                />
              </div>
            </fieldset>

            <button 
              type="submit" 
              className="btn btn-primary btn-large"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Issue'}
            </button>
          </form>
        </section>

        {/* Tickets List */}
        <section className="tickets-section">
          <div className="section-header">
            <div className="section-title-wrapper">
              <div>
                <h2>My Issues</h2>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button 
                    className={`history-toggle-btn ${!showHistory ? 'active' : ''}`}
                    onClick={() => setShowHistory(false)}
                  >
                    Active ({myTickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length})
                  </button>
                  <button 
                    className={`history-toggle-btn ${showHistory ? 'active' : ''}`}
                    onClick={() => setShowHistory(true)}
                  >
                    History ({myTickets.filter(t => t.status === 'closed' || t.status === 'resolved').length})
                  </button>
                </div>
              </div>
            </div>
            <button 
              className="btn btn-secondary"
              onClick={fetchTickets}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            {showHistory && myTickets.filter(t => t.status === 'closed' || t.status === 'resolved').length > 0 && (
              <button 
                className="btn btn-danger"
                onClick={clearUserHistory}
                title="Clear all closed/resolved issues from history"
              >
                Clear History
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">
              <p>Loading issues...</p>
            </div>
          ) : myTickets.filter(t => showHistory ? (t.status === 'closed' || t.status === 'resolved') : (t.status !== 'closed' && t.status !== 'resolved')).length === 0 ? (
            <div className="empty-state">
              <p>{showHistory ? 'No closed/resolved issues yet.' : 'No active issues yet. Submit one to get started!'}</p>
            </div>
          ) : (
            <div className="tickets-list">
              {myTickets
                .filter(ticket => showHistory ? (ticket.status === 'closed' || ticket.status === 'resolved') : (ticket.status !== 'closed' && ticket.status !== 'resolved'))
                .map((ticket, index) => (
                <div 
                  key={index} 
                  className="ticket-card ticket-card-compact"
                  onClick={() => {
                    setSelectedTicket(ticket)
                    setSelectedTicketSource('my')
                    markTicketResponsesAsRead(ticket)
                  }}
                >
                  <div className="ticket-header-compact">
                    <div className="ticket-title-wrapper">
                      <h3>{ticket.title}</h3>
                      {unreadResponses[ticket.id] && (
                        <span className="ticket-update-badge">1 new update</span>
                      )}
                    </div>
                    <div className="ticket-badges">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                      >
                        {ticket.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setSelectedTicket(null)}
              aria-label="Close modal"
            >
              ✕
            </button>

            <div className="modal-header">
              <h2>{selectedTicket.title}</h2>
              <div className="ticket-badges">
                <span 
                  className="priority-badge"
                  style={{ backgroundColor: getPriorityColor(selectedTicket.priority) }}
                >
                  {selectedTicket.priority}
                </span>
                {selectedTicket.category && (
                  <span className="category-badge">{getCategoryLabel(selectedTicket.category)}</span>
                )}
                {selectedTicket.status && (
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedTicket.status) }}
                  >
                    {selectedTicket.status.replace('_', ' ').toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-section">
                <h3>Description</h3>
                <p>{selectedTicket.description}</p>
              </div>

              {selectedTicket.image_data && (
                <div className="modal-section">
                  <h3>Attached Image</h3>
                  <img src={selectedTicket.image_data} alt={selectedTicket.title} className="modal-image" />
                </div>
              )}

              <div className="modal-section modal-grid">
                <div className="modal-item">
                  <strong>Reporter</strong>
                  <p>{selectedTicket.reporter_name}</p>
                  <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>{selectedTicket.reporter_email}</p>
                </div>
                <div className="modal-item">
                  <strong>Department</strong>
                  <p>{selectedTicket.reporter_department}</p>
                </div>
                <div className="modal-item">
                  <strong>Location</strong>
                  <p>{selectedTicket.location}</p>
                </div>
                <div className="modal-item">
                  <strong>Submitted</strong>
                  <p>{formatDate(selectedTicket.created_at || selectedTicket.submittedAt)}</p>
                </div>
                <div className="modal-item">
                  <strong>Status</strong>
                  <p style={{ color: getStatusColor(selectedTicket.status), fontWeight: 'bold' }}>
                    {selectedTicket.status ? selectedTicket.status.replace('_', ' ').toUpperCase() : 'N/A'}
                  </p>
                </div>
                {selectedTicket.last_response_date && (
                  <div className="modal-item">
                    <strong>Last Update</strong>
                    <p>{formatDate(selectedTicket.last_response_date)}</p>
                  </div>
                )}
              </div>

              {selectedTicket.admin_responses && selectedTicket.admin_responses.length > 0 && (
                <div className="modal-section admin-responses-section">
                  <h3>Admin Responses ({selectedTicket.admin_responses.length})</h3>
                  <div className="responses-container">
                    {selectedTicket.admin_responses.map((response) => (
                      <div key={response.response_id} className="response-item">
                        <div className="response-header">
                          <div className="response-admin">
                            <strong className="admin-name">📧 {response.admin_name}</strong>
                            {!response.is_read && <span className="new-badge">New</span>}
                          </div>
                          <span className="response-date">{formatDate(response.created_at)}</span>
                        </div>
                        <p className="response-text">{response.response_text}</p>
                        {response.response_image_data && (
                          <div className="response-image-wrapper">
                            <img 
                              src={response.response_image_data} 
                              alt="Admin response attachment" 
                              className="response-image-display"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTicket.id && (
                <div className="modal-section">
                  <strong>Ticket ID:</strong> {selectedTicket.id.substring(0, 8).toUpperCase()}
                </div>
              )}

              {/* User Feedback Section - shown for completed tickets */}
              {(selectedTicket.status === 'closed' || selectedTicket.status === 'resolved') && (
                <div className="modal-section feedback-section">
                  <h3>Rate & Share Your Feedback</h3>
                  
                  {/* Star Rating */}
                  <div className="feedback-subsection">
                    <label>Rate this ticket (1-5 stars)</label>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          className={`star ${selectedTicket.user_feedback?.rating >= star ? 'filled' : ''}`}
                          onClick={() => submitRating(selectedTicket.id, star)}
                          title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    {selectedTicket.user_feedback?.rating && (
                      <p className="rating-text">You rated this {selectedTicket.user_feedback.rating} star{selectedTicket.user_feedback.rating !== 1 ? 's' : ''}</p>
                    )}
                  </div>

                  {/* Like/Dislike Buttons */}
                  <div className="feedback-subsection">
                    <label>Was this helpful?</label>
                    <div className="like-dislike-buttons">
                      <button 
                        className="like-btn"
                        onClick={() => submitLike(selectedTicket.id)}
                        title="Like this ticket resolution"
                      >
                        👍 Like ({selectedTicket.user_feedback?.likes || 0})
                      </button>
                      <button 
                        className="dislike-btn"
                        onClick={() => submitDislike(selectedTicket.id)}
                        title="Dislike this ticket resolution"
                      >
                        👎 Dislike ({selectedTicket.user_feedback?.dislikes || 0})
                      </button>
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div className="feedback-subsection">
                    <label>Add a comment (optional)</label>
                    <div className="comment-input-group">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Share your experience with this ticket resolution..."
                        className="comment-textarea"
                        maxLength={1000}
                      />
                      <div className="comment-footer">
                        <span className="char-count">{commentText.length}/1000</span>
                        <button 
                          onClick={() => submitComment(selectedTicket.id, selectedTicket.reporter_name)}
                          className="submit-comment-btn"
                          disabled={!commentText.trim()}
                        >
                          Post Comment
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    {selectedTicket.user_feedback?.comments && selectedTicket.user_feedback.comments.length > 0 && (
                      <div className="comments-list">
                        <h4>Comments ({selectedTicket.user_feedback.comments.length})</h4>
                        {selectedTicket.user_feedback.comments.map(comment => (
                          <div key={comment.comment_id} className="comment-item">
                            <div className="comment-header">
                              <strong>{comment.user_name}</strong>
                              <span className="comment-date">{formatDate(comment.created_at)}</span>
                            </div>
                            <p className="comment-text">{comment.comment_text}</p>
                            <button
                              className="delete-comment-btn"
                              onClick={() => deleteComment(selectedTicket.id, comment.comment_id)}
                              title="Delete this comment"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {clearHistoryModal && (
        <div className="modal-overlay" onClick={handleClearHistoryCancel}>
          <div className="clear-history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header delete-warning">
              <h2>Clear History</h2>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                You are about to clear <strong>{closedTicketCount} closed/resolved issue(s)</strong> from your history.
              </p>
              <p className="warning-text">
                This action <strong>cannot be undone</strong>.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={handleClearHistoryCancel} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleClearHistoryConfirm} className="btn-delete">
                Yes, Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

