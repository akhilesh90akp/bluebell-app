/**
 * Toggle - Switch input component
 *
 * A custom-styled toggle switch with optional label and description text.
 * Wraps a hidden checkbox input for accessibility.
 */
import React from 'react';

/** Renders a toggle switch with label and optional description */
export default function Toggle({ label, checked = false, onChange, description }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      {/* Custom toggle track and thumb */}
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        {/* Track background */}
        <div
          className={`
            w-11 h-6 rounded-full transition-colors duration-200
            ${checked ? 'bg-bb-accent' : 'bg-bb-border'}
          `}
        />
        {/* Sliding thumb */}
        <div
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full
            shadow transition-transform duration-200
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </div>

      {/* Label and description text */}
      <div className="flex flex-col">
        {label && (
          <span className="text-sm font-medium text-bb-text group-hover:text-bb-accent transition-colors">
            {label}
          </span>
        )}
        {description && (
          <span className="text-xs text-bb-muted mt-0.5">{description}</span>
        )}
      </div>
    </label>
  );
}
