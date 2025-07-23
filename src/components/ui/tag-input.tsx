"use client";

import React from 'react';
import { Input } from './input';
import { Button } from './button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

interface TagInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string[];
  onChange: (value: string[]) => void;
}

export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>((props, ref) => {
  const { className, value, onChange, ...rest } = props;

  const [inputValue, setInputValue] = React.useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !value.includes(newTag)) {
        onChange([...value, newTag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        onChange(value.slice(0, -1));
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasteText = e.clipboardData.getData('text');
      const newTags = pasteText
        .split(/[\n,]+/)
        .map(tag => tag.trim())
        .filter(tag => tag && !value.includes(tag));
      
      if (newTags.length > 0) {
        onChange([...value, ...newTags]);
      }
      setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
    >
      {value.map((tag, index) => (
        <Badge key={index} variant="secondary" className="pl-2 pr-1 py-1">
          {tag}
          <button
            type="button"
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
            onClick={() => removeTag(tag)}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove {tag}</span>
          </button>
        </Badge>
      ))}
      <Input
        ref={ref}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onPaste={handlePaste}
        className="h-auto flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        {...rest}
      />
    </div>
  );
});

TagInput.displayName = 'TagInput';