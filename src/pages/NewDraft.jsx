/**
 * NewDraft - Event creation form
 *
 * Multi-section form for creating a new event draft. Includes client info,
 * location search, event details, service item selection from categories,
 * custom item entry, and notes. Validates required fields before saving.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import LocationInput from '../components/LocationInput';
import { EVENT_TYPES } from '../constants/data';
import {
  User, Phone, MessageSquare, MapPin, Calendar, Clock,
  IndianRupee, ChevronDown, ChevronUp, X, Plus, Save, StickyNote,
} from 'lucide-react';

/** Form page for creating a new event draft */
export default function NewDraft() {
  const { categories, addEvent } = useApp();
  const navigate = useNavigate();

  // Form state with all event fields
  const [form, setForm] = useState({
    clientName: '', clientPhone: '', clientWhatsapp: '', clientAddress: '',
    houseLocation: '', eventLocation: '',
    date: '', time: '', eventType: '', budget: '',
    selectedItems: [], notes: '',
  });
  const [errors, setErrors] = useState({});
  const [openCat, setOpenCat] = useState(null);
  const [customItem, setCustomItem] = useState('');

  /** Shorthand helper to update a single form field */
  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  /** Toggles an item in/out of the selected items list */
  const toggleItem = (item) => {
    setForm(p => ({
      ...p,
      selectedItems: p.selectedItems.includes(item)
        ? p.selectedItems.filter(i => i !== item)
        : [...p.selectedItems, item],
    }));
  };

  /** Removes a specific item from the selected list */
  const removeItem = (item) => {
    setForm(p => ({ ...p, selectedItems: p.selectedItems.filter(i => i !== item) }));
  };

  /** Adds a custom free-text item to the selected list */
  const addCustomItem = () => {
    if (customItem.trim() && !form.selectedItems.includes(customItem.trim())) {
      setForm(p => ({ ...p, selectedItems: [...p.selectedItems, customItem.trim()] }));
      setCustomItem('');
    }
  };

  /** Validates required fields and returns true if form is valid */
  const validate = () => {
    const errs = {};
    if (!form.clientName.trim()) errs.clientName = 'Required';
    if (!form.clientPhone.trim()) errs.clientPhone = 'Required';
    if (!form.date) errs.date = 'Required';
    if (!form.eventType) errs.eventType = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /** Validates and saves the event as a draft, then navigates to drafts list */
  const handleSubmit = () => {
    if (!validate()) return;
    addEvent({
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      clientWhatsapp: form.clientWhatsapp.trim(),
      clientAddress: form.clientAddress.trim(),
      houseLocation: form.houseLocation.trim(),
      eventLocation: form.eventLocation.trim(),
      date: form.date,
      time: form.time,
      eventType: form.eventType,
      budget: form.budget ? Number(form.budget) : null,
      items: form.selectedItems,
      notes: form.notes.trim(),
    });
    navigate('/drafts');
  };

  /** Returns count of selected items belonging to a specific category */
  const selectedCountForCat = (cat) =>
    cat.items.filter(i => form.selectedItems.includes(i)).length;

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold text-bb-text">New Draft</h1>

      {/* Client Info */}
      <Card>
        <h3 className="text-sm font-semibold text-bb-muted uppercase mb-3">Client Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Client Name" placeholder="Full name" icon={User} required
            value={form.clientName} onChange={e => set('clientName', e.target.value)} error={errors.clientName} />
          <Input label="Phone" placeholder="Mobile number" icon={Phone} required
            value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)} error={errors.clientPhone} />
          <Input label="WhatsApp" placeholder="WhatsApp number" icon={MessageSquare}
            value={form.clientWhatsapp} onChange={e => set('clientWhatsapp', e.target.value)} />
          <Input label="Address" placeholder="Client address" icon={MapPin}
            value={form.clientAddress} onChange={e => set('clientAddress', e.target.value)} />
        </div>
      </Card>

      {/* Location */}
      <Card>
        <h3 className="text-sm font-semibold text-bb-muted uppercase mb-3">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LocationInput label="House / Client Location" placeholder="Search or type address..."
            value={form.houseLocation} onChange={val => set('houseLocation', val)} />
          <LocationInput label="Event / Venue Location" placeholder="Search venue location..."
            value={form.eventLocation} onChange={val => set('eventLocation', val)} />
        </div>
      </Card>

      {/* Event Details */}
      <Card>
        <h3 className="text-sm font-semibold text-bb-muted uppercase mb-3">Event Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Date" type="date" required icon={Calendar}
            value={form.date} onChange={e => set('date', e.target.value)} error={errors.date} />
          <Input label="Time" type="time" icon={Clock}
            value={form.time} onChange={e => set('time', e.target.value)} />
          <Select label="Event Type" required options={EVENT_TYPES}
            value={form.eventType} onChange={e => set('eventType', e.target.value)} error={errors.eventType} />
          <Input label="Budget" placeholder="Approx budget" icon={IndianRupee} type="number"
            value={form.budget} onChange={e => set('budget', e.target.value)} />
        </div>
      </Card>

      {/* Services */}
      <Card>
        <h3 className="text-sm font-semibold text-bb-muted uppercase mb-3">Services</h3>

        {/* Selected Items Tags */}
        {form.selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-bb-border">
            {form.selectedItems.map(item => (
              <span key={item} className="inline-flex items-center gap-1 px-2 py-1 bg-bb-accent/20 text-bb-accent text-xs rounded-full">
                {item}
                <button onClick={() => removeItem(item)} className="hover:text-white cursor-pointer">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Categories Accordion */}
        <div className="space-y-2">
          {categories.map(cat => {
            const isOpen = openCat === cat.id;
            return (
            <div key={cat.id} className={`rounded-lg overflow-hidden transition-all ${isOpen ? 'border-l-4 border-l-bb-accent border border-bb-accent/30 bg-bb-accent/5 shadow-sm' : 'border border-bb-border'}`}>
              <button
                onClick={() => setOpenCat(isOpen ? null : cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer ${isOpen ? 'bg-bb-accent/10' : 'bg-bb-input hover:bg-bb-card-hover'}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-bb-text">
                  <span>{cat.icon}</span>
                  {cat.name}
                  {selectedCountForCat(cat) > 0 && (
                    <span className="text-xs bg-bb-accent text-white px-1.5 py-0.5 rounded-full">
                      {selectedCountForCat(cat)}
                    </span>
                  )}
                </span>
                {isOpen ? <ChevronUp size={18} className="text-bb-accent" /> : <ChevronDown size={18} className="text-bb-muted" />}
              </button>

              {isOpen && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {cat.items.map(item => (
                    <button
                      key={item}
                      onClick={() => toggleItem(item)}
                      className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                        form.selectedItems.includes(item)
                          ? 'bg-bb-accent/20 border-bb-accent text-bb-accent font-medium'
                          : 'bg-white border-bb-border text-bb-text hover:border-bb-accent/50'
                      }`}
                    >
                      {form.selectedItems.includes(item) && '✓ '}{item}
                    </button>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* Custom Item */}
        <div className="flex gap-2 mt-4">
          <Input placeholder="Custom item..." value={customItem} onChange={e => setCustomItem(e.target.value)}
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && addCustomItem()}
          />
          <Button icon={Plus} variant="secondary" onClick={addCustomItem}>Add</Button>
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <Input label="Notes" type="textarea" placeholder="Any additional notes..." icon={StickyNote}
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </Card>

      {/* Submit */}
      <Button icon={Save} fullWidth size="lg" onClick={handleSubmit}>
        Save as Draft
      </Button>
    </div>
  );
}
