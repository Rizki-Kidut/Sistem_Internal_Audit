// Field components untuk form — konsisten di seluruh modul.

import { type ReactNode } from 'react';

interface FieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, required, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
        invalid
          ? 'border-red-400 focus:ring-red-200'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
      } ${className}`}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid, className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
        invalid
          ? 'border-red-400 focus:ring-red-200'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
      } ${className}`}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
        invalid
          ? 'border-red-400 focus:ring-red-200'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
      } ${className}`}
    />
  );
}

// Indikator visual untuk field auto-terisi (prinsip "generate sekali, koreksi seperlunya")
interface AutoFilledBadgeProps {
  label?: string;
}

export function AutoFilledBadge({ label = 'Auto-terisi' }: AutoFilledBadgeProps) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
      {label}
    </span>
  );
}
