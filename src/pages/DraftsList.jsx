/**
 * DraftsList - Draft events management page
 *
 * Displays all draft events in an expandable card list with search filtering.
 * Each card shows client info, event details, items, and action buttons.
 * Backward compatible with old event format (no mainEvent/subEvents).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { formatCurrency, formatDateReadable, daysUntil, telLink, waLink } from '../utils/helpers';
import {
  Search, Phone, MessageSquare, Edit, FileText, CheckCircle,
  Trash2, CalendarDays, MapPin, PackageOpen, ChevronDown, ChevronUp,
  Home, Navigation, IndianRupee,
} from 'lucide-react';

/**
 * Helper: get all items from an event (both old and new format)
 */
function getAllItems(ev) {
  if (ev.mainEvent) {
    const items = [...(ev.mainEvent.items || [])];
    (ev.subEvents || []).forEach(s => {
      (s.items || []).forEach(item => {
        if (!items.includes(item)) items.push(item);
      });
    });
    return items;
  }
  return ev.items || [];
}

/**
 * Helper: get display date for an event (backward compatible)
 */
function getEventDate(ev) {
  if (ev.mainEvent?.date) return ev.mainEvent.date;
  return ev.date || '';
}

/**
 * Helper: get event location (backward compatible)
 */
function getEventLocation(ev) {
  if (ev.mainEvent?.location) return ev.mainEvent.location;
  return ev.eventLocation || '';
}

/** Lists all draft events with search, expand/collapse, and actions */
export default function DraftsList() {
  const { events, deleteEvent, updateEvent, showToast } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Filter drafts by search query (client name, type, or location)
  const drafts = events
    .filter(e => e.status === 'draft')
    .filter(e => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.clientName?.toLowerCase().includes(q) ||
        e.eventType?.toLowerCase().includes(q) ||
        getEventLocation(e).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(getEventDate(b) || b.createdAt) - new Date(getEventDate(a) || a.createdAt));

  /** Promotes a draft to confirmed status */
  const confirmEvent = (id) => {
    updateEvent(id, { status: 'confirmed' });
    showToast('Event confirmed');
  };

  /** Executes the delete after modal confirmation */
  const handleDelete = () => {
    if (deleteId) {
      deleteEvent(deleteId);
      setDeleteId(null);
      showToast('Event deleted');
    }
  };

  /** Toggles the expanded/collapsed state of a draft card */
  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-bb-text">Drafts</h1>

      {/* Search */}
      <Input
        placeholder="Search drafts..."
        icon={Search}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <PackageOpen size={44} className="mx-auto text-bb-muted mb-3" />
            <p className="text-bb-muted font-medium">No drafts found</p>
            <p className="text-sm text-bb-muted/60 mt-1">
              {search ? 'Try a different search' : 'Create a new draft to get started'}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => navigate('/new')}>Create Draft</Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {drafts.map(ev => {
            const evDate = getEventDate(ev);
            const days = daysUntil(evDate);
            const allItems = getAllItems(ev);
            const subEventCount = (ev.subEvents || []).length;
            const isExpanded = expandedId === ev.id;
            const location = getEventLocation(ev);
            return (
              <Card key={ev.id}>
                <div className="space-y-3">
                  {/* Collapsed Header - Clickable */}
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleExpand(ev.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-bb-text truncate">{ev.clientName}</p>
                        <Badge variant="draft">{ev.eventType}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-bb-muted">
                        {evDate && (
                          <span className="flex items-center gap-1">
                            <CalendarDays size={14} />
                            {formatDateReadable(evDate)}
                          </span>
                        )}
                        {location && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <MapPin size={14} />
                            {location}
                          </span>
                        )}
                        {allItems.length > 0 && (
                          <span className="text-xs text-bb-muted">
                            {allItems.length} item{allItems.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {subEventCount > 0 && (
                          <span className="text-xs text-bb-accent">
                            +{subEventCount} sub-event{subEventCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Color-coded days remaining badge */}
                      {days !== null && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          days < 0 ? 'bg-red-100 text-red-700' :
                          days <= 3 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-bb-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-bb-muted" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-bb-border">
                      {/* All Items */}
                      {allItems.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-bb-muted uppercase mb-1.5">Items</p>
                          <div className="flex flex-wrap gap-1.5">
                            {allItems.map(item => (
                              <span key={item} className="text-xs px-2 py-0.5 bg-bb-accent/10 text-bb-accent rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Budget */}
                      {ev.budget && (
                        <div className="flex items-center gap-2 text-sm text-bb-muted">
                          <IndianRupee size={14} />
                          <span>Budget: <span className="text-bb-text font-medium">{formatCurrency(ev.budget)}</span></span>
                        </div>
                      )}

                      {/* Notes */}
                      {ev.notes && (
                        <div>
                          <p className="text-xs font-semibold text-bb-muted uppercase mb-1">Notes</p>
                          <p className="text-sm text-bb-muted bg-bb-input rounded-lg px-3 py-2">{ev.notes}</p>
                        </div>
                      )}

                      {/* Addresses & Locations */}
                      <div className="space-y-2">
                        {ev.clientAddress && (
                          <div className="flex items-start gap-2 text-sm text-bb-muted">
                            <Home size={14} className="flex-shrink-0 mt-0.5" />
                            <span>Client Address: <span className="text-bb-text">{ev.clientAddress}</span></span>
                          </div>
                        )}
                        {ev.houseLocation && (
                          <div className="flex items-start gap-2 text-sm text-bb-muted">
                            <Navigation size={14} className="flex-shrink-0 mt-0.5" />
                            <span>House Location: <span className="text-bb-text">{ev.houseLocation}</span></span>
                          </div>
                        )}
                        {location && (
                          <div className="flex items-start gap-2 text-sm text-bb-muted">
                            <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                            <span>Event Location: <span className="text-bb-text">{location}</span></span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-bb-border">
                        {ev.clientPhone && (
                          <a href={telLink(ev.clientPhone)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                            <Phone size={14} /> Call
                          </a>
                        )}
                        {(ev.clientWhatsapp || ev.clientPhone) && (
                          <a href={waLink(ev.clientWhatsapp || ev.clientPhone)} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                            <MessageSquare size={14} /> WhatsApp
                          </a>
                        )}
                        <Button size="sm" variant="secondary" icon={Edit} onClick={() => navigate(`/edit/${ev.id}`)}>Edit</Button>
                        <Button size="sm" variant="secondary" icon={FileText} onClick={() => navigate(`/quotation/${ev.id}`)}>Quote</Button>
                        <Button size="sm" variant="success" icon={CheckCircle} onClick={() => confirmEvent(ev.id)}>Confirm</Button>
                        <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteId(ev.id)}>Delete</Button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons - Always visible in collapsed view */}
                  {!isExpanded && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-bb-border">
                      <Button size="sm" variant="secondary" icon={Edit} onClick={() => navigate(`/edit/${ev.id}`)}>Edit</Button>
                      <Button size="sm" variant="secondary" icon={FileText} onClick={() => navigate(`/quotation/${ev.id}`)}>Quote</Button>
                      <Button size="sm" variant="success" icon={CheckCircle} onClick={() => confirmEvent(ev.id)}>Confirm</Button>
                      <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteId(ev.id)}>Delete</Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Draft?" size="sm">
        <p className="text-bb-muted mb-4">This action cannot be undone. Are you sure you want to delete this draft?</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
