import { useState, useEffect } from 'react'
import './Dashboard.css'

const API_BASE_URL = 'http://localhost:8000'

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

  // Load user's submitted tickets from localStorage on component mount
  useEffect(() => {
    fetchTickets()
    loadMyTickets()
  }, [])

  // Load submitted tickets from localStorage
  const loadMyTickets = () => {
    try {
      const stored = localStorage.getItem('mySubmittedTickets')
      if (stored) {
        setMyTickets(JSON.parse(stored))
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
    } catch (err) {
      setError(err.message)
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Employee Issue Submission Portal</h1>
        <p>Report workplace issues and track their resolution</p>
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

      {/* Mode Tabs */}
      <div className="mode-tabs">
        <button 
          className={`tab-btn ${viewMode === 'submit' ? 'active' : ''}`}
          onClick={() => setViewMode('submit')}
        >
          Submit Issue
        </button>
        <button 
          className={`tab-btn ${viewMode === 'my-reports' ? 'active' : ''}`}
          onClick={() => {
            setViewMode('my-reports')
            loadMyTickets()
          }}
        >
          My Reports ({myTickets.length})
        </button>
      </div>

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
            <h2>My Issues ({tickets.length})</h2>
            <button 
              className="btn btn-secondary"
              onClick={fetchTickets}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="loading">
              <p>Loading issues...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <p>No issues yet. Submit one to get started!</p>
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map(ticket => (
                <div key={ticket.id} className="ticket-card">
                  <div className="ticket-header">
                    <div className="ticket-title-section">
                      <h3>{ticket.title}</h3>
                      <div className="ticket-meta-tags">
                        <span className="category-badge">{getCategoryLabel(ticket.category)}</span>
                      </div>
                    </div>
                    <div className="ticket-badges">
                      <span 
                        className="badge priority-badge"
                        style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                      >
                        {ticket.priority}
                      </span>
                      <span 
                        className="badge status-badge"
                        style={{ backgroundColor: getStatusColor(ticket.status) }}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <p className="ticket-description">{ticket.description}</p>

                  {ticket.image_data && (
                    <div className="ticket-image">
                      <img src={ticket.image_data} alt={ticket.title} />
                    </div>
                  )}

                  <div className="ticket-details">
                    <div className="detail-item">
                      <strong>Reporter:</strong> {ticket.reporter_name} ({ticket.reporter_email})
                    </div>
                    <div className="detail-item">
                      <strong>Department:</strong> {ticket.reporter_department}
                    </div>
                    <div className="detail-item">
                      <strong>Location:</strong> {ticket.location}
                    </div>
                  </div>

                  <div className="ticket-footer">
                    <small className="ticket-meta">
                      ID: {ticket.id.substring(0, 8)}...
                    </small>
                    <small className="ticket-date">
                      Submitted: {formatDate(ticket.created_at)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      )}

      {/* My Reports Mode */}
      {viewMode === 'my-reports' && (
        <div className="search-section">
          <div className="search-container">
            <h2>My Submitted Reports</h2>
            <p>View all issues you've submitted from this device</p>
            
            {myTickets.length === 0 ? (
              <div className="empty-state">
                <p>You haven't submitted any issues yet.</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setViewMode('submit')}
                >
                  Submit Your First Issue
                </button>
              </div>
            ) : (
              <div className="my-tickets-list">
                {myTickets.map((ticket, index) => (
                  <div key={index} className="ticket-card ticket-card-full">
                    <div className="ticket-header">
                      <div className="ticket-title-section">
                        <h3>{ticket.title}</h3>
                        <div className="ticket-meta-tags">
                          <span className="category-badge">{getCategoryLabel(ticket.category)}</span>
                        </div>
                      </div>
                      <div className="ticket-badges">
                        <span 
                          className="badge priority-badge"
                          style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                        >
                          {ticket.priority}
                        </span>
                        <span 
                          className="badge status-badge"
                          style={{ backgroundColor: getStatusColor(ticket.status) }}
                        >
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="ticket-description">{ticket.description}</p>

                    {ticket.image_data && (
                      <div className="ticket-image">
                        <img src={ticket.image_data} alt={ticket.title} />
                      </div>
                    )}

                    <div className="ticket-details">
                      <div className="detail-item">
                        <strong>Reference ID:</strong> {ticket.id.substring(0, 8).toUpperCase()}
                      </div>
                      <div className="detail-item">
                        <strong>Location:</strong> {ticket.location}
                      </div>
                      <div className="detail-item">
                        <strong>Department:</strong> {ticket.reporter_department}
                      </div>
                    </div>

                    <div className="ticket-footer">
                      <small className="ticket-date">
                        Submitted: {formatDate(ticket.submittedAt || ticket.created_at)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
